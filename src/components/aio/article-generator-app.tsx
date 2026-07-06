"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Sparkles,
  StopCircle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  evaluateArticleQuality,
  type ArticleQualityEvaluation,
} from "@/lib/article-quality";
import { formatJaDateTime } from "@/lib/date";
import { buildDraftArticleHtml } from "@/lib/draft-html";
import { evaluateFaqQuality } from "@/lib/faq-quality";
import { qualityRegenerationAction } from "@/lib/quality-regeneration-action";
import { evaluateTitleQuality } from "@/lib/title-quality";
import { cn, joinCsv, splitCsv } from "@/lib/utils";
import type {
  AttachedFileInput,
  ArticleDraft,
  ArticleFormPayload,
  ArticleGenerationResult,
  ArticleImage,
  AuthorInput,
  CompetitorResearchResult,
  FetchResult,
  FaqItem,
  GenerationJob,
  GenerationLogSummary,
  GenerationStep,
  ImageCount,
  KeyValueInput,
  ThemeCandidate,
  ThemeCandidateResult,
  VisualToneInput,
  WordCount,
  WordpressConnection,
} from "@/types/aio";

const activeGenerationJobStorageKey = "aio-active-generation-job-id";
const lastClosingTextStorageKey = "aio-last-closing-text";
const lastAuthorStorageKey = "aio-last-author";

const tonePresets = [
  "シンプルなBtoBホワイトペーパー風",
  "金融機関向けの信頼感あるトーン",
  "SaaSプロダクト紹介風",
  "コンサルティング資料風",
  "近未来的なAI/テクノロジー風",
  "温かみのある中小企業支援風",
  "ミニマルな図解・インフォグラフィック風",
];

const imageCountOptions: ImageCount[] = [0, 1, 2, 3];
const wordCountOptions: WordCount[] = [1000, 2000, 3000, 4000, 5000, 6000];

const generationSteps: GenerationStep[] = [
  { id: "fetch_refs", label: "参照URL本文抽出", status: "pending" },
  { id: "fetch_competitors", label: "競合URL本文抽出", status: "pending" },
  { id: "merge_research", label: "競合調査統合", status: "pending" },
  { id: "generate_outline", label: "記事構成案生成", status: "pending" },
  { id: "generate_body", label: "AIO本文生成", status: "pending" },
  { id: "generate_meta", label: "タイトル・メタ・FAQ生成", status: "pending" },
  { id: "image_prompts", label: "画像プロンプト生成", status: "pending" },
  { id: "images", label: "画像生成または反映", status: "pending" },
  { id: "save", label: "ドラフト保存", status: "pending" },
];

type ApiResult<T> = T & { ok: boolean; error?: string; detail?: string };

const blankInput = (): KeyValueInput => ({ id: crypto.randomUUID(), url: "", text: "" });

