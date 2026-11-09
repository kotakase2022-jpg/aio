import type { ArticleDraft, ArticleImage, AuthorInput, FaqItem } from "@/types/aio";
import { sanitizeArticleHtml } from "@/lib/article-html";
import {
  articleContainsCanonicalSourceLink,
  canonicalSourceUrlKey,
  decodeHtmlAmpersands,
  isUnusableFetchedSourceUrl,
  normalizeSourceUrl,
  unusableFetchedSourceUrlKeys,
} from "@/lib/source-url";

type BuildDraftArticleHtmlOptions = {
  imageUrlResolver?: (url: string) => string;
};

const authorSectionHeading = "この記事の執筆者";

export function buildDraftArticleHtml(
  draft: ArticleDraft,
  options: BuildDraftArticleHtmlOptions = {},
) {
  const publicBody = removeInternalProcessNotes(draft.editedBodyHtml);
  const withImages = replaceDraftImageReferences(publicBody, draft.images, options);
  const withFaq = appendFaqBlockWhenNeeded(withImages, draft.faqItems);
  const withAuthor = appendAuthorBlockWhenNeeded(withFaq, draft.author, options);
  return sanitizeArticleHtml(appendSourceBlockWhenNeeded(withAuthor, draft));
}

function removeInternalProcessNotes(html: string) {
  const notes = [
    "競合URLから本文を取得しました",
    "参照URLから本文を取得しました",
    "入力フォームの参照情報です",
    "入力フォームの競合情報です",
    "AI競合調査で参照した競合情報です",
  ];
  const notePattern = notes.map(escapeRegExp).join("|");
  const withoutNotes = html.replace(new RegExp(`(?:${notePattern})[。．.]?`, "g"), "");

  return withoutNotes.replace(
    /<(p|li)\b([^>]*)>\s*(?:<br\s*\/?>\s*)*<\/\1>/gi,
    "",
  );
}

export function replaceDraftImageReferences(
  html: string,
  images: ArticleImage[],
  options: BuildDraftArticleHtmlOptions = {},
) {
  return images.reduce((currentHtml, image) => {
    const url = image.url.trim();
    if (!url) {
      return currentHtml;
    }

    const resolvedUrl = options.imageUrlResolver ? options.imageUrlResolver(url) : url;
    const altText = image.altText.trim();
    return replaceImageReference(
      replaceImageReference(currentHtml, `aio-image:${image.id}`, resolvedUrl, altText),
      url,
      resolvedUrl,
      altText,
    );
  }, html);
}

export function appendFaqBlockWhenNeeded(html: string, faqItems: FaqItem[]) {
  const items = canonicalizeFaqItems(faqItems);
  const withoutManagedFaq = removeGeneratedFaqBlocks(removeManagedFaqBlock(html), items);
  if (items.length === 0) {
    return withoutManagedFaq;
  }

  return joinHtmlBlocks(withoutManagedFaq, buildFaqBlockHtml(items));
}

function canonicalizeFaqItems(faqItems: FaqItem[]) {
  const items: Array<{ question: string; answer: string }> = [];
  const indexByQuestion = new Map<string, number>();

  for (const item of faqItems) {
    const question = faqPlainText(item.question);
    const answer = faqPlainText(item.answer);
    if (!question && !answer) {
      continue;
    }

    const key = normalizeFaqQuestion(question) || `answer:${normalizeFaqQuestion(answer)}`;
    const existingIndex = indexByQuestion.get(key);
    if (existingIndex === undefined) {
      indexByQuestion.set(key, items.length);
      items.push({ question, answer });
      continue;
    }

    // Later entries represent the editor's latest decision while the first position
    // remains stable, so repeated save/restore cycles do not reorder the FAQ.
    items[existingIndex] = { question, answer };
  }

  return items;
}

