import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/server/http";
import { generateAioArticle } from "@/lib/server/article-generation";
import { createArticleImagesForDraft } from "@/lib/server/article-images";
import { fetchUrlContent } from "@/lib/server/content";
import { saveDraft } from "@/lib/server/drafts";
import {
  assertGenerationJobActive,
  getGenerationJob,
  updateGenerationJob,
  updateGenerationStep,
} from "@/lib/server/generation-jobs";
import type {
  AttachedFileInput,
  ArticleDraft,
  ArticleFormPayload,
  ArticleImage,
  FetchResult,
  KeyValueInput,
} from "@/types/aio";

export async function runArticleGenerationJob(jobId: string) {
  try {
    await updateGenerationJob(jobId, (job) =>
      job.status === "canceled"
        ? job
        : {
            ...job,
            status: "running",
            startedAt: job.startedAt ?? new Date().toISOString(),
          },
    );
    await assertGenerationJobActive(jobId);
    await updateGenerationStep(jobId, "fetch_refs", "running");
    const job = await requireJob(jobId);
    const fetchedReferences = await fetchInputs(
      job.inputPayload.references,
      job.inputPayload.referenceFiles ?? [],
    );
    await updateGenerationJob(jobId, (current) => ({
      ...current,
      fetchedReferences,
    }));
    await updateGenerationStep(
      jobId,
      "fetch_refs",
      "done",
      summarizeFetch(fetchedReferences, "参照URL"),
    );

    await assertGenerationJobActive(jobId);
    await updateGenerationStep(jobId, "fetch_competitors", "running");
    const fetchedCompetitors = await fetchInputs(
      job.inputPayload.competitors,
      job.inputPayload.competitorFiles ?? [],
    );
    await updateGenerationJob(jobId, (current) => ({
      ...current,
      fetchedCompetitors,
    }));
    await updateGenerationStep(
      jobId,
      "fetch_competitors",
      "done",
      summarizeFetch(fetchedCompetitors, "競合URL"),
    );

    await assertGenerationJobActive(jobId);
    await updateGenerationStep(jobId, "merge_research", "running");
    await updateGenerationStep(
      jobId,
      "merge_research",
      "done",
      job.competitorResearch ? "AI競合調査結果を統合" : "競合調査なしで続行",
    );

    await assertGenerationJobActive(jobId);
    await updateGenerationStep(jobId, "generate_outline", "running");
    await updateGenerationStep(jobId, "generate_body", "running");
    await updateGenerationStep(jobId, "generate_meta", "running");
    await updateGenerationStep(jobId, "image_prompts", "running");
    const freshJob = await requireJob(jobId);
    const article = await generateAioArticle({
      form: freshJob.inputPayload as unknown as Record<string, unknown>,
      fetchedReferences: freshJob.fetchedReferences as unknown as Array<Record<string, unknown>>,
      fetchedCompetitors: freshJob.fetchedCompetitors as unknown as Array<Record<string, unknown>>,
      competitorResearch:
        freshJob.competitorResearch as unknown as Record<string, unknown> | null | undefined,
    });
    await updateGenerationStep(jobId, "generate_outline", "done");
    await updateGenerationStep(jobId, "generate_body", "done");
    await updateGenerationStep(jobId, "generate_meta", "done");
    await updateGenerationStep(jobId, "image_prompts", "done");

    await assertGenerationJobActive(jobId);
    await updateGenerationStep(jobId, "images", "running");
    const images = await createArticleImagesForDraft(article, freshJob.inputPayload);
    await updateGenerationStep(jobId, "images", "done", `${images.length}枚を反映`);

    await assertGenerationJobActive(jobId);
    await updateGenerationStep(jobId, "save", "running");
    const now = new Date().toISOString();
    const bodyWithImages = injectImages(article.body_html, images);
    const nextDraft: ArticleDraft = {
      id: randomUUID(),
      inputPayload: stripRuntimeOnlyInput(freshJob.inputPayload),
      fetchedReferences: freshJob.fetchedReferences,
      fetchedCompetitors: freshJob.fetchedCompetitors,
      competitorResearch: freshJob.competitorResearch ?? undefined,
      aiResult: article,
      editedTitle: article.selected_title,
      editedSlug: article.suggested_slug,
      editedMetaDescription: article.meta_description,
      editedBodyHtml: bodyWithImages,
      faqItems: article.faq_items,
      tags: article.tags,
      categories: article.categories,
      images,
      author: freshJob.inputPayload.author,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    await saveDraft(nextDraft);
    await updateGenerationJob(jobId, (current) => ({
      ...current,
      status: "completed",
      draft: nextDraft,
      draftId: nextDraft.id,
      completedAt: new Date().toISOString(),
    }));
    await updateGenerationStep(jobId, "save", "done", "ドラフトを保存しました");
  } catch (error) {
    const current = await getGenerationJob(jobId);
    if (current?.status === "canceled") {
      return;
    }

    const message = error instanceof Error ? error.message : "記事生成に失敗しました。";
    await updateGenerationJob(jobId, (job) => ({
      ...job,
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
      steps: job.steps.map((step) =>
        step.status === "running" ? { ...step, status: "error", detail: message } : step,
      ),
    })).catch(() => undefined);
  }
}

async function requireJob(jobId: string) {
  const job = await getGenerationJob(jobId);
  if (!job) {
    throw new ApiError("Generation job not found.", 404);
  }

  return job;
}

async function fetchInputs(inputs: KeyValueInput[], files: AttachedFileInput[] = []) {
  const urls = inputs.map((item) => item.url?.trim()).filter(Boolean) as string[];
  const results: FetchResult[] = [];

  for (const url of urls) {
    try {
      results.push(await fetchUrlContent(url));
    } catch (error) {
      results.push({
        url,
        ok: false,
        reason: error instanceof Error ? error.message : "URL本文抽出に失敗しました。",
      });
    }
  }

  for (const item of inputs) {
    if (item.text?.trim()) {
      results.push({
        url: "manual-text",
        title: "手動入力テキスト",
        text: item.text.trim(),
        ok: true,
        sourceType: "manual",
      });
    }
  }

  for (const file of files) {
    if (file.ok && file.text?.trim()) {
      results.push({
        url: `file:${file.name}`,
        title: file.name,
        text: file.text.trim(),
        ok: true,
        sourceType: "file",
        fileName: file.name,
        fileType: file.type,
      });
      continue;
    }

    if (!file.ok) {
      results.push({
        url: `file:${file.name}`,
        title: file.name,
        ok: false,
        reason: file.error || "添付ファイルを解析できませんでした。",
        sourceType: "file",
        fileName: file.name,
        fileType: file.type,
      });
    }
  }

  return results;
}

function summarizeFetch(results: FetchResult[], label: string) {
  const urlResults = results.filter((result) => result.url !== "manual-text");
  const failed = urlResults.filter((result) => !result.ok);
  if (urlResults.length === 0) return `${label}なし`;
  if (failed.length === 0) return `${urlResults.length}件取得`;
  return `${urlResults.length - failed.length}件取得・${failed.length}件失敗`;
}

function injectImages(html: string, images: ArticleImage[]) {
  let output = html;
  const featured = images.find((image) => image.slot === "featured");
  const inline = images.filter((image) => image.slot !== "featured");

  if (featured) {
    output = `${imageFigure(featured)}\n${output}`;
  }

  inline.forEach((image) => {
    output += `\n${imageFigure(image)}`;
  });

  return output;
}

function imageFigure(image: ArticleImage) {
  return `<figure data-image-slot="${image.slot}" data-image-id="${image.id}"><img src="${escapeHtml(
    image.url,
  )}" alt="${escapeHtml(image.altText)}" /><figcaption>${escapeHtml(
    image.altText,
  )}</figcaption></figure>`;
}

function stripRuntimeOnlyInput(input: ArticleFormPayload): ArticleFormPayload {
  const rest = { ...input };
  delete rest.regenerationInstruction;
  return rest;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
