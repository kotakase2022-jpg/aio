export type KeyValueInput = {
  id: string;
  url?: string;
  text?: string;
};

export type AttachedFileInput = {
  id: string;
  name: string;
  type: string;
  size: number;
  ok: boolean;
  text?: string;
  textLength: number;
  error?: string;
  extractedAt: string;
};

export type VisualToneMode = "preset" | "custom" | "upload";

export type ImageCount = 0 | 1 | 2 | 3;

export type WordCount = 1000 | 2000 | 3000 | 4000 | 5000 | 6000;

export type VisualToneInput = {
  mode: VisualToneMode;
  preset?: string;
  custom?: string;
  uploadedImageUrl?: string;
  uploadedImagePath?: string;
  uploadedImageName?: string;
};

export type AuthorInput = {
  name?: string;
  title?: string;
  bio?: string;
  imageUrl?: string;
  imagePath?: string;
};

export type FetchResult = {
  url: string;
  title?: string;
  text?: string;
  ok: boolean;
  reason?: string;
  sourceType?: "url" | "manual" | "file";
  fileName?: string;
  fileType?: string;
};

export type CompetitorInsight = {
  url: string;
  title: string;
  majorPoints: string[];
  differentiationPoints: string[];
  recommendations: string[];
};

export type CompetitorResearchResult = {
  summary: string;
  queries: string[];
  insights: CompetitorInsight[];
};

export type Heading = {
  level: "h2" | "h3";
  text: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type ImagePrompt = {
  slot: "featured" | "inline-1" | "inline-2";
  purpose: string;
  prompt: string;
  alt_text: string;
};

export type SourceItem = {
  url: string;
  title: string;
  usage_notes: string;
};

export type AioScoreSelfEvaluation = {
  score: number;
  strengths: string[];
  improvements: string[];
};

export type ThemeCandidate = {
  title: string;
  keywords: string[];
  targetReader: string;
  searchIntent: string;
  angle: string;
};

export type ThemeCandidateResult = {
  summary: string;
  candidates: ThemeCandidate[];
};

export type ArticleGenerationResult = {
  title_candidates: string[];
  selected_title: string;
  meta_description: string;
  target_reader: string;
  search_intent: string;
  article_summary: string;
  headings: Heading[];
  body_html: string;
  faq_items: FaqItem[];
  key_takeaways: string[];
  image_prompts: ImagePrompt[];
  suggested_slug: string;
  tags: string[];
  categories: string[];
  sources: SourceItem[];
  competitor_insights: CompetitorInsight[];
  aio_score_self_evaluation: AioScoreSelfEvaluation;
};

export type ArticleImage = {
  id: string;
  slot: "featured" | "inline-1" | "inline-2";
  url: string;
  path?: string;
  prompt: string;
  altText: string;
  source: "generated" | "uploaded";
};

export type DraftStatus = "draft" | "approved" | "posted" | "failed";

export type ArticleDraft = {
  id: string;
  inputPayload: ArticleFormPayload;
  fetchedReferences: FetchResult[];
  fetchedCompetitors: FetchResult[];
  competitorResearch?: CompetitorResearchResult;
  aiResult: ArticleGenerationResult;
  editedTitle: string;
  editedSlug: string;
  editedMetaDescription: string;
  editedBodyHtml: string;
  faqItems: FaqItem[];
  tags: string[];
  categories: string[];
  images: ArticleImage[];
  author: AuthorInput;
  status: DraftStatus;
  wordpressPostUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type ArticleFormPayload = {
  references: KeyValueInput[];
  competitors: KeyValueInput[];
  referenceFiles?: AttachedFileInput[];
  competitorFiles?: AttachedFileInput[];
  theme: string;
  primaryInfoTypes?: import("@/lib/primary-information").PrimaryInformationType[];
  primaryInfo?: string;
  closingText: string;
  author: AuthorInput;
  visualTone: VisualToneInput;
  imageCount?: ImageCount;
  wordCount?: WordCount;
  regenerationInstruction?: string;
};

export type GenerationStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
};

export type WordpressConnection = {
  id: string;
  siteUrl: string;
  username: string;
  connectionToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerationJobStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export type GenerationJob = {
  kind: "article_generation_job";
  id: string;
  status: GenerationJobStatus;
  steps: GenerationStep[];
  inputPayload: ArticleFormPayload;
  competitorResearch?: CompetitorResearchResult | null;
  fetchedReferences: FetchResult[];
  fetchedCompetitors: FetchResult[];
  draft?: ArticleDraft;
  draftId?: string;
  error?: string;
  wordpressPostStatus?: "draft" | "publish";
  wordpressPostUrl?: string;
  wordpressPostedAt?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
};

export type GenerationLogSummary = {
  id: string;
  status: GenerationJobStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  inputSummary: string;
  outputTitle?: string;
  outputSlug?: string;
  draftStatus?: DraftStatus;
  wordpressPostStatus?: "draft" | "publish";
  wordpressPostUrl?: string;
  error?: string;
};
