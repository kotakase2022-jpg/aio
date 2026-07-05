import type { ArticleDraft, ArticleImage, FaqItem } from "@/types/aio";

type BuildDraftArticleHtmlOptions = {
  imageUrlResolver?: (url: string) => string;
};

export function buildDraftArticleHtml(
  draft: ArticleDraft,
  options: BuildDraftArticleHtmlOptions = {},
) {
  const withImages = replaceDraftImageReferences(draft.editedBodyHtml, draft.images, options);
  return appendFaqBlockWhenNeeded(withImages, draft.faqItems);
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
  const questionItems = items.filter((item) => item.question);
  const allQuestionsAlreadyInBody =
    questionItems.length > 0 &&
    questionItems.every((item) => text.includes(normalizeText(item.question)));

  if (allQuestionsAlreadyInBody) {
    return withoutManagedFaq;
  }

  return `${withoutManagedFaq}\n${buildFaqBlockHtml(items)}`;
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

function removeManagedFaqBlock(html: string) {
  return html
    .replace(
      /<section\b[^>]*class=(["'])[^"']*\baio-faq-block\b[^"']*\1[^>]*>[\s\S]*?<\/section>/gi,
      "",
    )
    .trim();
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
