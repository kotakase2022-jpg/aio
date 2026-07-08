import type { ArticleDraft, ArticleImage, AuthorInput, FaqItem } from "@/types/aio";
import {
  articleContainsCanonicalSourceUrl,
  canonicalSourceUrlKey,
  decodeHtmlAmpersands,
  normalizeSourceUrl,
  sourceUrlCandidates,
} from "@/lib/source-url";

type BuildDraftArticleHtmlOptions = {
  imageUrlResolver?: (url: string) => string;
};

const authorSectionHeading = "この記事の執筆者";

export function buildDraftArticleHtml(
  draft: ArticleDraft,
  options: BuildDraftArticleHtmlOptions = {},
) {
  const withImages = replaceDraftImageReferences(draft.editedBodyHtml, draft.images, options);
  const withFaq = appendFaqBlockWhenNeeded(withImages, draft.faqItems);
  const withAuthor = appendAuthorBlockWhenNeeded(withFaq, draft.author, options);
  return appendSourceBlockWhenNeeded(withAuthor, draft);
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
  const items = faqItems
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question || item.answer);

  const withoutManagedFaq = removeManagedFaqBlock(html);
  if (items.length === 0) {
    return withoutManagedFaq;
  }

  const text = normalizeText(stripHtmlText(withoutManagedFaq));
  const itemsMissingFromBody = items.filter((item) => !faqItemAlreadyVisible(item, text));

  if (itemsMissingFromBody.length === 0) {
    return withoutManagedFaq;
  }

  return `${withoutManagedFaq}\n${buildFaqBlockHtml(itemsMissingFromBody)}`;
}

function faqItemAlreadyVisible(
  item: { question: string; answer: string },
  normalizedBodyText: string,
) {
  const questionVisible = item.question
    ? normalizedBodyText.includes(normalizeText(item.question))
    : true;
  const answerVisible = item.answer
    ? normalizedBodyText.includes(normalizeText(item.answer))
    : true;

  return questionVisible && answerVisible;
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

  return `${withoutManagedSources}\n${buildSourceBlockHtml(missingSources)}`;
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
  return [
    ...draft.aiResult.sources.map((source) => ({
      url: normalizeSourceUrl(source.url),
      title: source.title.trim(),
      usageNotes: source.usage_notes.trim(),
    })),
    ...draft.fetchedReferences.map((source) => ({
      url: normalizeSourceUrl(source.url),
      title: source.title?.trim() || source.url.trim(),
      usageNotes: source.ok ? "参照URLから本文を取得しました。" : source.reason?.trim() || "",
    })),
    ...draft.inputPayload.references.map((source) => ({
      url: normalizeSourceUrl(source.url ?? ""),
      title: source.url?.trim() || "",
      usageNotes: source.text?.trim() ? "入力フォームの参照情報です。" : "",
    })),
    ...draft.fetchedCompetitors.map((source) => ({
      url: normalizeSourceUrl(source.url),
      title: source.title?.trim() || source.url.trim(),
      usageNotes: source.ok ? "競合URLから本文を取得しました。" : source.reason?.trim() || "",
    })),
    ...draft.inputPayload.competitors.map((source) => ({
      url: normalizeSourceUrl(source.url ?? ""),
      title: source.url?.trim() || "",
      usageNotes: source.text?.trim() ? "入力フォームの競合情報です。" : "",
    })),
    ...(draft.competitorResearch?.insights ?? []).map((source) => ({
      url: normalizeSourceUrl(source.url),
      title: source.title.trim() || source.url.trim(),
      usageNotes: "AI競合調査で参照した競合情報です。",
    })),
  ]
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

function sourceUrlAlreadyVisible(url: string, html: string) {
  const normalizedHtml = decodeHtmlAmpersands(html);
  const candidates = sourceUrlCandidates(url);
  if (candidates.some((candidate) => normalizedHtml.includes(candidate))) {
    return true;
  }

  return articleContainsCanonicalSourceUrl(url, normalizedHtml);
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