export function ArticleGeneratorApp() {
  const [references, setReferences] = useState<KeyValueInput[]>([blankInput()]);
  const [competitors, setCompetitors] = useState<KeyValueInput[]>([blankInput()]);
  const [referenceFiles, setReferenceFiles] = useState<AttachedFileInput[]>([]);
  const [competitorFiles, setCompetitorFiles] = useState<AttachedFileInput[]>([]);
  const [theme, setTheme] = useState("");
  const [primaryInfo, setPrimaryInfo] = useState("");
  const [closingText, setClosingText] = useState("");
  const [closingReuseChecked, setClosingReuseChecked] = useState(false);
  const [closingReuseMessage, setClosingReuseMessage] = useState("");
  const [author, setAuthor] = useState<AuthorInput>({});
  const [authorReuseChecked, setAuthorReuseChecked] = useState(false);
  const [authorReuseMessage, setAuthorReuseMessage] = useState("");
  const [visualTone, setVisualTone] = useState<VisualToneInput>({
    mode: "preset",
    preset: tonePresets[0],
  });
  const [imageCount, setImageCount] = useState<ImageCount>(2);
  const [wordCount, setWordCount] = useState<WordCount>(3000);
  const [competitorResearch, setCompetitorResearch] =
    useState<CompetitorResearchResult | null>(null);
  const [competitorJson, setCompetitorJson] = useState("");
  const [competitorJsonError, setCompetitorJsonError] = useState("");
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [themeCandidateLoading, setThemeCandidateLoading] = useState(false);
  const [themeCandidates, setThemeCandidates] = useState<ThemeCandidateResult | null>(null);
  const [themeCandidateError, setThemeCandidateError] = useState("");
  const [themeCandidateApplyMessage, setThemeCandidateApplyMessage] = useState("");
  const [themeCandidateAppliedIndex, setThemeCandidateAppliedIndex] = useState<number | null>(null);
  const [referenceFileUploading, setReferenceFileUploading] = useState(false);
  const [competitorFileUploading, setCompetitorFileUploading] = useState(false);
  const [steps, setSteps] = useState<GenerationStep[]>(generationSteps);
  const [activeError, setActiveError] = useState("");
  const [fetchedReferences, setFetchedReferences] = useState<FetchResult[]>([]);
  const [fetchedCompetitors, setFetchedCompetitors] = useState<FetchResult[]>([]);
  const [draft, setDraft] = useState<ArticleDraft | null>(null);
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  const [activeGenerationJobId, setActiveGenerationJobId] = useState<string | null>(null);
  const [generationLogs, setGenerationLogs] = useState<GenerationLogSummary[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftActionMessage, setDraftActionMessage] = useState("");
  const [draftActionError, setDraftActionError] = useState("");
  const [posting, setPosting] = useState(false);
  const [imageRegenerating, setImageRegenerating] = useState(false);
  const [imageRegenerationDialogOpen, setImageRegenerationDialogOpen] = useState(false);
  const [imageRegenerationInstruction, setImageRegenerationInstruction] = useState("");
  const [imageRegenerationProgress, setImageRegenerationProgress] = useState(0);
  const [articleRegenerationDialogOpen, setArticleRegenerationDialogOpen] = useState(false);
  const [articleRegenerationInstruction, setArticleRegenerationInstruction] = useState("");
  const [singleImageDialogOpen, setSingleImageDialogOpen] = useState(false);
  const [singleImageTarget, setSingleImageTarget] = useState<ArticleImage | null>(null);
  const [singleImageInstruction, setSingleImageInstruction] = useState("");
  const [singleImageRegenerating, setSingleImageRegenerating] = useState(false);
  const [singleImageProgress, setSingleImageProgress] = useState(0);
  const [connection, setConnection] = useState<WordpressConnection | null>(null);
  const [isFullscreenPreviewOpen, setFullscreenPreviewOpen] = useState(false);
  const [wpConnectionError, setWpConnectionError] = useState("");
  const [wpConnectionMessage, setWpConnectionMessage] = useState("");
  const [wpPostMessage, setWpPostMessage] = useState("");
  const [wpForm, setWpForm] = useState({
    siteUrl: "",
    username: "",
    applicationPassword: "",
    status: "draft" as "draft" | "publish",
  });
  const generationAbortRef = useRef<AbortController | null>(null);
  const generationPollingRef = useRef<string | null>(null);
  const themeCandidateApplyTimerRef = useRef<number | null>(null);

  const formPayload: ArticleFormPayload = useMemo(
    () => ({
      references,
      competitors,
      referenceFiles,
      competitorFiles,
      theme,
      primaryInfo,
      closingText,
      author,
      visualTone,
      imageCount,
      wordCount,
    }),
    [
      author,
      closingText,
      competitorFiles,
      competitors,
      imageCount,
      primaryInfo,
      referenceFiles,
      references,
      theme,
      visualTone,
      wordCount,
    ],
  );

  const canGenerate = useMemo(() => {
    const hasReference =
      references.some((item) => item.url?.trim() || item.text?.trim()) ||
      referenceFiles.some((file) => file.ok && file.text?.trim());
    const hasTone =
      (visualTone.mode === "preset" && visualTone.preset) ||
      (visualTone.mode === "custom" && visualTone.custom?.trim()) ||
      (visualTone.mode === "upload" && visualTone.uploadedImageUrl);
    return Boolean(hasReference && hasTone);
  }, [referenceFiles, references, visualTone]);
  const generateRequirementMessage = useMemo(() => {
    if (canGenerate) return "";

    const missing: string[] = [];
    const hasReference =
      references.some((item) => item.url?.trim() || item.text?.trim()) ||
      referenceFiles.some((file) => file.ok && file.text?.trim());
    const hasTone =
      (visualTone.mode === "preset" && visualTone.preset) ||
      (visualTone.mode === "custom" && visualTone.custom?.trim()) ||
      (visualTone.mode === "upload" && visualTone.uploadedImageUrl);

    if (!hasReference) missing.push("参照情報");
    if (!hasTone) missing.push("画像トーン");

    return `${missing.join("と")}を入力すると記事作成を開始できます。`;
  }, [canGenerate, referenceFiles, references, visualTone]);

  const isGenerating = Boolean(activeGenerationJobId);

  useEffect(() => {
    void loadGenerationLogs();

    const storedJobId = window.localStorage.getItem(activeGenerationJobStorageKey);
    if (storedJobId) {
      generationPollingRef.current = storedJobId;
      window.setTimeout(() => {
        void pollGenerationJob(storedJobId);
      }, 0);
    }
    // Run once on mount to resume a server-side job that may outlive the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (themeCandidateApplyTimerRef.current) {
        window.clearTimeout(themeCandidateApplyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!researchLoading) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsedRatio = (Date.now() - startedAt) / 30000;
      const nextProgress = Math.min(92, 8 + elapsedRatio * 84);
      setResearchProgress((current) => Math.max(current, Math.round(nextProgress)));
    }, 500);

    return () => window.clearInterval(timer);
  }, [researchLoading]);

  useEffect(() => {
    if (!isFullscreenPreviewOpen) return;

    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreenPreviewOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isFullscreenPreviewOpen]);

  useEffect(() => {
    if (!imageRegenerating) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsedRatio = (Date.now() - startedAt) / 60000;
      const nextProgress = Math.min(92, 10 + elapsedRatio * 82);
      setImageRegenerationProgress((current) =>
        Math.max(current, Math.round(nextProgress)),
      );
    }, 700);

    return () => window.clearInterval(timer);
  }, [imageRegenerating]);

  useEffect(() => {
    if (!singleImageRegenerating) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsedRatio = (Date.now() - startedAt) / 60000;
      const nextProgress = Math.min(92, 10 + elapsedRatio * 82);
      setSingleImageProgress((current) => Math.max(current, Math.round(nextProgress)));
    }, 700);

    return () => window.clearInterval(timer);
  }, [singleImageRegenerating]);

  async function runCompetitorResearch() {
    setResearchLoading(true);
    setResearchProgress(8);
    setActiveError("");
    try {
      const result = await apiPost<{ result: CompetitorResearchResult }>(
        "/api/competitor-research",
        {
          references,
          competitors,
          referenceFiles,
          competitorFiles,
          theme,
          keywords: theme,
        },
      );
      setCompetitorResearch(result.result);
      setCompetitorJson(JSON.stringify(result.result, null, 2));
      setCompetitorJsonError("");
      setResearchProgress(100);
    } catch (error) {
      setResearchProgress(0);
      setActiveError(readError(error));
    } finally {
      setResearchLoading(false);
    }
  }

  async function generateThemeCandidates() {
    setThemeCandidateLoading(true);
    setThemeCandidateError("");
    setThemeCandidateApplyMessage("");
    setThemeCandidateAppliedIndex(null);
    setActiveError("");
    try {
      const editableResearch = parseCompetitorResearch();
      const result = await apiPost<{ result: ThemeCandidateResult }>("/api/theme-candidates", {
        references,
        competitors,
        referenceFiles,
        competitorFiles,
        competitorResearch: editableResearch,
        currentTheme: theme,
      });
      setThemeCandidates(result.result);
    } catch (error) {
      setThemeCandidateError(readError(error));
    } finally {
      setThemeCandidateLoading(false);
    }
  }

  async function generateArticle(regenerationInstruction = "") {
    if (!canGenerate) {
      setActiveError("参照情報と画像トーンを入力してください。");
      return;
    }

    const trimmedRegenerationInstruction = regenerationInstruction.trim();
    const previousDraft = draft;
    const isRegeneration = Boolean(trimmedRegenerationInstruction && previousDraft);
    const effectiveFormPayload = trimmedRegenerationInstruction
      ? {
          ...formPayload,
          regenerationInstruction: trimmedRegenerationInstruction,
        }
      : formPayload;
    let editableResearch: CompetitorResearchResult | null;
    try {
      editableResearch = parseCompetitorResearch();
    } catch (error) {
      setActiveError(readError(error));
      return;
    }

    if (typeof window !== "undefined") {
      setActiveError("");
      setDraft(isRegeneration ? previousDraft : null);
      setTab("preview");
      setSteps(generationSteps);
      setFetchedReferences([]);
      setFetchedCompetitors([]);
      persistReusableInputs(effectiveFormPayload);

      try {
        updateStep("fetch_refs", "running", "サーバー側ジョブを開始しています");
        const started = await apiPost<{ job: GenerationJob }>("/api/generation-jobs", {
          form: effectiveFormPayload,
          competitorResearch: editableResearch,
        });

        setActiveGenerationJobId(started.job.id);
        generationPollingRef.current = started.job.id;
        window.localStorage.setItem(activeGenerationJobStorageKey, started.job.id);
        applyGenerationJob(started.job);
        await pollGenerationJob(started.job.id);
      } catch (error) {
        if (isRegeneration && previousDraft) {
          setDraft(previousDraft);
        }
        setActiveError(readError(error));
        markRunningAsError(readError(error));
      }
      return;
    }

    const controller = new AbortController();
    generationAbortRef.current = controller;
    const { signal } = controller;

    setActiveError("");
    setDraft(isRegeneration ? previousDraft : null);
    setTab("preview");
    setSteps(generationSteps);

    try {
      updateStep("fetch_refs", "running");
      const referenceResults = await fetchInputs(references, referenceFiles, signal);
      throwIfAborted(signal);
      setFetchedReferences(referenceResults);
      updateStep(
        "fetch_refs",
        "done",
        summarizeFetch(referenceResults, "参照URL"),
      );

      updateStep("fetch_competitors", "running");
      const competitorResults = await fetchInputs(competitors, competitorFiles, signal);
      throwIfAborted(signal);
      setFetchedCompetitors(competitorResults);
      updateStep(
        "fetch_competitors",
        "done",
        summarizeFetch(competitorResults, "競合URL"),
      );

      updateStep("merge_research", "running");
      updateStep(
        "merge_research",
        "done",
        editableResearch ? "AI競合調査結果を統合" : "競合調査なしで続行",
      );

      updateStep("generate_outline", "running");
      updateStep("generate_body", "running");
      updateStep("generate_meta", "running");
      updateStep("image_prompts", "running");
      const article = await apiPost<{ result: ArticleGenerationResult }>(
        "/api/generate-article",
        {
          form: effectiveFormPayload,
          fetchedReferences: referenceResults,
          fetchedCompetitors: competitorResults,
          competitorResearch: editableResearch,
        },
        { signal },
      );
      throwIfAborted(signal);
      updateStep("generate_outline", "done");
      updateStep("generate_body", "done");
      updateStep("generate_meta", "done");
      updateStep("image_prompts", "done");

      updateStep("images", "running");
      const images = await createArticleImages(article.result, signal);
      throwIfAborted(signal);
      updateStep("images", "done", `${images.length}枚を反映`);

      updateStep("save", "running");
      const now = new Date().toISOString();
      const bodyWithImages = injectImages(article.result.body_html, images);
      const nextDraft: ArticleDraft = {
        id: crypto.randomUUID(),
        inputPayload: formPayload,
        fetchedReferences: referenceResults,
        fetchedCompetitors: competitorResults,
        competitorResearch: editableResearch ?? undefined,
        aiResult: article.result,
        editedTitle: article.result.selected_title,
        editedSlug: article.result.suggested_slug,
        editedMetaDescription: article.result.meta_description,
        editedBodyHtml: bodyWithImages,
        faqItems: article.result.faq_items,
        tags: article.result.tags,
        categories: article.result.categories,
        images,
        author,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      const saved = await apiPost<{ draft: ArticleDraft; storageMode: string }>(
        "/api/save-draft",
        { draft: prepareDraftForSave(nextDraft) },
        { signal },
      );
      throwIfAborted(signal);
      setDraft({ ...nextDraft, updatedAt: saved.draft.updatedAt });
      updateStep("save", "done", `保存先: ${saved.storageMode}`);
    } catch (error) {
      if (isAbortError(error)) {
        if (isRegeneration && previousDraft) {
          setDraft(previousDraft);
        }
        setActiveError("記事作成を停止しました。");
        markRunningAsError("ユーザー操作により停止しました。");
        return;
      }

      if (isRegeneration && previousDraft) {
        setDraft(previousDraft);
      }
      setActiveError(readError(error));
      markRunningAsError(readError(error));
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null;
      }
    }
  }

  async function stopGeneration() {
    const jobId = activeGenerationJobId;
    if (jobId) {
      try {
        await apiPost<{ job: GenerationJob }>(`/api/generation-jobs/${jobId}/cancel`, {});
      } catch (error) {
        setActiveError(`記事作成の停止に失敗しました。${readError(error)}`);
        void loadGenerationLogs();
        return;
      }
      generationPollingRef.current = null;
      setActiveGenerationJobId(null);
      window.localStorage.removeItem(activeGenerationJobStorageKey);
      setActiveError("記事作成を停止しました。");
      markRunningAsError("ユーザー操作により停止しました。");
      void loadGenerationLogs();
      return;
    }

    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setActiveError("記事作成を停止しました。");
    markRunningAsError("ユーザー操作により停止しました。");
  }

  function handlePrimaryArticleButton() {
    if (isGenerating) {
      stopGeneration();
      return;
    }

    if (draft) {
      setArticleRegenerationInstruction("");
      setArticleRegenerationDialogOpen(true);
      return;
    }

    void generateArticle();
  }

  async function startArticleRegeneration() {
    setArticleRegenerationDialogOpen(false);
    await generateArticle(articleRegenerationInstruction);
  }

  async function pollGenerationJob(jobId: string) {
    generationPollingRef.current = jobId;
    setActiveGenerationJobId(jobId);

    try {
      while (generationPollingRef.current === jobId) {
        const result = await apiGet<{ job: GenerationJob }>(`/api/generation-jobs/${jobId}`);
        applyGenerationJob(result.job);

        if (result.job.status === "completed") {
          finishGenerationPolling(jobId);
          if (result.job.draft) {
            setDraft(result.job.draft);
            setTab("preview");
          }
          void loadGenerationLogs();
          return;
        }

        if (result.job.status === "failed" || result.job.status === "canceled") {
          finishGenerationPolling(jobId);
          setActiveError(result.job.error || "記事生成に失敗しました。");
          void loadGenerationLogs();
          return;
        }

        await delay(1800);
      }
    } catch (error) {
      if (generationPollingRef.current !== jobId) return;

      finishGenerationPolling(jobId);
      setActiveError(readError(error));
      markRunningAsError(readError(error));
      void loadGenerationLogs();
    }
  }

  function finishGenerationPolling(jobId: string) {
    if (generationPollingRef.current === jobId) {
      generationPollingRef.current = null;
    }
    setActiveGenerationJobId((current) => (current === jobId ? null : current));
    if (window.localStorage.getItem(activeGenerationJobStorageKey) === jobId) {
      window.localStorage.removeItem(activeGenerationJobStorageKey);
    }
  }

  function applyGenerationJob(job: GenerationJob) {
    setSteps(mergeJobSteps(job.steps));
    setFetchedReferences(job.fetchedReferences ?? []);
    setFetchedCompetitors(job.fetchedCompetitors ?? []);

    const hydratedDraft = hydrateDraftFromGenerationJob(job);
    if (hydratedDraft) {
      setDraft(hydratedDraft);
    }
  }

  function mergeJobSteps(jobSteps: GenerationStep[]) {
    return generationSteps.map((baseStep) => {
      const jobStep = jobSteps.find((step) => step.id === baseStep.id);
      return jobStep ? { ...baseStep, ...jobStep, label: jobStep.label || baseStep.label } : baseStep;
    });
  }

  async function loadGenerationLogs() {
    setLogsLoading(true);
    setLogsError("");
    try {
      const result = await apiGet<{ logs: GenerationLogSummary[] }>("/api/generation-logs");
      setGenerationLogs(result.logs);
    } catch (error) {
      setLogsError(readError(error));
    } finally {
      setLogsLoading(false);
    }
  }

  async function openGenerationLog(jobId: string) {
    setActiveError("");
    try {
      const result = await apiGet<{ job: GenerationJob }>(`/api/generation-jobs/${jobId}`);
      applyGenerationJob(result.job);
      if (hydrateDraftFromGenerationJob(result.job)) {
        setTab("preview");
      }
    } catch (error) {
      setActiveError(readError(error));
    }
  }

  async function saveCurrentDraft() {
    if (!draft) return;
    const validationMessage = validateDraftForSubmission(draft);
    if (validationMessage) {
      setActiveError("");
      setDraftActionMessage("");
      setDraftActionError(validationMessage);
      setTab("edit");
      return;
    }
    setSaving(true);
    setActiveError("");
    setDraftActionMessage("");
    setDraftActionError("");
    try {
      const saved = await apiPost<{ draft: ArticleDraft }>("/api/save-draft", {
        draft: prepareDraftForSave(draft),
      });
      setDraft({ ...draft, updatedAt: saved.draft.updatedAt });
      setDraftActionMessage("編集内容を保存しました。");
    } catch (error) {
      setActiveError(readError(error));
    } finally {
      setSaving(false);
    }
  }

  async function approveCurrentDraft() {
    if (!draft) return;
    const validationMessage = validateDraftForSubmission(draft);
    if (validationMessage) {
      setActiveError("");
      setDraftActionMessage("");
      setDraftActionError(validationMessage);
      setTab("edit");
      return;
    }
    setSaving(true);
    setActiveError("");
    setDraftActionMessage("");
    setDraftActionError("");
    try {
      const approved = await apiPost<{ draft: ArticleDraft }>("/api/approve-draft", {
        draftId: draft.id,
        draft: prepareDraftForSave(draft),
      });
      setDraft({
        ...draft,
        status: "approved",
        updatedAt: approved.draft.updatedAt,
      });
      setDraftActionMessage("承認済みに変更しました。WordPress投稿が可能です。");
    } catch (error) {
      setActiveError(readError(error));
    } finally {
      setSaving(false);
    }
  }

  function updateWordpressForm(patch: Partial<typeof wpForm>) {
    setWpConnectionError("");
    setWpConnectionMessage("");
    setWpPostMessage("");
    setWpForm((current) => ({
      ...current,
      ...patch,
    }));
  }

  async function connectWordpress() {
    setActiveError("");
    setWpConnectionError("");
    setWpConnectionMessage("");
    setWpPostMessage("");
    const validationMessage = validateWordpressForm(wpForm);
    if (validationMessage) {
      setWpConnectionError(validationMessage);
      return;
    }

    try {
      const result = await apiPost<{ connection: WordpressConnection }>(
        "/api/wordpress/connect",
        wpForm,
      );
      setConnection(result.connection);
      setWpForm((current) => ({ ...current, applicationPassword: "" }));
      setWpConnectionMessage("WordPress接続情報を保存しました。");
    } catch (error) {
      setWpConnectionError(normalizeWordpressConnectionError(readError(error)));
    }
  }

  async function postToWordpress() {
    if (!draft || !connection) return;
    const validationMessage = validateDraftForSubmission(draft);
    if (validationMessage) {
      setActiveError("");
      setWpPostMessage("");
      setDraftActionMessage("");
      setDraftActionError(validationMessage);
      setTab("edit");
      return;
    }
    setPosting(true);
    setActiveError("");
    setWpPostMessage("");
    setDraftActionError("");
    try {
      const result = await apiPost<{ postUrl: string; draft: ArticleDraft }>(
        "/api/wordpress/post",
        {
          draft: prepareDraftForSave(draft),
          connectionId: connection.id,
          connection,
          status: wpForm.status,
        },
      );
      setDraft({
        ...draft,
        status: result.draft.status,
        wordpressPostUrl: result.postUrl || result.draft.wordpressPostUrl,
        updatedAt: result.draft.updatedAt,
      });
      void loadGenerationLogs();
      setWpPostMessage(
        wpForm.status === "publish"
          ? "WordPressへ公開投稿しました。"
          : "WordPressへ下書き投稿しました。",
      );
    } catch (error) {
      setActiveError(readError(error));
    } finally {
      setPosting(false);
    }
  }

  async function uploadAuthorImage(file: File | null) {
    if (!file) return;
    setActiveError("");
    try {
      const uploaded = await uploadImage(file, "authors");
      setAuthor((current) => ({
        ...current,
        imageUrl: uploaded.url,
        imagePath: uploaded.path,
      }));
    } catch (error) {
      setActiveError(readError(error));
    }
  }

  async function uploadToneImage(file: File | null) {
    if (!file) return;
    setActiveError("");
    try {
      const uploaded = await uploadImage(file, "article-inserts");
      setVisualTone({
        mode: "upload",
        uploadedImageUrl: uploaded.url,
        uploadedImagePath: uploaded.path,
        uploadedImageName: uploaded.filename,
      });
    } catch (error) {
      setActiveError(readError(error));
    }
  }

  async function uploadAttachmentFiles(files: FileList | null, target: "reference" | "competitor") {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) return;

    const setUploading =
      target === "reference" ? setReferenceFileUploading : setCompetitorFileUploading;
    const setFileState = target === "reference" ? setReferenceFiles : setCompetitorFiles;

    setUploading(true);
    setActiveError("");
    try {
      const extractedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          try {
            const result = await extractAttachment(file);
            return result.attachment;
          } catch (error) {
            return {
              id: crypto.randomUUID(),
              name: file.name,
              type: file.type || "application/octet-stream",
              size: file.size,
              ok: false,
              textLength: 0,
              error: readError(error),
              extractedAt: new Date().toISOString(),
            } satisfies AttachedFileInput;
          }
        }),
      );

      setFileState((current) => mergeAttachmentRetries(current, extractedFiles));
    } finally {
      setUploading(false);
    }
  }

  function removeAttachmentFile(id: string, target: "reference" | "competitor") {
    const setFileState = target === "reference" ? setReferenceFiles : setCompetitorFiles;
    setFileState((current) => current.filter((file) => file.id !== id));
  }

  function applyThemeCandidate(candidate: ThemeCandidate, index: number) {
    setTheme(
      [
        `テーマ: ${candidate.title}`,
        `キーワード: ${candidate.keywords.join(", ")}`,
        `想定読者: ${candidate.targetReader}`,
        `検索意図: ${candidate.searchIntent}`,
        `記事の狙い: ${candidate.angle}`,
      ].join("\n"),
    );
    setThemeCandidateApplyMessage("反映しました。");
    setThemeCandidateAppliedIndex(index);
    if (themeCandidateApplyTimerRef.current) {
      window.clearTimeout(themeCandidateApplyTimerRef.current);
    }
    themeCandidateApplyTimerRef.current = window.setTimeout(() => {
      setThemeCandidateApplyMessage("");
      setThemeCandidateAppliedIndex(null);
      themeCandidateApplyTimerRef.current = null;
    }, 2200);
  }

  function togglePreviousClosing(checked: boolean) {
    setClosingReuseChecked(checked);
    setClosingReuseMessage("");
    if (!checked) return;

    const previous = window.localStorage.getItem(lastClosingTextStorageKey);
    if (!previous?.trim()) {
      setClosingReuseMessage("前回の結び文章はまだ保存されていません。");
      return;
    }

    setClosingText(previous);
    setClosingReuseMessage("前回の結び文章を反映しました。");
  }

  function togglePreviousAuthor(checked: boolean) {
    setAuthorReuseChecked(checked);
    setAuthorReuseMessage("");
    if (!checked) return;

    const previous = window.localStorage.getItem(lastAuthorStorageKey);
    if (!previous) {
      setAuthorReuseMessage("前回の執筆者情報はまだ保存されていません。");
      return;
    }

    try {
      const parsed = JSON.parse(previous) as AuthorInput;
      setAuthor(parsed);
      setAuthorReuseMessage("前回の執筆者情報を反映しました。");
    } catch {
      setAuthorReuseMessage("前回の執筆者情報を読み込めませんでした。");
    }
  }

  function persistReusableInputs(payload: ArticleFormPayload) {
    if (payload.closingText.trim()) {
      window.localStorage.setItem(lastClosingTextStorageKey, payload.closingText);
    }

    const hasAuthor =
      payload.author.name?.trim() ||
      payload.author.title?.trim() ||
      payload.author.bio?.trim() ||
      payload.author.imageUrl;
    if (hasAuthor) {
      window.localStorage.setItem(lastAuthorStorageKey, JSON.stringify(payload.author));
    }
  }

  async function regenerateSingleImage(image: ArticleImage, instruction = "") {
    if (!draft) return;

    const result = await apiPost<{ image: ArticleImage }>("/api/generate-image", {
      prompt: buildImageRegenerationPrompt(image.prompt, instruction.trim(), draft.aiResult),
      slot: image.slot,
      altText: image.altText,
    });
    const nextImages = draft.images.map((item) =>
      item.id === image.id ? result.image : item,
    );
    setDraft({
      ...draft,
      images: nextImages,
      editedBodyHtml: replaceImageReferences(draft.editedBodyHtml, image, result.image),
      updatedAt: new Date().toISOString(),
    });
    return result.image;
  }

  function openSingleImageRegeneration(image: ArticleImage) {
    setSingleImageTarget(image);
    setSingleImageInstruction("");
    setSingleImageProgress(0);
    setSingleImageDialogOpen(true);
  }

  async function startSingleImageRegeneration() {
    if (!singleImageTarget) return;

    setSingleImageRegenerating(true);
    setSingleImageProgress(10);
    setActiveError("");
    try {
      const nextImage = await regenerateSingleImage(singleImageTarget, singleImageInstruction);
      if (nextImage) {
        setSingleImageTarget(nextImage);
      }
      setSingleImageProgress(100);
    } catch (error) {
      setActiveError(readError(error));
      setSingleImageProgress(0);
    } finally {
      setSingleImageRegenerating(false);
    }
  }

  async function regenerateGeneratedImages(instruction = "") {
    if (!draft) return;

    const generatedImages = draft.images.filter((image) => image.source === "generated");
    if (generatedImages.length === 0) {
      setActiveError("再作成できる生成画像がありません。");
      return;
    }

    setImageRegenerating(true);
    setImageRegenerationProgress(10);
    setActiveError("");
    try {
      let nextImages = draft.images;
      let nextBodyHtml = draft.editedBodyHtml;
      const rewriteInstruction = instruction.trim();

      for (const image of generatedImages) {
        const result = await apiPost<{ image: ArticleImage }>("/api/generate-image", {
          prompt: buildImageRegenerationPrompt(image.prompt, rewriteInstruction, draft.aiResult),
          slot: image.slot,
          altText: image.altText,
        });

        nextImages = nextImages.map((item) =>
          item.id === image.id ? result.image : item,
        );
        nextBodyHtml = replaceImageReferences(nextBodyHtml, image, result.image);
      }

      setDraft({
        ...draft,
        images: nextImages,
        editedBodyHtml: nextBodyHtml,
        updatedAt: new Date().toISOString(),
      });
      setImageRegenerationProgress(100);
    } catch (error) {
      setActiveError(readError(error));
      setImageRegenerationProgress(0);
    } finally {
      setImageRegenerating(false);
    }
  }

  async function startImageRegeneration() {
    await regenerateGeneratedImages(imageRegenerationInstruction);
  }

  function updateDraft<K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) {
    if (!draft) return;
    setDraftActionError("");
    setDraftActionMessage("");
    setWpPostMessage("");
    setDraft({
      ...draft,
      [key]: value,
      status: draft.status === "approved" ? "draft" : draft.status,
      updatedAt: new Date().toISOString(),
    });
  }

  function updateFaq(index: number, key: keyof FaqItem, value: string) {
    if (!draft) return;
    const next = draft.faqItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: value } : item,
    );
    updateDraft("faqItems", next);
  }

  function addFaq() {
    if (!draft) return;
    updateDraft("faqItems", [...draft.faqItems, { question: "", answer: "" }]);
  }

  function removeFaq(index: number) {
    if (!draft) return;
    const next = draft.faqItems.filter((_, itemIndex) => itemIndex !== index);
    updateDraft("faqItems", next);
  }

  function parseCompetitorResearch() {
    if (!competitorJson.trim()) {
      setCompetitorJsonError("");
      return competitorResearch;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(competitorJson);
    } catch {
      const message =
        "競合調査JSONの形式を確認してください。括弧・カンマ・引用符が崩れていないか確認してください。";
      setCompetitorJsonError(message);
      throw new Error(message);
    }

    if (!isEditableCompetitorResearch(parsed)) {
      const message =
        "競合調査JSONの項目を確認してください。summary、queries、insightsと、各insightのurl・title・majorPoints・differentiationPoints・recommendationsが必要です。";
      setCompetitorJsonError(message);
      throw new Error(message);
    }

    setCompetitorJsonError("");
    return parsed;
  }

  function isEditableCompetitorResearch(value: unknown): value is CompetitorResearchResult {
    if (!isPlainRecord(value)) {
      return false;
    }

    return (
      typeof value.summary === "string" &&
      isStringArray(value.queries) &&
      Array.isArray(value.insights) &&
      value.insights.every(
        (insight) =>
          isPlainRecord(insight) &&
          typeof insight.url === "string" &&
          typeof insight.title === "string" &&
          isStringArray(insight.majorPoints) &&
          isStringArray(insight.differentiationPoints) &&
          isStringArray(insight.recommendations),
      )
    );
  }

  function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  function updateStep(id: string, status: GenerationStep["status"], detail?: string) {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, status, detail } : step)),
    );
  }

  function markRunningAsError(detail: string) {
    setSteps((current) =>
      current.map((step) =>
        step.status === "running" ? { ...step, status: "error", detail } : step,
      ),
    );
  }

  function focusDraftEditorForQualityCheck(checkId: string) {
    setTab("edit");
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-testid="${draftEditorTargetTestId(checkId)}"]`,
      );
      target?.focus();
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
  }

  async function fetchInputs(
    inputs: KeyValueInput[],
    files: AttachedFileInput[] = [],
    signal?: AbortSignal,
  ) {
    const urls = inputs.map((item) => item.url?.trim()).filter(Boolean) as string[];
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await apiPost<{ result: FetchResult }>(
            "/api/fetch-url-content",
            { url },
            { signal },
          );
          return response.result;
        } catch (error) {
          if (isAbortError(error)) {
            throw error;
          }

          return { url, ok: false, reason: readError(error) };
        }
      }),
    );

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

  async function createArticleImages(article: ArticleGenerationResult, signal?: AbortSignal) {
    if (imageCount === 0) {
      return [];
    }

    if (visualTone.mode === "upload" && visualTone.uploadedImageUrl) {
      return [
        {
          id: crypto.randomUUID(),
          slot: "featured" as const,
          url: visualTone.uploadedImageUrl,
          path: visualTone.uploadedImagePath,
          prompt: visualTone.uploadedImageName || "Uploaded article image",
          altText: article.selected_title,
          source: "uploaded" as const,
        },
      ];
    }

    const toneText = visualTone.mode === "custom" ? visualTone.custom : visualTone.preset;
    const prompts = article.image_prompts.slice(0, imageCount).map((prompt) => ({
      ...prompt,
      prompt: buildArticleImagePrompt(prompt.prompt, toneText, article),
    }));

    return Promise.all(
      prompts.map(async (prompt) => {
        const response = await apiPost<{ image: ArticleImage }>("/api/generate-image", {
          prompt: prompt.prompt,
          slot: prompt.slot,
          altText: prompt.alt_text,
        }, { signal });
        return response.image;
      }),
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-8 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              AIO Article Studio
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              AIO記事 半自動生成ツール
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
            <Badge variant={draft?.status === "approved" ? "success" : "default"}>
              {draft ? statusLabel(draft.status) : "未生成"}
            </Badge>
            <Button
              data-testid="article-primary-button"
              onClick={handlePrimaryArticleButton}
              disabled={!isGenerating && !canGenerate}
              variant={isGenerating ? "secondary" : "default"}
            >
              {isGenerating ? <StopCircle /> : <Sparkles />}
              {isGenerating
                ? "記事作成をストップ"
                : draft
                  ? "記事の再作成"
                  : "AIによる記事作成"}
            </Button>
            </div>
            {generateRequirementMessage ? (
              <div
                data-testid="generate-requirement-message"
                className="max-w-[360px] text-right text-xs text-slate-500"
              >
                {generateRequirementMessage}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] grid-cols-[560px_minmax(0,1fr)] gap-6 px-8 py-6">
        <aside className="space-y-4">
          <Card className="sticky top-24 z-10">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "参照", href: "#references" },
                  { label: "競合", href: "#competitors" },
                  { label: "テーマ", href: "#theme" },
                  { label: "一次情報", href: "#primary-info" },
                  { label: "画像", href: "#visual-tone" },
                  { label: "文字数", href: "#word-count" },
                  { label: "承認", href: "#approval", requiresDraft: true },
                  { label: "WordPress", href: "#wordpress", requiresDraft: true },
                ].map(({ label, href, requiresDraft }) =>
                  requiresDraft && !draft ? (
                    <span
                      key={href}
                      aria-disabled="true"
                      data-testid={`step-nav-disabled-${href.slice(1)}`}
                      title="記事生成後に利用できます。"
                      className="cursor-not-allowed rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-center text-slate-400"
                    >
                      {label}
                    </span>
                  ) : (
                    <a
                      key={href}
                      href={href}
                      className="rounded-md border border-slate-200 px-3 py-2 text-center text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
                    >
                      {label}
                    </a>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="references" className="scroll-mt-[360px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>参照情報</CardTitle>
                  <CardDescription>URLとテキストは同じ行に併用できます。</CardDescription>
                </div>
                <Badge variant="required">必須</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <InputList
                items={references}
                setItems={setReferences}
                urlPlaceholder="https://example.com/reference"
                testIdPrefix="reference"
                textPlaceholder="参照したい本文、メモ、資料要約"
              />
              <AttachmentUploadPanel
                title="参照ファイル"
                files={referenceFiles}
                uploading={referenceFileUploading}
                onFiles={(files) => uploadAttachmentFiles(files, "reference")}
                onRemove={(id) => removeAttachmentFile(id, "reference")}
                testId="reference-file-input"
              />
              <FetchFailures results={fetchedReferences} />
            </CardContent>
          </Card>

          <Card id="competitors" className="scroll-mt-[360px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>競合情報</CardTitle>
                  <CardDescription>未入力でも記事生成できます。</CardDescription>
                </div>
                <Badge variant="optional">任意</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <InputList
                items={competitors}
                setItems={setCompetitors}
                urlPlaceholder="https://example.com/competitor"
                testIdPrefix="competitor"
                textPlaceholder="競合記事の要約、LPの訴求、比較メモ"
              />
              <AttachmentUploadPanel
                title="競合ファイル"
                files={competitorFiles}
                uploading={competitorFileUploading}
                onFiles={(files) => uploadAttachmentFiles(files, "competitor")}
                onRemove={(id) => removeAttachmentFile(id, "competitor")}
                testId="competitor-file-input"
              />
              <Button
                data-testid="competitor-research-button"
                type="button"
                variant="secondary"
                onClick={runCompetitorResearch}
                disabled={researchLoading}
              >
                {researchLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                AIによる競合情報調査
              </Button>
              {researchLoading || researchProgress === 100 ? (
                <div
                  data-testid="competitor-research-progress"
                  className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={researchProgress}
                >
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-sky-900">
                    <span>
                      {researchLoading
                        ? "競合情報を調査しています"
                        : "競合情報の調査が完了しました"}
                    </span>
                    <span>{researchProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-sky-600 transition-all duration-500 ease-out"
                      style={{ width: `${researchProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {competitorJson ? (
                <Textarea
                  data-testid="competitor-research-json"
                  value={competitorJson}
                  onChange={(event) => {
                    setCompetitorJson(event.target.value);
                    if (competitorJsonError) {
                      setCompetitorJsonError("");
                    }
                  }}
                  className="min-h-64 font-mono text-xs"
                />
              ) : null}
              {competitorJsonError ? (
                <p
                  data-testid="competitor-research-json-error"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"
                >
                  {competitorJsonError}
                </p>
              ) : null}
              <FetchFailures results={fetchedCompetitors} />
            </CardContent>
          </Card>

          <Card id="theme" className="scroll-mt-[360px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>テーマ・結び・執筆者</CardTitle>
                  <CardDescription>検索意図、読者、CTA、著者情報をまとめます。</CardDescription>
                </div>
                <Badge variant="optional">任意</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    テーマ・キーワード
                  </span>
                  <Button
                    data-testid="theme-candidates-button"
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={generateThemeCandidates}
                    disabled={themeCandidateLoading}
                  >
                    {themeCandidateLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Sparkles />
                    )}
                    AIで候補出力
                  </Button>
                </div>
                <Textarea
                  data-testid="theme-textarea"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  placeholder="複数キーワード、想定読者、検索意図、記事の狙い"
                  className="min-h-32"
                />
                {themeCandidateError ? (
                  <div
                    data-testid="theme-candidates-error"
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
                  >
                    {themeCandidateError}
                  </div>
                ) : null}
                {themeCandidates ? (
                  <ThemeCandidateList
                    result={themeCandidates}
                    onApply={applyThemeCandidate}
                    appliedIndex={themeCandidateAppliedIndex}
                    applyMessage={themeCandidateApplyMessage}
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    文末の結び文章
                  </span>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      data-testid="closing-reuse-checkbox"
                      type="checkbox"
                      checked={closingReuseChecked}
                      onChange={(event) => togglePreviousClosing(event.target.checked)}
                      className="size-4 rounded border-slate-300"
                    />
                    前回と同じ内容
                  </label>
                </div>
                <Textarea
                  data-testid="closing-textarea"
                  value={closingText}
                  onChange={(event) => setClosingText(event.target.value)}
                  placeholder="自社LPへの誘導文、問い合わせ導線、CTA"
                />
                {closingReuseMessage ? (
                  <p className="text-xs text-slate-500">{closingReuseMessage}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-700">執筆者名</span>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        data-testid="author-reuse-checkbox"
                        type="checkbox"
                        checked={authorReuseChecked}
                        onChange={(event) => togglePreviousAuthor(event.target.checked)}
                        className="size-4 rounded border-slate-300"
                      />
                      前回と同じ内容
                    </label>
                  </div>
                  <Input
                    data-testid="author-name-input"
                    value={author.name ?? ""}
                    onChange={(event) =>
                      setAuthor((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                  {authorReuseMessage ? (
                    <p className="text-xs text-slate-500">{authorReuseMessage}</p>
                  ) : null}
                </div>
                <Field label="肩書き">
                  <Input
                    data-testid="author-title-input"
                    value={author.title ?? ""}
                    onChange={(event) =>
                      setAuthor((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="紹介文">
                <Textarea
                  data-testid="author-bio-textarea"
                  value={author.bio ?? ""}
                  onChange={(event) =>
                    setAuthor((current) => ({ ...current, bio: event.target.value }))
                  }
                />
              </Field>
              <UploadRow
                label="執筆者画像"
                onFile={uploadAuthorImage}
                previewUrl={author.imageUrl}
                testId="author-image-upload-input"
              />
            </CardContent>
          </Card>

          <Card id="primary-info" className="scroll-mt-[360px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AIOのための一次情報</CardTitle>
                  <CardDescription>
                    自社固有の経験、現場感、考え方を記事の差別化材料として使います。
                  </CardDescription>
                </div>
                <Badge variant="optional">任意</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                data-testid="primary-info-textarea"
                value={primaryInfo}
                onChange={(event) => setPrimaryInfo(event.target.value)}
                placeholder="自社固有の経験や考えを書いて下さい。例：当社の支援現場では、◯◯の相談が多い。一人親方の事務作業はLINEでのやり取りが多く帳票不在も多い。"
                className="min-h-36"
              />
            </CardContent>
          </Card>

          <Card id="visual-tone" className="scroll-mt-[360px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>記事挿入画像のビジュアルトーン</CardTitle>
                  <CardDescription>3方式のいずれかを選択してください。</CardDescription>
                </div>
                <Badge variant="required">必須</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">画像の枚数</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {imageGenerationEstimate(imageCount, visualTone.mode)}
                    </div>
                  </div>
                  <div className="flex rounded-md border border-slate-200 bg-white p-1">
                    {imageCountOptions.map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setImageCount(count)}
                        className={cn(
                          "min-w-12 rounded px-3 py-1.5 text-sm font-medium transition",
                          imageCount === count
                            ? "bg-slate-950 text-white"
                            : "text-slate-600 hover:bg-slate-100",
                        )}
                      >
                        {count}枚
                      </button>
                    ))}
                  </div>
                </div>
                {visualTone.mode === "upload" && imageCount > 1 ? (
                  <p className="mt-2 text-xs text-amber-700">
                    画像アップロード方式では、AI画像生成は行わず、アップロード画像1枚を反映します。
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["preset", "選択肢"],
                  ["custom", "自然言語"],
                  ["upload", "画像アップロード"],
                ].map(([mode, label]) => (
                  <Button
                    key={mode}
                    data-testid={`visual-tone-mode-${mode}`}
                    type="button"
                    variant={visualTone.mode === mode ? "default" : "secondary"}
                    onClick={() =>
                      setVisualTone((current) => ({
                        ...current,
                        mode: mode as VisualToneInput["mode"],
                      }))
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {visualTone.mode === "preset" ? (
                <div className="grid grid-cols-1 gap-2">
                  {tonePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setVisualTone({ mode: "preset", preset })}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left text-sm transition",
                        visualTone.preset === preset
                          ? "border-sky-500 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              ) : null}

              {visualTone.mode === "custom" ? (
                <Textarea
                  value={visualTone.custom ?? ""}
                  onChange={(event) =>
                    setVisualTone({ mode: "custom", custom: event.target.value })
                  }
                  placeholder="例: 信頼感のある白背景、青と緑のアクセント、図解中心"
                  className="min-h-28"
                />
              ) : null}

              {visualTone.mode === "upload" ? (
                <UploadRow
                  label="挿入画像"
                  onFile={uploadToneImage}
                  previewUrl={visualTone.uploadedImageUrl}
                  testId="visual-tone-upload-input"
                />
              ) : null}
            </CardContent>
          </Card>

          <Card id="word-count" className="scroll-mt-[360px]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>文字数</CardTitle>
                  <CardDescription>記事生成時の目標文字数です。</CardDescription>
                </div>
                <Badge variant="optional">任意</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <select
                value={wordCount}
                onChange={(event) => setWordCount(Number(event.target.value) as WordCount)}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                {wordCountOptions.map((count) => (
                  <option key={count} value={count}>
                    {count.toLocaleString("ja-JP")}字
                  </option>
                ))}
              </select>
              <p className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">
                AIO（AI検索最適化）記事の文字数は、一般的に1,000〜5,000字が目安とされています。
              </p>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          {activeError ? (
            <div
              data-testid="active-error"
              className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>{activeError}</div>
            </div>
          ) : null}

          <GenerationLogsPanel
            logs={generationLogs}
            loading={logsLoading}
            error={logsError}
            expanded={logsExpanded}
            onToggle={() => setLogsExpanded((current) => !current)}
            onRefresh={loadGenerationLogs}
            onOpen={openGenerationLog}
          />

          <Card>
            <CardHeader>
              <CardTitle>生成状況</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="min-h-24 rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <StepIcon status={step.status} />
                      {step.label}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {step.detail || stepStatusLabel(step.status)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {draft ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>{draft.editedTitle}</CardTitle>
                      <CardDescription>
                        {draft.editedMetaDescription || "メタディスクリプション未入力"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid="draft-preview-tab"
                        variant={tab === "preview" ? "default" : "secondary"}
                        onClick={() => setTab("preview")}
                      >
                        <FileText />
                        プレビュー
                      </Button>
                      <Button
                        data-testid="fullscreen-preview-button"
                        variant="secondary"
                        onClick={() => setFullscreenPreviewOpen(true)}
                      >
                        <Maximize2 />
                        全画面プレビュー
                      </Button>
                      <Button
                        data-testid="draft-edit-tab"
                        variant={tab === "edit" ? "default" : "secondary"}
                        onClick={() => setTab("edit")}
                      >
                        編集
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tab === "preview" ? (
                    <ArticlePreview
                      draft={draft}
                      imageRegenerating={imageRegenerating}
                      onEditDraft={(checkId) => focusDraftEditorForQualityCheck(checkId)}
                      onImproveQuality={(instruction) => {
                        setArticleRegenerationInstruction(instruction);
                        setArticleRegenerationDialogOpen(true);
                      }}
                      onRegenerateImages={() => {
                        setImageRegenerationProgress(0);
                        setImageRegenerationDialogOpen(true);
                      }}
                    />
                  ) : (
                    <ArticleEditor
                      draft={draft}
                      updateDraft={updateDraft}
                      updateFaq={updateFaq}
                      addFaq={addFaq}
                      removeFaq={removeFaq}
                      regenerateImage={openSingleImageRegeneration}
                    />
                  )}
                </CardContent>
              </Card>

              <Card id="approval" className="scroll-mt-[360px]">
                <CardHeader>
                  <CardTitle>保存・承認</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      data-testid="save-draft-button"
                      variant="secondary"
                      onClick={saveCurrentDraft}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="animate-spin" /> : <Save />}
                      編集内容を保存
                    </Button>
                    <Button
                      data-testid="approve-draft-button"
                      onClick={approveCurrentDraft}
                      disabled={saving}
                    >
                      <CheckCircle2 />
                      承認済みに変更
                    </Button>
                    <Badge
                      data-testid="draft-status-badge"
                      variant={draft.status === "approved" ? "success" : "default"}
                    >
                      {statusLabel(draft.status)}
                    </Badge>
                  </div>
                  {draftActionMessage ? (
                    <div
                      data-testid="draft-action-message"
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                      aria-live="polite"
                    >
                      {draftActionMessage}
                    </div>
                  ) : null}
                  {draftActionError ? (
                    <div
                      data-testid="draft-action-error"
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-800"
                      aria-live="polite"
                    >
                      {draftActionError}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card id="wordpress" className="scroll-mt-[360px]">
                <CardHeader>
                  <CardTitle>WordPress投稿</CardTitle>
                  <CardDescription>
                    Application Passwordは暗号化して保存します。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-[1.2fr_0.8fr_1fr_auto] gap-3">
                    <Input
                      data-testid="wordpress-site-url"
                      value={wpForm.siteUrl}
                      onChange={(event) =>
                        updateWordpressForm({
                          siteUrl: event.target.value,
                        })
                      }
                      placeholder="https://wordpress.example.com"
                    />
                    <Input
                      data-testid="wordpress-username"
                      value={wpForm.username}
                      onChange={(event) =>
                        updateWordpressForm({
                          username: event.target.value,
                        })
                      }
                      placeholder="ユーザー名"
                    />
                    <Input
                      data-testid="wordpress-application-password"
                      value={wpForm.applicationPassword}
                      type="password"
                      onChange={(event) =>
                        updateWordpressForm({
                          applicationPassword: event.target.value,
                        })
                      }
                      placeholder="Application Password"
                    />
                    <Button
                      data-testid="wordpress-connect-button"
                      variant="secondary"
                      onClick={connectWordpress}
                    >
                      保存
                    </Button>
                  </div>
                  {wpConnectionError ? (
                    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-800">
                      {wpConnectionError}
                    </div>
                  ) : null}
                  {wpConnectionMessage ? (
                    <div
                      data-testid="wordpress-connection-message"
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                      aria-live="polite"
                    >
                      {wpConnectionMessage}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <select
                      data-testid="wordpress-status-select"
                      value={wpForm.status}
                      onChange={(event) =>
                        updateWordpressForm({
                          status: event.target.value as "draft" | "publish",
                        })
                      }
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="draft">下書き</option>
                      <option value="publish">公開</option>
                    </select>
                    <Button
                      data-testid="wordpress-post-button"
                      onClick={postToWordpress}
                      disabled={!connection || draft.status !== "approved" || posting}
                    >
                      {posting ? <Loader2 className="animate-spin" /> : <Send />}
                      WordPressに投稿
                    </Button>
                    {connection ? (
                      <Badge variant="success">{connection.siteUrl}</Badge>
                    ) : null}
                    {draft.wordpressPostUrl ? (
                      <a
                        href={draft.wordpressPostUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-sky-700 underline"
                      >
                        投稿URL
                      </a>
                    ) : null}
                  </div>
                  {wpPostMessage ? (
                    <div
                      data-testid="wordpress-post-message"
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                      aria-live="polite"
                    >
                      {wpPostMessage}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <div className="flex size-14 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <Sparkles className="size-6" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">生成プレビュー</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  入力が揃うと、記事本文・タイトル・画像・承認状態がここに表示されます。
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {draft && isFullscreenPreviewOpen ? (
        <FullscreenArticlePreview
          draft={draft}
          onClose={() => setFullscreenPreviewOpen(false)}
        />
      ) : null}

      {draft && imageRegenerationDialogOpen ? (
        <ImageRegenerationDialog
          instruction={imageRegenerationInstruction}
          progress={imageRegenerationProgress}
          regenerating={imageRegenerating}
          onInstructionChange={setImageRegenerationInstruction}
          onClose={() => setImageRegenerationDialogOpen(false)}
          onStart={startImageRegeneration}
        />
      ) : null}

      {draft && articleRegenerationDialogOpen ? (
        <ArticleRegenerationDialog
          instruction={articleRegenerationInstruction}
          onInstructionChange={setArticleRegenerationInstruction}
          onClose={() => setArticleRegenerationDialogOpen(false)}
          onStart={startArticleRegeneration}
        />
      ) : null}

      {draft && singleImageDialogOpen && singleImageTarget ? (
        <ImageRegenerationDialog
          title="画像の再作成"
          eyebrow={`生成画像 / ${singleImageTarget.slot}`}
          testIdPrefix="single-image-regeneration"
          instruction={singleImageInstruction}
          progress={singleImageProgress}
          regenerating={singleImageRegenerating}
          onInstructionChange={setSingleImageInstruction}
          onClose={() => setSingleImageDialogOpen(false)}
          onStart={startSingleImageRegeneration}
        />
      ) : null}
    </main>
  );
}

function InputList({
  items,
  setItems,
  urlPlaceholder,
  textPlaceholder,
  testIdPrefix,
}: {
  items: KeyValueInput[];
  setItems: (items: KeyValueInput[]) => void;
  urlPlaceholder: string;
  textPlaceholder: string;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-500">入力 {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setItems(items.filter((target) => target.id !== item.id))}
              disabled={items.length === 1}
              aria-label="削除"
            >
              <Trash2 />
            </Button>
          </div>
          <div className="mt-2 space-y-2">
            <Input
              data-testid={testIdPrefix ? `${testIdPrefix}-url-${index}` : undefined}
              value={item.url ?? ""}
              onChange={(event) =>
                setItems(
                  items.map((target) =>
                    target.id === item.id ? { ...target, url: event.target.value } : target,
                  ),
                )
              }
              placeholder={urlPlaceholder}
            />
            <Textarea
              data-testid={testIdPrefix ? `${testIdPrefix}-text-${index}` : undefined}
              value={item.text ?? ""}
              onChange={(event) =>
                setItems(
                  items.map((target) =>
                    target.id === item.id ? { ...target, text: event.target.value } : target,
                  ),
                )
              }
              placeholder={textPlaceholder}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setItems([...items, blankInput()])}
      >
        <Plus />
        入力欄を追加
      </Button>
    </div>
  );
}

function AttachmentUploadPanel({
  title,
  files,
  uploading,
  onFiles,
  onRemove,
  testId,
}: {
  title: string;
  files: AttachedFileInput[];
  uploading: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  testId?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-700">{title}</div>
          <p className="mt-1 text-xs text-slate-500">
            PDF/TXT/PPTX/XLSX/DOCX/HTMLを複数添付できます。
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          添付
          <input
            data-testid={testId}
            type="file"
            multiple
            accept=".pdf,.txt,.pptx,.xlsx,.docx,.html,.htm,text/plain,application/pdf,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              onFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {files.length > 0 ? (
        <div className="mt-3 space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-md border p-2",
                file.ok ? "border-emerald-100 bg-emerald-50" : "border-amber-200 bg-amber-50",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-800">{file.name}</div>
                <div className="mt-1 text-xs leading-5 text-slate-600">
                  {file.ok
                    ? `解析済み / ${file.textLength.toLocaleString("ja-JP")}文字`
                    : `解析エラー / ${file.error || "本文を抽出できませんでした"}`}
                </div>
                <div className="text-xs text-slate-500">
                  {file.type || "形式不明"} / {formatBytes(file.size)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(file.id)}
                aria-label="添付を削除"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ThemeCandidateList({
  result,
  onApply,
  appliedIndex,
  applyMessage,
}: {
  result: ThemeCandidateResult;
  onApply: (candidate: ThemeCandidate, index: number) => void;
  appliedIndex: number | null;
  applyMessage: string;
}) {
  return (
    <div className="space-y-2 rounded-md border border-sky-100 bg-sky-50 p-3">
      <p className="text-xs leading-5 text-sky-900">{result.summary}</p>
      <div className="space-y-2">
        {result.candidates.map((candidate, index) => (
          <div
            key={`${candidate.title}-${index}`}
            data-testid={`theme-candidate-card-${index}`}
            className="rounded-md border border-sky-100 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{candidate.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {candidate.keywords.map((keyword) => (
                    <Badge key={keyword} variant="default">
                      {keyword}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {candidate.searchIntent}
                </p>
              </div>
              <div className="relative shrink-0">
                <Button
                  data-testid={`theme-candidate-apply-${index}`}
                  type="button"
                  size="sm"
                  onClick={() => onApply(candidate, index)}
                >
                反映
                </Button>
                {appliedIndex === index && applyMessage ? (
                  <div
                    className="absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-lg"
                    aria-live="polite"
                  >
                    {applyMessage}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function UploadRow({
  label,
  onFile,
  previewUrl,
  testId,
}: {
  label: string;
  onFile: (file: File | null) => void;
  previewUrl?: string;
  testId?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-700">{label}</div>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Upload className="size-4" />
            アップロード
            <input
              data-testid={testId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                onFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {previewUrl ? <PreviewImage src={previewUrl} alt={label} className="size-20" /> : null}
      </div>
    </div>
  );
}

function FetchFailures({ results }: { results: FetchResult[] }) {
  const failures = results.filter((result) => !result.ok && result.reason);
  const notes = results.filter((result) => result.ok && result.reason);
  if (failures.length === 0 && notes.length === 0) return null;
  return (
    <div className="space-y-2">
      {failures.length > 0 ? (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          {failures.map((failure) => (
            <div
              key={`${failure.url}-${failure.reason}`}
              className="text-xs leading-5 text-amber-900"
            >
              <span className="font-semibold">{failure.url}</span>:{" "}
              {formatFetchReason(failure.reason)}
            </div>
          ))}
        </div>
      ) : null}
      {notes.length > 0 ? (
        <div className="space-y-2 rounded-md border border-sky-100 bg-sky-50 p-3">
          {notes.map((note) => (
            <div key={`${note.url}-${note.reason}`} className="text-xs leading-5 text-sky-900">
              <span className="font-semibold">{note.url}</span>:{" "}
              {formatFetchReason(note.reason)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GenerationLogsPanel({
  logs,
  loading,
  error,
  expanded,
  onToggle,
  onRefresh,
  onOpen,
}: {
  logs: GenerationLogSummary[];
  loading: boolean;
  error: string;
  expanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  onOpen: (jobId: string) => void;
}) {
  return (
    <Card data-testid="generation-logs-panel">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>生成ログ</CardTitle>
            {expanded ? (
              <CardDescription>
              過去の入力、最終アウトプット、WordPress投稿状態を確認できます。
              </CardDescription>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="default">{logs.length}件</Badge>
            <Button
              data-testid="generation-logs-toggle"
              type="button"
              variant="secondary"
              size="sm"
              onClick={onToggle}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
              {expanded ? "閉じる" : "開く"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
            更新
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent data-testid="generation-logs-content">
        {error ? (
          <div
            data-testid="generation-logs-error"
            className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800"
          >
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            まだ生成ログはありません。
          </div>
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[1030px] table-fixed text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="w-[150px] whitespace-nowrap px-3 py-2">日時</th>
                  <th className="w-[300px] whitespace-nowrap px-3 py-2">インプット</th>
                  <th className="w-[260px] whitespace-nowrap px-3 py-2">最終アウトプット</th>
                  <th className="w-[120px] whitespace-nowrap px-3 py-2">WordPress</th>
                  <th className="w-[110px] whitespace-nowrap px-3 py-2">状態</th>
                  <th className="w-[90px] whitespace-nowrap px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <div className="line-clamp-2">{log.inputSummary}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="line-clamp-2 font-medium text-slate-900">
                        {log.outputTitle || "生成中または未生成"}
                      </div>
                      {log.outputSlug ? (
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {log.outputSlug}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {wordpressStatusLabel(log.wordpressPostStatus)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={log.status === "completed" ? "success" : "default"}>
                        {generationJobStatusLabel(log.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        data-testid={`generation-log-open-${log.id}`}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpen(log.id)}
                      >
                        開く
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </CardContent>
      ) : null}
    </Card>
  );
}

function ArticlePreview({
  draft,
  imageRegenerating,
  onEditDraft,
  onImproveQuality,
  onRegenerateImages,
}: {
  draft: ArticleDraft;
  imageRegenerating: boolean;
  onEditDraft: (checkId: string) => void;
  onImproveQuality: (instruction: string) => void;
  onRegenerateImages: () => void;
}) {
  const canRegenerateImages = draft.images.some((image) => image.source === "generated");
  const bodyQualityEvaluation = useMemo(
    () =>
      evaluateArticleQuality(renderArticleHtml(draft), {
        themeText: draft.inputPayload.theme,
        targetReaderText: draft.aiResult.target_reader,
        searchIntentText: draft.aiResult.search_intent,
        primaryInfo: draft.inputPayload.primaryInfo,
        closingText: draft.inputPayload.closingText,
        referenceTexts: collectDraftReferenceTexts(draft),
        sourceUrls: collectDraftSourceUrls(draft),
        competitorTexts: collectDraftCompetitorTexts(draft),
        targetWordCount: draft.inputPayload.wordCount,
      }),
    [draft],
  );
  const titleQualityEvaluation = useMemo(
    () =>
      evaluateTitleQuality({
        selectedTitle: draft.editedTitle,
        titleCandidates: draft.aiResult.title_candidates,
        themeText: draft.inputPayload.theme,
        primaryInfo: draft.inputPayload.primaryInfo,
      }),
    [draft],
  );
  const faqQualityEvaluation = useMemo(
    () =>
      evaluateFaqQuality({
        faqItems: draft.faqItems,
        themeText: draft.inputPayload.theme,
        primaryInfo: draft.inputPayload.primaryInfo,
        referenceTexts: collectDraftReferenceTexts(draft),
        competitorTexts: collectDraftCompetitorTexts(draft),
      }),
    [draft],
  );
  const qualityEvaluation = useMemo(
    () =>
      combineQualityEvaluations(
        titleQualityEvaluation,
        bodyQualityEvaluation,
        faqQualityEvaluation,
      ),
    [bodyQualityEvaluation, faqQualityEvaluation, titleQualityEvaluation],
  );
  const failedQualityChecks = useMemo(
    () => qualityEvaluation.checks.filter((check) => !check.passed),
    [qualityEvaluation],
  );
  const passedQualityChecks = useMemo(
    () => qualityEvaluation.checks.filter((check) => check.passed),
    [qualityEvaluation],
  );
  const orderedQualityChecks = useMemo(
    () => [...failedQualityChecks, ...passedQualityChecks],
    [failedQualityChecks, passedQualityChecks],
  );
  const [copyStatus, setCopyStatus] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const copyStatusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyStatusTimerRef.current) {
        window.clearTimeout(copyStatusTimerRef.current);
      }
    };
  }, []);

  function showCopyStatus(message: string, tone: "success" | "error" = "success") {
    setCopyStatus({ message, tone });
    if (copyStatusTimerRef.current) {
      window.clearTimeout(copyStatusTimerRef.current);
    }
    copyStatusTimerRef.current = window.setTimeout(() => {
      setCopyStatus(null);
    }, 2600);
  }

  async function handleCopy(label: string, value: string) {
    try {
      await copyTextToClipboard(value);
      showCopyStatus(`${label}をコピーしました。`);
    } catch {
      showCopyStatus(`${label}をコピーできませんでした。${copyManualRecoveryText(label)}`, "error");
    }
  }

  function handleDownload() {
    try {
      downloadArticleHtml(draft);
      showCopyStatus("HTMLファイルを書き出しました。");
    } catch {
      showCopyStatus(
        "HTML出力に失敗しました。本文HTMLをコピーして手動で保存してください。",
        "error",
      );
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-6">
      <article className="article-preview min-h-[720px] rounded-md border border-slate-200 bg-white p-8">
        <h1>{draft.editedTitle}</h1>
        <div dangerouslySetInnerHTML={{ __html: renderArticleHtml(draft) }} />
      </article>
      <aside className="space-y-4">
        <InfoPanel title="コピー/出力">
          <div className="grid grid-cols-2 gap-2">
            <Button
              data-testid="copy-title-button"
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleCopy("タイトル", draft.editedTitle)}
            >
              <ClipboardCopy />
              タイトル
            </Button>
            <Button
              data-testid="copy-meta-button"
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleCopy("メタ", draft.editedMetaDescription)}
            >
              <ClipboardCopy />
              メタ
            </Button>
            <Button
              data-testid="copy-body-html-button"
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleCopy("本文HTML", renderArticleHtml(draft))}
            >
              <ClipboardCopy />
              本文HTML
            </Button>
            <Button
              data-testid="copy-handoff-button"
              type="button"
              variant="secondary"
              size="sm"
              className="col-span-2"
              onClick={() => handleCopy("入稿セット", buildEditorialHandoffText(draft))}
            >
              <ClipboardCopy />
              入稿セット
            </Button>
            <Button
              data-testid="download-html-button"
              type="button"
              variant="secondary"
              size="sm"
              className="col-span-2"
              onClick={handleDownload}
            >
              <Download />
              HTML出力
            </Button>
          </div>
          {copyStatus ? (
            <div
              data-testid="copy-export-status"
              data-status={copyStatus.tone}
              className={cn(
                "mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium",
                copyStatus.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700",
              )}
              aria-live="polite"
            >
              {copyStatus.tone === "success" ? (
                <Check className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
              {copyStatus.message}
            </div>
          ) : null}
        </InfoPanel>
        <InfoPanel title="AIO自己評価">
          <div className="text-3xl font-semibold">
            {draft.aiResult.aio_score_self_evaluation.score}
            <span className="text-sm text-slate-500"> / 100</span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {draft.aiResult.aio_score_self_evaluation.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </InfoPanel>
        <InfoPanel
          title="編集品質チェック"
          action={
            <Button
              data-testid="quality-improve-regenerate-button"
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onImproveQuality(buildQualityRegenerationInstruction(qualityEvaluation))}
            >
              <RefreshCcw />
              品質改善して再作成
            </Button>
          }
        >
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold">{qualityEvaluation.score}</span>
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
          <div
            data-testid="quality-priority-summary"
            className={cn(
              "mt-3 rounded-md border px-3 py-2 text-xs font-medium",
              failedQualityChecks.length
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-800",
            )}
          >
            {failedQualityChecks.length
              ? `改善優先: ${failedQualityChecks.length}件。未達項目を先に表示しています。`
              : "全チェックを満たしています。公開前の最終確認に進めます。"}
          </div>
          <div className="mt-3 space-y-2 text-xs leading-5">
            {orderedQualityChecks.map((check) => (
              <div
                key={check.id}
                data-testid={check.passed ? "quality-check-passed" : "quality-check-failed"}
                className={cn(
                  "rounded-md border px-3 py-2",
                  check.passed
                    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}
              >
                <div className="font-semibold">{check.label}</div>
                <div className="mt-0.5">{check.detail}</div>
                {!check.passed ? (
                  <>
                    <div
                      data-testid="quality-edit-guidance"
                      className="mt-2 rounded border border-amber-200 bg-white/70 px-2 py-1 text-[11px] font-medium text-amber-950"
                    >
                      {qualityCheckEditGuidance(check.id)}
                    </div>
                    <Button
                      data-testid="quality-edit-draft-button"
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() => onEditDraft(check.id)}
                    >
                      編集タブへ
                    </Button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </InfoPanel>
        <InfoPanel title="出典URL">
          <div className="space-y-2 text-sm">
            {draft.aiResult.sources.map((source) => (
              <a
                key={`${source.url}-${source.title}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-sky-700 underline"
              >
                {source.title || source.url}
              </a>
            ))}
          </div>
        </InfoPanel>
        <InfoPanel
          title="生成画像"
          action={
            <Button
              data-testid="image-regenerate-all-button"
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRegenerateImages}
              disabled={!canRegenerateImages || imageRegenerating}
            >
              {imageRegenerating ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCcw />
              )}
              画像のみ再作成
            </Button>
          }
        >
          <div className="space-y-3">
            {draft.images.map((image) => (
              <div key={image.id}>
                <PreviewImage
                  src={image.url}
                  alt={image.altText}
                  className="h-36 w-full"
                />
                <div className="mt-1 text-xs text-slate-500">{image.slot}</div>
              </div>
            ))}
          </div>
        </InfoPanel>
      </aside>
    </div>
  );
}

function FullscreenArticlePreview({
  draft,
  onClose,
}: {
  draft: ArticleDraft;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="全画面プレビュー"
    >
      <div className="mx-auto flex h-full max-w-[1440px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-sky-700">全画面プレビュー</div>
            <h2 className="truncate text-lg font-semibold text-slate-950">
              {draft.editedTitle}
            </h2>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            <X />
            閉じる
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-6">
          <article className="article-preview mx-auto min-h-full max-w-[980px] rounded-md border border-slate-200 bg-white p-10">
            <h1>{draft.editedTitle}</h1>
            <div dangerouslySetInnerHTML={{ __html: renderArticleHtml(draft) }} />
          </article>
        </div>
      </div>
    </div>
  );
}

function ArticleRegenerationDialog({
  instruction,
  onInstructionChange,
  onClose,
  onStart,
}: {
  instruction: string;
  onInstructionChange: (value: string) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="記事の再作成"
    >
      <div className="w-full max-w-[680px] rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-sky-700">生成済みドラフト</div>
            <h2 className="text-lg font-semibold text-slate-950">記事の再作成</h2>
          </div>
          <Button type="button" variant="secondary" size="icon" onClick={onClose} aria-label="閉じる">
            <X />
          </Button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <Field label="再作成方針">
            <Textarea
              data-testid="article-regeneration-instruction"
              value={instruction}
              onChange={(event) => onInstructionChange(event.target.value)}
              placeholder="例：より初心者向けに、比較表を厚くし、導入メリットと注意点を強調してください。CTAは自然に残してください。"
              className="min-h-36"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              data-testid="article-regeneration-cancel"
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              キャンセル
            </Button>
            <Button data-testid="article-regeneration-start" type="button" onClick={onStart}>
              <RefreshCcw />
              再作成を開始
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageRegenerationDialog({
  title = "画像のみ再作成",
  eyebrow = "生成画像",
  placeholder = "例：よりBtoB SaaSらしく、白背景で、ダッシュボード画面と記事構成図が伝わる画像にしてください。人物は入れず、青とグレー基調で信頼感を出してください。",
  testIdPrefix = "image-regeneration",
  instruction,
  progress,
  regenerating,
  onInstructionChange,
  onClose,
  onStart,
}: {
  title?: string;
  eyebrow?: string;
  placeholder?: string;
  testIdPrefix?: string;
  instruction: string;
  progress: number;
  regenerating: boolean;
  onInstructionChange: (value: string) => void;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-[640px] rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-sky-700">{eyebrow}</div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onClose}
            disabled={regenerating}
            aria-label="閉じる"
          >
            <X />
          </Button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <Field label="再作成方針">
            <Textarea
              data-testid={`${testIdPrefix}-instruction`}
              value={instruction}
              onChange={(event) => onInstructionChange(event.target.value)}
              disabled={regenerating}
              placeholder={placeholder}
              className="min-h-32"
            />
          </Field>
          <div
            data-testid={`${testIdPrefix}-progress`}
            className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-sky-900">
              <span>
                {regenerating
                  ? "画像を再作成しています"
                  : progress === 100
                    ? "再作成が完了しました"
                    : "再作成待機中"}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-sky-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              data-testid={`${testIdPrefix}-close`}
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={regenerating}
            >
              {progress === 100 ? "閉じる" : "キャンセル"}
            </Button>
            <Button
              data-testid={`${testIdPrefix}-start`}
              type="button"
              onClick={onStart}
              disabled={regenerating}
            >
              {regenerating ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
              再作成を開始
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleEditor({
  draft,
  updateDraft,
  updateFaq,
  addFaq,
  removeFaq,
  regenerateImage,
}: {
  draft: ArticleDraft;
  updateDraft: <K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) => void;
  updateFaq: (index: number, key: keyof FaqItem, value: string) => void;
  addFaq: () => void;
  removeFaq: (index: number) => void;
  regenerateImage: (image: ArticleImage) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="タイトル">
          <Input
            data-testid="draft-title-input"
            value={draft.editedTitle}
            onChange={(event) => updateDraft("editedTitle", event.target.value)}
          />
        </Field>
        <Field label="スラッグ">
          <Input
            data-testid="draft-slug-input"
            value={draft.editedSlug}
            onChange={(event) => updateDraft("editedSlug", event.target.value)}
          />
        </Field>
      </div>
      <Field label="タイトル候補">
        <div className="flex flex-wrap gap-2">
          {draft.aiResult.title_candidates.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => updateDraft("editedTitle", title)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              {title}
            </button>
          ))}
        </div>
      </Field>
      <Field label="メタディスクリプション">
        <Textarea
          data-testid="draft-meta-textarea"
          value={draft.editedMetaDescription}
          onChange={(event) => updateDraft("editedMetaDescription", event.target.value)}
        />
      </Field>
      <Field label="本文HTML">
        <Textarea
          data-testid="draft-body-html-textarea"
          value={draft.editedBodyHtml}
          onChange={(event) => updateDraft("editedBodyHtml", event.target.value)}
          className="min-h-[520px] font-mono text-xs"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="タグ">
          <Input
            data-testid="draft-tags-input"
            value={joinCsv(draft.tags)}
            onChange={(event) => updateDraft("tags", splitCsv(event.target.value))}
          />
        </Field>
        <Field label="カテゴリ">
          <Input
            data-testid="draft-categories-input"
            value={joinCsv(draft.categories)}
            onChange={(event) => updateDraft("categories", splitCsv(event.target.value))}
          />
        </Field>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-700">FAQ</div>
          <Button
            data-testid="draft-faq-add-button"
            type="button"
            variant="secondary"
            size="sm"
            onClick={addFaq}
          >
            <Plus />
            FAQを追加
          </Button>
        </div>
        {draft.faqItems.map((faq, index) => (
          <div key={`${faq.question}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-3">
            <Input
              data-testid={`draft-faq-question-${index}`}
              aria-label={`FAQ ${index + 1} question`}
              value={faq.question}
              onChange={(event) => updateFaq(index, "question", event.target.value)}
            />
            <Input
              data-testid={`draft-faq-answer-${index}`}
              aria-label={`FAQ ${index + 1} answer`}
              value={faq.answer}
              onChange={(event) => updateFaq(index, "answer", event.target.value)}
            />
            <Button
              data-testid={`draft-faq-remove-${index}`}
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => removeFaq(index)}
              aria-label={`FAQ ${index + 1}を削除`}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {draft.images.map((image) => (
          <div key={image.id} className="rounded-md border border-slate-200 p-3">
            <PreviewImage src={image.url} alt={image.altText} className="h-36 w-full" />
            <div className="mt-2 flex items-center justify-between">
              <Badge>{image.slot}</Badge>
              {image.source === "generated" ? (
                <Button
                  data-testid={`image-regenerate-single-${image.slot}`}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => regenerateImage(image)}
                >
                  <RefreshCcw />
                  再作成
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PreviewImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-slate-100", className)}>
      <Image src={src} alt={alt} fill className="object-cover" sizes="320px" unoptimized />
    </div>
  );
}

function StepIcon({ status }: { status: GenerationStep["status"] }) {
  if (status === "done") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "running") return <Loader2 className="size-4 animate-spin text-sky-600" />;
  if (status === "error") return <AlertCircle className="size-4 text-rose-600" />;
  return <span className="size-4 rounded-full border border-slate-300" />;
}

function stepStatusLabel(status: GenerationStep["status"]) {
  if (status === "done") return "完了";
  if (status === "running") return "処理中";
  if (status === "error") return "失敗";
  return "待機中";
}

function statusLabel(status: ArticleDraft["status"]) {
  const labels: Record<ArticleDraft["status"], string> = {
    draft: "下書き",
    approved: "承認済み",
    posted: "投稿済み",
    failed: "失敗",
  };
  return labels[status];
}

function generationJobStatusLabel(status: GenerationJob["status"]) {
  const labels: Record<GenerationJob["status"], string> = {
    queued: "待機中",
    running: "生成中",
    completed: "完了",
    failed: "失敗",
    canceled: "停止",
  };
  return labels[status];
}

function wordpressStatusLabel(status?: "draft" | "publish") {
  if (status === "draft") return "下書き投稿";
  if (status === "publish") return "公開済み";
  return "未投稿";
}

function formatDateTime(value: string) {
  return formatJaDateTime(value);
}

function summarizeFetch(results: FetchResult[], label: string) {
  const urlResults = results.filter((result) => result.url !== "manual-text");
  const failed = urlResults.filter((result) => !result.ok);
  if (urlResults.length === 0) return `${label}なし`;
  if (failed.length === 0) return `${urlResults.length}件取得`;
  return `${urlResults.length - failed.length}件取得、${failed.length}件失敗`;
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
  return `<figure data-image-slot="${image.slot}" data-image-id="${image.id}"><img src="${imageSrcForHtml(
    image,
  )}" alt="${escapeHtml(
    image.altText,
  )}" /><figcaption>${escapeHtml(image.altText)}</figcaption></figure>`;
}

function buildImageRegenerationPrompt(
  basePrompt: string,
  instruction: string,
  article: Pick<ArticleGenerationResult, "article_summary" | "headings" | "key_takeaways">,
) {
  return [
    basePrompt,
    "",
    `Article summary anchor: ${truncatePromptLine(article.article_summary, 220)}`,
    `Key takeaways to preserve: ${article.key_takeaways.slice(0, 3).map((item) => truncatePromptLine(item, 80)).join(" / ")}`,
    `Relevant headings: ${article.headings.slice(0, 4).map((heading) => truncatePromptLine(heading.text, 80)).join(" / ")}`,
    "",
    instruction ? "Regeneration direction from the user:" : "Regeneration direction from the user: improve the image quality while preserving the article intent.",
    instruction || "Make it more polished, premium, coherent, and suitable for a Japanese B2B article.",
    "",
    "Quality bar: premium Japanese B2B SaaS / consulting / financial whitepaper visual, crisp layout, coherent perspective, refined lighting, generous whitespace, high-end corporate polish.",
    "Keep the regenerated image article-specific: show the concrete workflow, decision points, evidence/source checks, or comparison axes implied by the article anchors.",
    "Avoid readable text, random letters, logos, watermarks, fake UI screenshots, cluttered charts, distorted hands, unnecessary people, clip-art, cheap stock-photo look, and dark blurry AI-art backgrounds.",
  ].join("\n");
}

function buildArticleImagePrompt(
  basePrompt: string,
  toneText: string | undefined,
  article: Pick<ArticleGenerationResult, "article_summary" | "headings" | "key_takeaways">,
) {
  return [
    basePrompt,
    "",
    `Visual tone from user: ${toneText || "clean Japanese B2B whitepaper editorial style"}`,
    `Article summary anchor: ${truncatePromptLine(article.article_summary, 220)}`,
    `Key takeaways to visualize: ${article.key_takeaways.slice(0, 3).map((item) => truncatePromptLine(item, 80)).join(" / ")}`,
    `Relevant headings: ${article.headings.slice(0, 4).map((heading) => truncatePromptLine(heading.text, 80)).join(" / ")}`,
    "Create a premium 3:2 landscape editorial visual for a Japanese B2B article.",
    "Use a refined whitepaper/SaaS/consulting composition with clean geometry, subtle depth, balanced margins, and a clear focal concept.",
    "Make the visual article-specific: show the concrete workflow, decision points, evidence/source checks, or comparison axes implied by the article anchors.",
    "Avoid text-heavy layouts, readable text, random letters, logos, watermarks, fake UI screenshots, cluttered charts, unnecessary people, and cheap stock-photo aesthetics.",
  ].join("\n");
}

function truncatePromptLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function imageSrcForHtml(image: ArticleImage) {
  if (isDataUrl(image.url)) {
    return `aio-image:${image.id}`;
  }

  return escapeHtml(image.url);
}

function renderArticleHtml(draft: ArticleDraft) {
  return buildDraftArticleHtml(draft);
}

function hydrateDraftFromGenerationJob(job: GenerationJob) {
  if (!job.draft) {
    return null;
  }

  if (!job.wordpressPostUrl && !job.wordpressPostStatus) {
    return job.draft;
  }

  return {
    ...job.draft,
    status: "posted" as const,
    wordpressPostUrl: job.wordpressPostUrl || job.draft.wordpressPostUrl,
  };
}

function collectDraftReferenceTexts(draft: ArticleDraft) {
  return Array.from(
    new Set([
      ...draft.fetchedReferences.map((item) => item.text ?? ""),
      ...draft.inputPayload.references.map((item) => item.text ?? ""),
      ...(draft.inputPayload.referenceFiles ?? []).map((item) => item.text ?? ""),
    ]),
  ).filter((text) => text.trim());
}

function collectDraftSourceUrls(draft: ArticleDraft) {
  return Array.from(
    new Set([
      ...draft.fetchedReferences.map((item) => item.url),
      ...draft.inputPayload.references.map((item) => item.url ?? ""),
      ...draft.fetchedCompetitors.map((item) => item.url),
      ...draft.inputPayload.competitors.map((item) => item.url ?? ""),
      ...(draft.competitorResearch?.insights ?? []).map((item) => item.url),
      ...draft.aiResult.sources.map((item) => item.url),
    ]),
  ).filter((url) => url.trim());
}

function collectDraftCompetitorTexts(draft: ArticleDraft) {
  return Array.from(
    new Set([
      ...draft.fetchedCompetitors.map((item) => item.text ?? ""),
      ...draft.inputPayload.competitors.map((item) => item.text ?? ""),
      ...(draft.inputPayload.competitorFiles ?? []).map((item) => item.text ?? ""),
      ...(draft.competitorResearch ? collectCompetitorResearchTexts(draft.competitorResearch) : []),
    ]),
  ).filter((text) => text.trim());
}

function collectCompetitorResearchTexts(research: NonNullable<ArticleDraft["competitorResearch"]>) {
  return [
    research.summary,
    ...research.insights.flatMap((insight) => [
      insight.title,
      ...insight.majorPoints,
      ...insight.differentiationPoints,
      ...insight.recommendations,
    ]),
  ];
}

function buildQualityRegenerationInstruction(evaluation: ArticleQualityEvaluation) {
  const improvements = evaluation.checks
    .filter((check) => !check.passed)
    .map((check) => {
      const action = qualityRegenerationAction(check.id);
      return `- ${check.label}: ${check.detail}${
        action ? `\n  修正方針: ${action}` : ""
      }`;
    });

  return [
    "編集品質チェックの結果を踏まえて、記事全体を再作成してください。",
    "一般論やAIっぽい定型表現を減らし、一次情報・参照情報・競合情報にもとづく具体例、判断基準、注意点、失敗パターン、差別化ポイントを増やしてください。",
    "見出しは機械的なキーワード列ではなく、人間の編集者が企画したような読み進めたくなる表現にしてください。",
    "根拠が弱い内容は断定せず、参照元や未確認情報の扱いが読者に分かるようにしてください。",
    improvements.length > 0
      ? `改善が必要な項目:\n${improvements.join("\n")}`
      : "現在の品質は高めですが、さらに現場感、具体性、独自の視点を強めてください。",
  ].join("\n\n");
}

function combineQualityEvaluations(
  titleEvaluation: ArticleQualityEvaluation,
  bodyEvaluation: ArticleQualityEvaluation,
  faqEvaluation: ArticleQualityEvaluation,
): ArticleQualityEvaluation {
  return {
    score: Math.min(titleEvaluation.score, bodyEvaluation.score, faqEvaluation.score),
    checks: [...titleEvaluation.checks, ...bodyEvaluation.checks, ...faqEvaluation.checks],
    strengths: uniqueStrings([
      ...titleEvaluation.strengths,
      ...bodyEvaluation.strengths,
      ...faqEvaluation.strengths,
    ]),
    improvements: uniqueStrings([
      ...titleEvaluation.improvements,
      ...bodyEvaluation.improvements,
      ...faqEvaluation.improvements,
    ]),
  };
}

function draftEditorTargetTestId(checkId: string) {
  if (checkId.startsWith("title-")) {
    return "draft-title-input";
  }

  if (checkId === "faq-count") {
    return "draft-faq-add-button";
  }

  if (checkId === "faq-answer-specificity") {
    return "draft-faq-answer-0";
  }

  if (checkId.startsWith("faq-")) {
    return "draft-faq-question-0";
  }

  return "draft-body-html-textarea";
}

export function qualityCheckEditGuidance(checkId: string) {
  if (checkId.startsWith("title-")) {
    return "修正先: タイトル。テーマ、一次情報、読者の判断軸が伝わる表現にします。";
  }

  if (checkId === "faq-count") {
    return "修正先: FAQ。読者の不安、比較、次の行動に答える質問を追加します。";
  }

  if (checkId === "faq-answer-specificity") {
    return "修正先: FAQ回答。条件、例、注意点、判断基準を足します。";
  }

  if (checkId.startsWith("faq-")) {
    return "修正先: FAQ質問。テーマ、一次情報、競合差分に基づく具体的な問いにします。";
  }

  if (checkId === "primary-info-digestion") {
    return "修正先: 本文HTML。一次情報の固有語彙を残しつつ、読者向けの判断材料や注意点へ言い換えます。";
  }

  if (checkId === "reference-info-digestion") {
    return "修正先: 本文HTML。参照元の事実は保ち、定義、条件、注意点、出典注記として再構成します。";
  }

  if (checkId === "target-reader-reflection") {
    return "修正先: 本文HTML。想定読者の課題、立場、判断基準が分かる表現を冒頭、見出し、具体例、FAQに戻します。";
  }

  if (checkId === "search-intent-reflection") {
    return "修正先: 本文HTML。検索意図に含まれる疑問、比較軸、次の行動を結論、本文、FAQで明確に答えます。";
  }

  if (checkId === "competitor-insight-digestion") {
    return "修正先: 本文HTML。競合文を写さず、比較軸、不足論点、差別化ポイントへ再構成します。";
  }

  if (checkId.includes("reference")) {
    return "修正先: 本文HTML。参照情報の固有語彙を、定義、判断基準、具体例、注意点に戻します。";
  }

  if (checkId.includes("competitor")) {
    return "修正先: 本文HTML。競合情報を比較軸、不足論点、差別化ポイントとして整理します。";
  }

  if (checkId === "target-length-alignment") {
    return "修正先: 本文HTML。指定文字数に合わせて、具体例、判断基準、注意点、不要な重複表現を増減します。";
  }

  if (checkId === "answer-first") {
    return "修正先: 本文HTML。冒頭420字以内に、結論、定義、読者が最初に判断すべきことを先に置きます。";
  }

  if (checkId === "definition") {
    return "修正先: 本文HTML。冒頭付近に「〇〇とは...」型の短い定義文を追加し、AIが引用しやすい一文にします。";
  }

  if (checkId === "editorial-headings") {
    return "修正先: 本文HTML。「重要なポイント」「メリット」「まとめ」型の見出しを、判断軸、失敗例、比較観点が伝わる表現に変えます。";
  }

  if (checkId === "section-specificity") {
    return "修正先: 本文HTML。薄いH2/H3に、数字、現場例、判断基準、失敗例、費用、期間、出典のうち2つ以上を足します。";
  }

  if (checkId === "concrete-detail") {
    return "修正先: 本文HTML。抽象説明だけで終わらせず、数字、現場例、判断基準、失敗例を少なくとも2種類追加します。";
  }

  if (checkId === "editorial-evidence") {
    return "修正先: 本文HTML。現場例、判断基準、注意点、体制、費用感、参照元の扱いを複数入れ、編集者が確認した記事に近づけます。";
  }

  if (checkId === "structured-elements") {
    return "修正先: 本文HTML。読者が比較・確認しやすいように、箇条書きとFAQの両方を本文内に追加します。";
  }

  if (checkId === "unsupported-claims") {
    return "修正先: 本文HTML。『必ず』『圧倒的』『最適』などの強い断定を、出典、条件、対象範囲、確認時点つきの表現に直します。";
  }

  if (checkId === "source-awareness") {
    return "修正先: 本文HTML。参照元で確認できる事実と未確認の解釈を分け、出典URLや確認条件を読者が追える形で残します。";
  }

  if (checkId === "theme-keyword-reflection") {
    return "修正先: 本文HTML。入力テーマ・キーワードの固有語彙を、タイトル、冒頭、見出し、FAQのいずれかに自然に戻します。";
  }

  if (checkId === "primary-info-reflection") {
    return "修正先: 本文HTML。一次情報を、当社の経験、相談傾向、現場観察、支援時の判断基準として本文に戻します。";
  }

  if (checkId === "cta-reflection") {
    return "修正先: 本文HTML。入力された結び文章/CTAの意図を、記事末尾の自然な次アクションとして反映します。";
  }

  if (checkId === "generic-opening-frame") {
    return "修正先: 本文HTML。冒頭をテンプレ導入ではなく、結論、定義、現場観察、条件から書き出します。";
  }

  if (checkId === "generic-ending-frame") {
    return "修正先: 本文HTML。末尾の定型句を削り、記事固有の判断基準、次に確認する情報、問い合わせ前の準備事項に置き換えます。";
  }

  if (checkId === "generic-phrases") {
    return "修正先: 本文HTML。「近年」「重要です」「わかりやすく解説」などの汎用表現を削り、参照元の事実、一次情報、判断基準、現場例へ置き換えます。";
  }

  if (checkId === "verbose-ai-phrasing") {
    return "修正先: 本文HTML。「することができます」型の冗長な述語を、「確認します」「分けます」「できます」など短く具体的な動詞に置き換えます。";
  }

  if (checkId === "numeric-claim-support") {
    return "修正先: 本文HTML。数字の近くに出典、条件、時点、目安、現場観察を補います。";
  }

  if (checkId === "source-url-presence") {
    return "修正先: 本文HTML。本文末尾または該当箇所に、読者が確認できる出典URLを残します。";
  }

  if (checkId === "heading-storyline") {
    return "修正先: 本文HTML。まず/次に型の見出しを、判断、失敗、比較、現場差分が伝わる見出しへ変えます。";
  }

  if (checkId === "sentence-length") {
    return "修正先: 本文HTML。長い一文を、結論、条件、例外、具体例に分けて短くします。";
  }

  if (checkId === "sentence-variety") {
    return "修正先: 本文HTML。同じ語尾が続く段落を分け、断定、条件、例外、問い、短い具体例を混ぜて抑揚を出します。";
  }

  if (checkId === "connector-variety") {
    return "修正先: 本文HTML。「また」「さらに」「そのため」の連続を減らし、接続語なしの短文、現場例、条件文で段落を始めます。";
  }

  if (checkId === "sentence-frame-variety") {
    return "修正先: 本文HTML。「結論として」「具体的には」型の文頭を減らし、現場観察、比較、失敗例、例外から自然に書き出します。";
  }

  if (checkId === "comparison-table") {
    return "修正先: 本文HTML。表に判断基準、比較軸、条件、費用、期間、担当、注意点を入れます。";
  }

  return "修正先: 本文HTML。一般論を減らし、具体例、判断基準、注意点、出典への意識を足します。";
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter((item) => item.trim())));
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for browsers that block Clipboard API outside a granted context.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  let copied = false;
  try {
    textarea.select();
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}

function copyManualRecoveryText(label: string) {
  if (label === "タイトル") {
    return "タイトル欄から手動でコピーしてください。";
  }

  if (label === "メタ") {
    return "メタディスクリプション欄から手動でコピーしてください。";
  }

  if (label === "本文HTML") {
    return "本文HTML欄から手動でコピーしてください。";
  }

  if (label === "入稿セット") {
    return "タイトル、メタ、本文HTML、タグ、カテゴリを各編集欄から手動でコピーしてください。";
  }

  return "該当する編集欄から手動でコピーしてください。";
}

function downloadArticleHtml(draft: ArticleDraft) {
  const html = buildExportArticleHtml(draft);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeDownloadName(draft.editedSlug || draft.editedTitle || "aio-article")}.html`;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function buildExportArticleHtml(draft: ArticleDraft) {
  return [
    "<!doctype html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(draft.editedTitle)}</title>`,
    draft.editedMetaDescription
      ? `<meta name="description" content="${escapeHtml(draft.editedMetaDescription)}" />`
      : "",
    "</head>",
    "<body>",
    "<article>",
    `<h1>${escapeHtml(draft.editedTitle)}</h1>`,
    renderArticleHtml(draft),
    "</article>",
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEditorialHandoffText(draft: ArticleDraft) {
  return [
    `タイトル: ${draft.editedTitle}`,
    `スラッグ: ${draft.editedSlug}`,
    `メタディスクリプション: ${draft.editedMetaDescription}`,
    `タグ: ${joinCsv(draft.tags) || "未設定"}`,
    `カテゴリ: ${joinCsv(draft.categories) || "未設定"}`,
    "",
    "本文HTML:",
    renderArticleHtml(draft),
  ].join("\n");
}

function validateDraftForSubmission(draft: ArticleDraft) {
  const missingFields = [
    draft.editedTitle.trim() ? "" : "タイトル",
    draft.editedSlug.trim() ? "" : "スラッグ",
    stripHtmlText(draft.editedBodyHtml).trim() ? "" : "本文HTML",
  ].filter(Boolean);

  if (missingFields.length === 0) {
    return "";
  }

  return `${missingFields.join("、")}を入力してください。保存・承認・WordPress投稿の前に編集内容を確認してください。`;
}

function stripHtmlText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function safeDownloadName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "aio-article"
  );
}

function replaceImageReferences(
  html: string,
  previousImage: ArticleImage,
  nextImage: ArticleImage,
) {
  return html
    .replaceAll(previousImage.url, imageSrcForHtml(nextImage))
    .replaceAll(`aio-image:${previousImage.id}`, `aio-image:${nextImage.id}`);
}

function prepareDraftForSave(draft: ArticleDraft): ArticleDraft {
  return {
    ...draft,
    inputPayload: {
      ...draft.inputPayload,
      author: sanitizeAuthorPayload(draft.inputPayload.author),
      visualTone: sanitizeVisualTonePayload(draft.inputPayload.visualTone),
    },
    author: sanitizeAuthorPayload(draft.author),
    editedBodyHtml: stripInlineDataUrls(draft.editedBodyHtml),
    aiResult: {
      ...draft.aiResult,
      body_html: stripInlineDataUrls(draft.aiResult.body_html),
    },
    images: draft.images.map((image) =>
      isDataUrl(image.url)
        ? {
            ...image,
            url: "",
            path: image.path ?? "data-url-omitted",
          }
        : image,
    ),
  };
}

function sanitizeAuthorPayload(author: AuthorInput): AuthorInput {
  return {
    ...author,
    imageUrl: author.imageUrl && isDataUrl(author.imageUrl) ? "" : author.imageUrl,
  };
}

function sanitizeVisualTonePayload(visualTone: VisualToneInput): VisualToneInput {
  if (visualTone.uploadedImageUrl && isDataUrl(visualTone.uploadedImageUrl)) {
    return {
      ...visualTone,
      uploadedImageUrl: "",
      uploadedImagePath: visualTone.uploadedImagePath ?? "data-url-omitted",
    };
  }

  return visualTone;
}

function stripInlineDataUrls(html: string) {
  return html.replace(/src=(["'])data:[^"']+\1/g, 'src=""');
}

function isDataUrl(value?: string) {
  return Boolean(value?.startsWith("data:"));
}

function validateWordpressForm(form: {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  status: "draft" | "publish";
}) {
  if (!form.siteUrl.trim()) {
    return "WordPressサイトURLを入力してください。";
  }

  try {
    new URL(form.siteUrl.trim());
  } catch {
    return "WordPressサイトURLを正しいURL形式で入力してください。";
  }

  if (!form.username.trim()) {
    return "WordPressユーザー名を入力してください。";
  }

  if (!form.applicationPassword.trim()) {
    return "Application Passwordを入力してください。WordPressの通常ログインパスワードではなく、ユーザープロフィールで発行したApplication Passwordを使用してください。";
  }

  return "";
}

function normalizeWordpressConnectionError(message: string) {
  if (
    message.includes("applicationPassword") ||
    message.includes("Too small") ||
    message.includes("expected string to have >=1 characters") ||
    message.includes("Application Password")
  ) {
    return "Application Passwordを入力してください。WordPressの通常ログインパスワードではなく、ユーザープロフィールで発行したApplication Passwordを使用してください。";
  }

  if (message.includes("siteUrl") || message.includes("Invalid url")) {
    return "WordPressサイトURLを正しいURL形式で入力してください。";
  }

  if (message.includes("username")) {
    return "WordPressユーザー名を入力してください。";
  }

  return message || "WordPress接続情報を確認してください。";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function apiPost<T>(
  url: string,
  body: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    signal: options.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as ApiResult<T>;
  if (response.status === 413) {
    throw new Error(
      "送信データが大きすぎます。生成画像やアップロード画像の保存先を確認してください。",
    );
  }
  if (!response.ok || json.ok === false) {
    throw new Error([json.error, json.detail].filter(Boolean).join(" / ") || response.statusText);
  }
  return json as T;
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "GET" });
  const json = (await response.json().catch(() => ({}))) as ApiResult<T>;
  if (!response.ok || json.ok === false) {
    throw new Error([json.error, json.detail].filter(Boolean).join(" / ") || response.statusText);
  }
  return json as T;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Article generation stopped.", "AbortError");
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function imageGenerationEstimate(count: ImageCount, mode: VisualToneInput["mode"]) {
  if (count === 0) {
    return "生成目安：画像生成なし";
  }

  if (mode === "upload") {
    return "生成目安：1分未満（アップロード画像を反映）";
  }

  const minutes: Record<ImageCount, string> = {
    0: "画像生成なし",
    1: "約1〜2分",
    2: "約2〜4分",
    3: "約3〜5分",
  };
  return `生成目安：${minutes[count]}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("ja-JP")}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function extractAttachment(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/extract-file-content", { method: "POST", body: formData });
  const json = (await response.json().catch(() => ({}))) as ApiResult<{
    attachment: AttachedFileInput;
  }>;
  if (!response.ok || json.ok === false) {
    throw new Error([json.error, json.detail].filter(Boolean).join(" / ") || response.statusText);
  }
  return json;
}

async function uploadImage(file: File, folder: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const response = await fetch("/api/upload-image", { method: "POST", body: formData });
  const json = (await response.json().catch(() => ({}))) as ApiResult<{
    url: string;
    path: string;
    filename: string;
  }>;
  if (!response.ok || json.ok === false) {
    throw new Error([json.error, json.detail].filter(Boolean).join(" / ") || response.statusText);
  }
  return json;
}

function readError(error: unknown) {
  const message = normalizeErrorMessage(
    error instanceof Error ? error.message : "処理に失敗しました。",
  );
  return message.length > 420 ? `${message.slice(0, 420)}...` : message;
}

function mergeAttachmentRetries(
  current: AttachedFileInput[],
  incoming: AttachedFileInput[],
) {
  const merged = [...current];

  for (const file of incoming) {
    const retryIndex = merged.findIndex((existing) => isSameAttachmentFile(existing, file));
    if (retryIndex >= 0) {
      merged[retryIndex] = file;
    } else {
      merged.push(file);
    }
  }

  return merged;
}

function isSameAttachmentFile(first: AttachedFileInput, second: AttachedFileInput) {
  return first.name === second.name && first.size === second.size && first.type === second.type;
}

function normalizeErrorMessage(message: string) {
  return message
    .replaceAll("Failed to fetch", "通信エラー")
    .replaceAll(
      "unsupported Unicode escape sequence",
      "保存できない制御文字が含まれていたため、保存用に安全化してください",
    )
    .replaceAll(
      "Generation job not found.",
      "生成ジョブが見つかりません。古い生成状態をクリアし、もう一度「AIによる記事作成」を実行してください。",
    )
    .replaceAll("\\u0000 cannot be converted to text", "null文字は保存できません");
}

function formatFetchReason(reason?: string) {
  if (!reason) {
    return "";
  }

  return normalizeErrorMessage(reason)
    .replaceAll(
      "Page text was limited, so metadata and headings were used.",
      "本文量が少ないため、メタ情報・見出しを利用しました。",
    )
    .replaceAll("Could not extract enough page text.", "十分な本文を抽出できませんでした。")
    .replaceAll("Request timed out.", "通信がタイムアウトしました。");
}