function normalizeFaqQuestion(value: string) {
  return decodeBasicHtmlEntities(stripHtmlText(value))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function faqPlainText(value: string) {
  return decodeBasicHtmlEntities(
    value.replace(/<\/?(?:a|b|br|code|em|i|span|strong)\b[^>]*>/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function appendSourceBlockWhenNeeded(html: string, draft: ArticleDraft) {
  const sources = collectRenderableSources(draft);
  const withoutManagedSources = removeManagedSourceBlock(html);
  if (sources.length === 0) {
    return withoutManagedSources;
  }

  const bodyForUrlChecks = decodeHtmlAmpersands(withoutManagedSources);
  const missingSources = sources.filter((source) => !sourceUrlAlreadyVisible(source.url, bodyForUrlChecks));
  if (missingSources.length === 0) {
    return withoutManagedSources;
  }

  return joinHtmlBlocks(withoutManagedSources, buildSourceBlockHtml(missingSources));
}

export function appendAuthorBlockWhenNeeded(
  html: string,
  author: AuthorInput,
  options: BuildDraftArticleHtmlOptions = {},
) {
  const normalizedAuthor = {
    name: author.name?.trim() ?? "",
    title: author.title?.trim() ?? "",
    bio: author.bio?.trim() ?? "",
    imageUrl: author.imageUrl?.trim() ?? "",
  };
  const hasAuthor =
    normalizedAuthor.name ||
    normalizedAuthor.title ||
    normalizedAuthor.bio ||
    normalizedAuthor.imageUrl;
  const withoutManagedAuthor = removeManagedAuthorBlock(html);

  if (!hasAuthor) {
    return withoutManagedAuthor;
  }

  const text = normalizeText(stripHtmlText(withoutManagedAuthor));
  const headingAlreadyVisible = text.includes(normalizeText(authorSectionHeading));
  const hasCompleteAuthorSection = hasExistingAuthorSection(
    withoutManagedAuthor,
    text,
    normalizedAuthor,
  );

  // Keep an existing complete author section as-is unless an uploaded portrait must be injected.
  if (hasCompleteAuthorSection && !normalizedAuthor.imageUrl) {
    return withoutManagedAuthor;
  }

  // Otherwise render the managed author block. Strip any existing author section or a bare/orphan
  // "この記事の執筆者" heading first so the output does not end up with a duplicate heading.
  const base =
    hasCompleteAuthorSection
      ? removeExistingAuthorProfileBlock(withoutManagedAuthor, normalizedAuthor)
      : headingAlreadyVisible
        ? removeBareAuthorHeading(withoutManagedAuthor)
      : withoutManagedAuthor;
  return `${base}\n${buildAuthorBlockHtml(normalizedAuthor, options)}`.trim();
}

function hasExistingAuthorSection(
  html: string,
  normalizedBodyText: string,
  author: Required<Pick<AuthorInput, "name" | "title" | "bio" | "imageUrl">>,
) {
  const headingAlreadyVisible = normalizedBodyText.includes(normalizeText(authorSectionHeading));
  const nameAlreadyVisible = author.name && normalizedBodyText.includes(normalizeText(author.name));

  // A bare "この記事の執筆者" heading with no actual author identity in the body is an
  // orphan/placeholder, not a complete author section. Require the author name to appear
  // alongside the heading (or a title/bio) before suppressing the managed author block, so
  // uploaded author name/title/bio are not silently dropped when only the heading exists.
  if (nameAlreadyVisible && headingAlreadyVisible) {
    return true;
  }

  return findAuthorProfileSection(html, author) !== "";
}

function buildFaqBlockHtml(items: Array<{ question: string; answer: string }>) {
  const body = items
    .map((item) => {
      const question = item.question || "FAQ";
      const answer = item.answer || "";
      return `<div class="aio-faq-item"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(
        answer,
      )}</p></div>`;
    })
    .join("\n");

  return `<section class="aio-faq-block" aria-label="FAQ"><h2>FAQ</h2>\n${body}\n</section>`;
}

function buildSourceBlockHtml(sources: Array<{ url: string; title: string; usageNotes: string }>) {
  const items = sources
    .map((source) => {
      const title = source.title || source.url;
      const note = source.usageNotes ? ` <span>${escapeHtml(source.usageNotes)}</span>` : "";
      return `<li><a href="${escapeHtmlAttribute(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        title,
      )}</a>${note}</li>`;
    })
    .join("\n");

  return `<section class="aio-source-block" aria-label="参照元"><h2>参照元</h2>\n<ul>\n${items}\n</ul>\n</section>`;
}

function buildAuthorBlockHtml(
  author: Required<Pick<AuthorInput, "name" | "title" | "bio" | "imageUrl">>,
  options: BuildDraftArticleHtmlOptions,
) {
  const imageUrl = author.imageUrl
    ? options.imageUrlResolver
      ? options.imageUrlResolver(author.imageUrl)
      : author.imageUrl
    : "";
  const image = imageUrl
    ? `<img src="${escapeHtmlAttribute(imageUrl)}" alt="${escapeHtmlAttribute(
        author.name || authorSectionHeading,
      )}" />`
    : "";
  const title = author.title ? `<p class="aio-author-title">${escapeHtml(author.title)}</p>` : "";
  const bio = author.bio ? `<p class="aio-author-bio">${escapeHtml(author.bio)}</p>` : "";
  const name = author.name || "執筆者";

  return `<section class="aio-author-block" aria-label="${authorSectionHeading}"><h2>${authorSectionHeading}</h2>\n<div class="aio-author-profile">${image}<div><h3>${escapeHtml(
    name,
  )}</h3>${title}${bio}</div></div>\n</section>`;
}

function removeExistingAuthorProfileBlock(
  html: string,
  author: Required<Pick<AuthorInput, "name" | "title" | "bio" | "imageUrl">>,
) {
  const escapedHeading = escapeRegExp(authorSectionHeading);
  const sectionWithHeading = new RegExp(
    `<section\\b[^>]*>[\\s\\S]*?<h[2-3][^>]*>\\s*${escapedHeading}\\s*<\\/h[2-3]>[\\s\\S]*?<\\/section>`,
    "i",
  );
  const fromHeadingToNextSection = new RegExp(
    `<h[2-3][^>]*>\\s*${escapedHeading}\\s*<\\/h[2-3]>[\\s\\S]*?(?=<h[1-3]\\b|<section\\b|$)`,
    "i",
  );
  const withoutHeadingSection = html.replace(sectionWithHeading, "").replace(fromHeadingToNextSection, "");
  if (withoutHeadingSection !== html) {
    return withoutHeadingSection.trim();
  }

  if (!author.name) {
    return html;
  }

  const profileSection = findAuthorProfileSection(html, author);
  if (!profileSection) {
    return html;
  }

  return html.replace(profileSection, "").trim();
}

function findAuthorProfileSection(
  html: string,
  author: Required<Pick<AuthorInput, "name" | "title" | "bio" | "imageUrl">>,
) {
  if (!author.name) {
    return "";
  }

  const sections = html.match(/<section\b[^>]*>[\s\S]*?<\/section>/gi) ?? [];
  return (
    sections.find((section) => {
      const text = normalizeText(stripHtmlText(section));
      const hasName = text.includes(normalizeText(author.name));
      const hasTitle = author.title ? text.includes(normalizeText(author.title)) : false;
      const hasBio = author.bio ? text.includes(normalizeText(author.bio)) : false;

      return hasName && (hasTitle || hasBio);
    }) ?? ""
  );
}

function removeBareAuthorHeading(html: string) {
  const escapedHeading = escapeRegExp(authorSectionHeading);
  return html
    .replace(new RegExp(`<h[2-3][^>]*>\\s*${escapedHeading}\\s*<\\/h[2-3]>`, "gi"), "")
    .trim();
}

function removeManagedFaqBlock(html: string) {
  return removeSectionsByClass(html, "aio-faq-block");
}

function removeGeneratedFaqBlocks(
  html: string,
  faqItems: Array<{ question: string; answer: string }>,
) {
  const ranges: Array<{ start: number; end: number }> = [];
  const canonicalQuestionKeys = new Set(
    faqItems.map((item) => normalizeFaqQuestion(item.question)).filter(Boolean),
  );
  const headingPattern = /<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi;
  let headingMatch: RegExpExecArray | null;

  while ((headingMatch = headingPattern.exec(html))) {
    if (!isFaqSectionHeading(headingMatch[0])) {
      continue;
    }

    const end = findGeneratedFaqContentEnd(
      html,
      headingPattern.lastIndex,
      canonicalQuestionKeys,
    );
    ranges.push({ start: headingMatch.index, end });
    headingPattern.lastIndex = end;
  }

  return ranges
    .reverse()
    .reduce(
      (currentHtml, range) =>
        `${currentHtml.slice(0, range.start)}${currentHtml.slice(range.end)}`,
      html,
    )
    .trim();
}

function isFaqSectionHeading(headingHtml: string) {
  const value = decodeBasicHtmlEntities(stripHtmlText(headingHtml))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s:：()（）【】\[\]・。、]+/g, "");

  return /^(?:faq(?:よくある(?:ご)?質問)?|よくある(?:ご)?質問|q&a|質問と回答)$/.test(value);
}

function looksLikeFaqQuestion(value: string) {
  const normalized = value.normalize("NFKC").trim();
  return (
    /[?？]$/.test(normalized) ||
    /^(?:q\s*[.:：]|質問\s*[.:：])/i.test(normalized) ||
    /(?:ですか|ますか|でしょうか|できますか|なりますか)[。.]?$/.test(normalized)
  );
}

function findGeneratedFaqContentEnd(
  html: string,
  fromIndex: number,
  canonicalQuestionKeys: Set<string>,
) {
  let cursor = skipHtmlSpacing(html, fromIndex);
  let lastEnd = fromIndex;

  while (cursor < html.length) {
    const questionMatch = html
      .slice(cursor)
      .match(/^<h([34])\b[^>]*>([\s\S]*?)<\/h\1>/i);
    if (!questionMatch) {
      break;
    }

    const question = decodeBasicHtmlEntities(stripHtmlText(questionMatch[2])).trim();
    const questionKey = normalizeFaqQuestion(question);
    if (!canonicalQuestionKeys.has(questionKey) && !looksLikeFaqQuestion(question)) {
      break;
    }

    const questionEnd = cursor + questionMatch[0].length;
    const answerStart = skipHtmlSpacing(html, questionEnd);
    const answerMatch = html
      .slice(answerStart)
      .match(/^<(p|div|ul|ol|table|blockquote)\b[^>]*>[\s\S]*?<\/\1>/i);

    lastEnd = questionEnd;
    if (answerMatch) {
      lastEnd = answerStart + answerMatch[0].length;
    }
    cursor = skipHtmlSpacing(html, lastEnd);
  }

  return lastEnd;
}

function skipHtmlSpacing(html: string, fromIndex: number) {
  const spacing = html.slice(fromIndex).match(/^(?:\s|<!--[\s\S]*?-->)+/);
  return fromIndex + (spacing?.[0].length ?? 0);
}

function removeManagedSourceBlock(html: string) {
  return removeSectionsByClass(html, "aio-source-block");
}

function removeManagedAuthorBlock(html: string) {
  return removeSectionsByClass(html, "aio-author-block");
}

function removeSectionsByClass(html: string, className: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const sectionStart = /<section\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = sectionStart.exec(html))) {
    const startTag = match[0];
    if (!sectionTagHasClass(startTag, className)) {
      continue;
    }

    const end =
      findSectionEnd(html, sectionStart.lastIndex) ??
      findUnclosedManagedSectionEnd(html, sectionStart.lastIndex);
    if (end > sectionStart.lastIndex) {
      ranges.push({ start: match.index, end });
      sectionStart.lastIndex = end;
    }
  }

  return ranges
    .reverse()
    .reduce((currentHtml, range) => `${currentHtml.slice(0, range.start)}${currentHtml.slice(range.end)}`, html)
    .trim();
}

