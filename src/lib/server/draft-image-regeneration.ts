import { sanitizeArticleHtml } from "@/lib/article-html";
import { createGeneratedArticleImage } from "@/lib/server/article-images";
import { getDraft, saveDraft } from "@/lib/server/drafts";
import { syncGenerationJobDraft } from "@/lib/server/generation-jobs";
import { ApiError } from "@/lib/server/http";
import { deleteStoredAssets } from "@/lib/server/storage";
import type { ArticleDraft, ArticleImage } from "@/types/aio";

export type DraftImageRegenerationRequest = {
  prompt: string;
  slot: ArticleImage["slot"];
  altText?: string;
  replaceImageId?: string;
};

export type DraftImageRegenerationFailure = {
  slot: ArticleImage["slot"];
  error: string;
};

type PreparedRequest = DraftImageRegenerationRequest & {
  previousImage?: ArticleImage;
  persistedPreviousImage?: ArticleImage;
};

export async function regenerateDraftImages({
  draft,
  requests,
  signal,
}: {
  draft: ArticleDraft;
  requests: DraftImageRegenerationRequest[];
  signal?: AbortSignal;
}) {
  const persistedDraft = await getDraft(draft.id);
  if (!persistedDraft) {
    throw new ApiError(
      "画像を紐づける下書きが見つかりません。",
      404,
      "ドラフトを保存してから画像を再作成してください。",
    );
  }
  const preparedRequests = prepareRequests(draft, persistedDraft, requests);
  const outcomes = await Promise.allSettled(
    preparedRequests.map(async (request) => ({
      request,
      image: await createGeneratedArticleImage({
        prompt: request.prompt,
        slot: request.slot,
        altText: request.altText,
        signal,
      }),
    })),
  );

  const fulfilled = outcomes.flatMap((outcome) =>
    outcome.status === "fulfilled" ? [outcome.value] : [],
  );
  const failures = outcomes.flatMap((outcome, index) =>
    outcome.status === "rejected"
      ? [
          {
            slot: preparedRequests[index].slot,
            error: readableError(outcome.reason),
          } satisfies DraftImageRegenerationFailure,
        ]
      : [],
  );

  if (fulfilled.length === 0) {
    throw new ApiError(
      failures[0]?.error || "画像再作成に失敗しました。",
      statusForFailures(outcomes),
      failures.map((failure) => `${failure.slot}: ${failure.error}`).join(" / "),
    );
  }

  const nextDraft = attachImagesToDraft(draft, fulfilled);
  const newPaths = fulfilled.map(({ image }) => image.path).filter(isStoragePath);
  let savedDraft: ArticleDraft;

  try {
    const saved = await saveDraft(nextDraft);
    savedDraft = saved.draft;
  } catch (error) {
    try {
      await deleteStoredAssets(newPaths);
    } catch (cleanupError) {
      throw new ApiError(
        "画像の再作成後にドラフト保存と画像整理の両方に失敗しました。",
        500,
        `${readableError(error)} / cleanup: ${readableError(cleanupError)}`,
      );
    }
    throw error;
  }

  const warnings: string[] = [];
  try {
    await syncGenerationJobDraft(savedDraft);
  } catch (error) {
    warnings.push(`生成ログの同期に失敗しました: ${readableError(error)}`);
  }

  const replacedPaths = fulfilled
    .map(({ request }) => request.persistedPreviousImage)
    .filter((image): image is ArticleImage => Boolean(image))
    .filter((image) => image.source === "generated")
    .map((image) => image.path)
    .filter(isStoragePath)
    .filter((objectPath) => !newPaths.includes(objectPath));

  try {
    await deleteStoredAssets([...new Set(replacedPaths)]);
  } catch (error) {
    warnings.push(`旧画像の整理に失敗しました: ${readableError(error)}`);
  }

  return {
    draft: savedDraft,
    images: fulfilled.map(({ image }) => image),
    failures,
    warnings,
  };
}

function prepareRequests(
  draft: ArticleDraft,
  persistedDraft: ArticleDraft,
  requests: DraftImageRegenerationRequest[],
): PreparedRequest[] {
  const slots = new Set<ArticleImage["slot"]>();
  const imageIds = new Set<string>();

  return requests.map((request) => {
    if (slots.has(request.slot)) {
      throw new ApiError(`画像枠 ${request.slot} が重複しています。`, 400);
    }
    slots.add(request.slot);

    if (!request.replaceImageId) {
      if (
        draft.images.some((image) => image.slot === request.slot) ||
        persistedDraft.images.some((image) => image.slot === request.slot)
      ) {
        throw new ApiError(
          `${request.slot} の画像はすでに存在します。置換対象を指定してください。`,
          409,
        );
      }
      return request;
    }

    if (imageIds.has(request.replaceImageId)) {
      throw new ApiError("同じ画像を複数回置換することはできません。", 400);
    }
    imageIds.add(request.replaceImageId);

    const previousImage = draft.images.find((image) => image.id === request.replaceImageId);
    const persistedPreviousImage = persistedDraft.images.find(
      (image) => image.id === request.replaceImageId,
    );
    if (!previousImage || !persistedPreviousImage) {
      throw new ApiError("置換対象の画像がドラフト内に見つかりません。", 404);
    }
    if (
      previousImage.slot !== request.slot ||
      persistedPreviousImage.slot !== request.slot
    ) {
      throw new ApiError("置換対象の画像枠が一致しません。", 409);
    }

    return { ...request, previousImage, persistedPreviousImage };
  });
}

function attachImagesToDraft(
  draft: ArticleDraft,
  fulfilled: Array<{ request: PreparedRequest; image: ArticleImage }>,
): ArticleDraft {
  let images = [...draft.images];
  let bodyHtml = draft.editedBodyHtml;

  for (const { request, image } of fulfilled) {
    if (request.previousImage) {
      images = images.map((current) =>
        current.id === request.previousImage?.id ? image : current,
      );
      bodyHtml = replaceImageReferences(bodyHtml, request.previousImage, image);
    } else {
      images.push(image);
      bodyHtml = injectImage(bodyHtml, image);
    }
  }

  return {
    ...draft,
    images: sortImages(images),
    editedBodyHtml: sanitizeArticleHtml(bodyHtml),
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

function replaceImageReferences(
  html: string,
  previousImage: ArticleImage,
  nextImage: ArticleImage,
) {
  let output = html;
  if (previousImage.url) {
    output = output.replaceAll(previousImage.url, nextImage.url);
  }
  return output.replaceAll(`aio-image:${previousImage.id}`, nextImage.url);
}

function injectImage(html: string, image: ArticleImage) {
  const figure = `<figure data-image-slot="${image.slot}" data-image-id="${image.id}"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.altText)}" /><figcaption>${escapeHtml(image.altText)}</figcaption></figure>`;
  return image.slot === "featured" ? `${figure}\n${html}` : `${html}\n${figure}`;
}

function sortImages(images: ArticleImage[]) {
  const order: Record<ArticleImage["slot"], number> = {
    featured: 0,
    "inline-1": 1,
    "inline-2": 2,
  };
  return [...images].sort((first, second) => order[first.slot] - order[second.slot]);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isStoragePath(value: string | undefined): value is string {
  return Boolean(value && value !== "data-url-omitted");
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function statusForFailures(outcomes: PromiseSettledResult<unknown>[]) {
  const firstFailure = outcomes.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
  );
  return firstFailure?.reason instanceof ApiError ? firstFailure.reason.status : 502;
}
