import { randomUUID } from "node:crypto";
import { generateImageBase64 } from "@/lib/server/openai";
import { storeAsset } from "@/lib/server/storage";
import type { ArticleFormPayload, ArticleGenerationResult, ArticleImage } from "@/types/aio";

export async function createGeneratedArticleImage({
  prompt,
  slot,
  altText,
}: {
  prompt: string;
  slot: "featured" | "inline-1" | "inline-2";
  altText?: string;
}) {
  const finalPrompt = buildProductionImagePrompt(prompt, slot);
  const imageBase64 = await generateImageBase64(finalPrompt);
  const stored = await storeAsset({
    buffer: Buffer.from(imageBase64, "base64"),
    contentType: "image/png",
    filename: `${slot}.png`,
    folder: "generated",
  });

  return {
    id: randomUUID(),
    slot,
    url: stored.url,
    path: stored.path,
    prompt: finalPrompt,
    altText: altText ?? "",
    source: "generated",
  } satisfies ArticleImage;
}

export async function createArticleImagesForDraft(
  article: ArticleGenerationResult,
  form: ArticleFormPayload,
  options: {
    onImageFailure?: (slot: "featured" | "inline-1" | "inline-2", error: unknown) => void;
  } = {},
) {
  const imageCount = normalizeImageCount(form.imageCount);
  if (imageCount === 0) {
    return [];
  }

  if (form.visualTone.mode === "upload" && form.visualTone.uploadedImageUrl) {
    return [
      {
        id: randomUUID(),
        slot: "featured" as const,
        url: form.visualTone.uploadedImageUrl,
        path: form.visualTone.uploadedImagePath,
        prompt: form.visualTone.uploadedImageName || "Uploaded article image",
        altText: article.selected_title,
        source: "uploaded" as const,
      },
    ];
  }

  const toneText =
    form.visualTone.mode === "custom" ? form.visualTone.custom : form.visualTone.preset;
  const prompts = article.image_prompts.slice(0, imageCount).map((prompt) => ({
    ...prompt,
    prompt: buildArticleImagePrompt(prompt.prompt, toneText),
  }));

  const results = await Promise.allSettled(
    prompts.map((prompt) =>
      createGeneratedArticleImage({
        prompt: prompt.prompt,
        slot: prompt.slot,
        altText: prompt.alt_text,
      }),
    ),
  );

  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    options.onImageFailure?.(prompts[index].slot, result.reason);
    return [];
  });
}

export function buildProductionImagePrompt(
  prompt: string,
  slot: "featured" | "inline-1" | "inline-2",
) {
  const slotDirection =
    slot === "featured"
      ? "Create a 3:2 landscape hero image with one strong focal concept and enough clean negative space for an article header."
      : "Create a 3:2 landscape inline explanatory visual: one clean concept, diagram-like composition, simple abstract cards, arrows, or icons without readable labels.";

  return [
    prompt.trim(),
    "",
    "Production quality requirements:",
    slotDirection,
    "The image must look like a premium Japanese B2B SaaS, consulting, or financial whitepaper visual, suitable for an enterprise article.",
    "Use a refined editorial composition, crisp geometry, coherent perspective, balanced margins, subtle depth, and polished lighting.",
    "Prefer a clean white or light-gray base with restrained accent colors that match the requested tone. Avoid cheap stock-photo aesthetics.",
    "Do not include readable text, random letters, logos, watermarks, fake UI screenshots, cluttered charts, distorted hands, or unnecessary faces.",
    "Avoid dark blurry abstract backgrounds, neon overload, cartoon clip-art, and generic AI-art poster styling unless explicitly requested.",
  ].join("\n");
}

function buildArticleImagePrompt(basePrompt: string, toneText?: string) {
  return [
    basePrompt,
    "",
    `Visual tone from user: ${toneText || "clean Japanese B2B whitepaper editorial style"}`,
    "Create a premium 3:2 landscape editorial visual for a Japanese B2B article.",
    "Use a refined whitepaper/SaaS/consulting composition with clean geometry, subtle depth, balanced margins, and a clear focal concept.",
    "Avoid text-heavy layouts, readable text, random letters, logos, watermarks, fake UI screenshots, cluttered charts, unnecessary people, and cheap stock-photo aesthetics.",
  ].join("\n");
}

function normalizeImageCount(value: unknown) {
  const parsed = Number(value);
  return [0, 1, 2, 3].includes(parsed) ? parsed : 2;
}