function sectionTagHasClass(tag: string, className: string) {
  const match = tag.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const classes = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").split(/\s+/);
  return classes.includes(className);
}

function findSectionEnd(html: string, fromIndex: number) {
  const sectionTag = /<\/?section\b[^>]*>/gi;
  sectionTag.lastIndex = fromIndex;
  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = sectionTag.exec(html))) {
    if (match[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) {
        return sectionTag.lastIndex;
      }
    } else {
      depth += 1;
    }
  }

  return null;
}

function findUnclosedManagedSectionEnd(html: string, fromIndex: number) {
  const htmlAfterStart = html.slice(fromIndex);
  const firstHeading = htmlAfterStart.match(/<h[1-3]\b[\s\S]*?<\/h[1-3]>/i);
  const searchFrom =
    firstHeading?.index === undefined
      ? fromIndex
      : fromIndex + firstHeading.index + firstHeading[0].length;
  const boundary = html.slice(searchFrom).search(/<h[1-2]\b|<section\b/i);

  return boundary >= 0 ? searchFrom + boundary : html.length;
}

function collectRenderableSources(draft: ArticleDraft) {
  const seen = new Set<string>();
  const unusableSourceKeys = unusableFetchedSourceUrlKeys(
    [...draft.fetchedReferences, ...draft.fetchedCompetitors],
  );
  const declaredSources = draft.aiResult.sources.map((source) => ({
    url: normalizeSourceUrl(source.url),
    title: source.title.trim(),
    usageNotes: publicSourceNote(source.usage_notes),
  }));
  const legacyFallbackSources = [
    ...draft.fetchedReferences
      .filter((source) => source.ok && source.evidenceUsable !== false)
      .map((source) => ({
      url: normalizeSourceUrl(source.url),
      title: source.title?.trim() || source.url.trim(),
      usageNotes: "",
    })),
    ...draft.inputPayload.references
      .filter(
        (source) =>
          !isUnusableFetchedSourceUrl(source.url ?? "", unusableSourceKeys),
      )
      .map((source) => ({
      url: normalizeSourceUrl(source.url ?? ""),
      title: source.url?.trim() || "",
      usageNotes: "",
    })),
    ...draft.fetchedCompetitors
      .filter((source) => source.ok && source.evidenceUsable !== false)
      .map((source) => ({
      url: normalizeSourceUrl(source.url),
      title: source.title?.trim() || source.url.trim(),
      usageNotes: "",
    })),
    ...draft.inputPayload.competitors
      .filter(
        (source) =>
          !isUnusableFetchedSourceUrl(source.url ?? "", unusableSourceKeys),
      )
      .map((source) => ({
      url: normalizeSourceUrl(source.url ?? ""),
      title: source.url?.trim() || "",
      usageNotes: "",
    })),
    ...(draft.competitorResearch?.insights ?? [])
      .filter((source) => !isUnusableFetchedSourceUrl(source.url, unusableSourceKeys))
      .map((source) => ({
        url: normalizeSourceUrl(source.url),
        title: source.title.trim() || source.url.trim(),
        usageNotes: "",
      })),
  ];

  // New drafts declare only sources that support published claims. Older drafts may not
  // have that field populated, so keep their historical URL fallback for compatibility.
  return (declaredSources.some((source) => source.url)
    ? declaredSources.filter(
        (source) => !isUnusableFetchedSourceUrl(source.url, unusableSourceKeys),
      )
    : legacyFallbackSources)
    .filter((source) => {
      const sourceKey = canonicalSourceUrlKey(source.url);
      if (!source.url || seen.has(sourceKey)) {
        return false;
      }
      seen.add(sourceKey);
      return true;
    })
    .slice(0, 8);
}

