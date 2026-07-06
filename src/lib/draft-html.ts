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
    return replaceImageSrc(
      replaceImageSrc(currentHtml, `aio-image:${image.id}`, resolvedUrl),
      url,
      resolvedUrl,
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
  const hasCompleteAuthorSection = hasExistingAuthorSection(text, normalizedAuthor);

  // Keep an existing complete author section as-is unless an uploaded portrait must be injected.
  if (hasCompleteAuthorSection && !normalizedAuthor.imageUrl) {
    return withoutManagedAuthor;
  }

  // Otherwise render the managed author block. Strip any existing author section or a bare/orphan
  // "この記事の執筆者" heading first so the output does not end up with a duplicate heading.
  const base =
    hasCompleteAuthorSection || headingAlreadyVisible
      ? removeExistingAuthorProfileBlock(withoutManagedAuthor, normalizedAuthor)
      : withoutManagedAuthor;
  return `${base}\n${buildAuthorBlockHtml(normalizedAuthor, options)}`.trim();
}

function hasExistingAuthorSection(
  normalizedBodyText: string,
  author: Required<Pick<AuthorInput, "name" | "title" | "bio" | "imageUrl">>,
) {
  const headingAlreadyVisible = normalizedBodyText.includes(normalizeText(authorSectionHeading));
  const nameAlreadyVisible = author.name && normalizedBodyText.includes(normalizeText(author.name));
  const titleAlreadyVisible =
    author.title && normalizedBodyText.includes(normalizeText(author.title));
  const bioAlreadyVisible = author.bio && normalizedBodyText.includes(normalizeText(author.bio));

  // A bare "この記事の執筆者" heading with no actual author identity in the body is an
  // orphan/placeholder, not a complete author section. Require the author name to appear
  // alongside the heading (or a title/bio) before suppressing the managed author block, so
  // uploaded author name/title/bio are not silently dropped when only the heading exists.
  return Boolean(
    nameAlreadyVisible && (headingAlreadyVisible || titleAlreadyVisible || bioAlreadyVisible),
  );
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
    `<h[2-3][^>]*>\\s*${escapedHeading}\\s*<\\/h[2-3]>[\\s\\S]*?(?=<h[12]\\b|<section\\b|$)`,
    "i",
  );
  const withoutHeadingSection = html.replace(sectionWithHeading, "").replace(fromHeadingToNextSection, "");
  if (withoutHeadingSection !== html) {
    return withoutHeadingSection.trim();
  }

  const escapedName = author.name ? escapeRegExp(author.name) : "";
  if (!escapedName) {
    return html;
  }

  return html
    .replace(
      new RegExp(
        `<section\\b[^>]*>[\\s\\S]*?${escapedName}[\\s\\S]*?<\\/section>`,
        "i",
      ),
      "",
    )
    .trim();
}

function removeManagedFaqBlock(html: string) {
  return html
    .replace(
      /<section\b[^>]*class=(["'])[^"']*\baio-faq-block\b[^"']*\1[^>]*>[\s\S]*?<\/section>/gi,
      "",
    )
    .trim();
}

function removeManagedSourceBlock(html: string) {
  return html
    .replace(
      /<section\b[^>]*class=(["'])[^"']*\baio-source-block\b[^"']*\1[^>]*>[\s\S]*?<\/section>/gi,
      "",
    )
    .trim();
}

function removeManagedAuthorBlock(html: string) {
  return html
    .replace(
      /<section\b[^>]*class=(["'])[^"']*\baio-author-block\b[^"']*\1[^>]*>[\s\S]*?<\/section>/gi,
      "",
    )
    .trim();
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

function replaceImageSrc(html: string, from: string, to: string) {
  const escapedFrom = escapeRegExp(from);
  const escapedTo = escapeHtmlAttribute(to);
  return html.replace(new RegExp(`src=(["'])${escapedFrom}\\1`, "g"), `src="${escapedTo}"`);
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