function publicSourceNote(value: string) {
  const note = value.trim();
  if (
    /(?:参照|競合)URLから本文を取得しました|入力フォームの(?:参照|競合)情報です|AI競合調査で参照した競合情報です/.test(
      note,
    )
  ) {
    return "";
  }
  return note;
}

function sourceUrlAlreadyVisible(url: string, html: string) {
  return articleContainsCanonicalSourceLink(url, html);
}

function replaceImageReference(html: string, from: string, to: string, altText: string) {
  const escapedFrom = escapeRegExp(from);
  const escapedTo = escapeHtmlAttribute(to);
  const escapedAlt = escapeHtmlAttribute(altText);
  return html.replace(
    new RegExp(`<img\\b([^>]*?)\\bsrc=(["'])${escapedFrom}\\2([^>]*)>`, "gi"),
    (_match, before: string, _quote: string, after: string) => {
      const attributes = `${before}src="${escapedTo}"${after}`;
      return `<img${syncImageAltAttribute(attributes, escapedAlt)}>`;
    },
  );
}

function syncImageAltAttribute(attributes: string, escapedAlt: string) {
  if (!escapedAlt) {
    return attributes;
  }

  const altAttribute = /\balt\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i;
  if (altAttribute.test(attributes)) {
    return attributes.replace(altAttribute, `alt="${escapedAlt}"`);
  }

  const trailingSlash = attributes.match(/\s*\/\s*$/)?.[0] ?? "";
  const baseAttributes = trailingSlash
    ? attributes.slice(0, -trailingSlash.length).trimEnd()
    : attributes;
  return `${baseAttributes} alt="${escapedAlt}"${trailingSlash}`;
}

function stripHtmlText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;|&#038;/gi, "&")
    .replace(/&lt;|&#60;/gi, "<")
    .replace(/&gt;|&#62;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function joinHtmlBlocks(...blocks: string[]) {
  return blocks.map((block) => block.trim()).filter(Boolean).join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
