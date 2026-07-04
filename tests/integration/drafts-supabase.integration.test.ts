import { beforeEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/server/supabase-gateway", () => ({
  callSupabaseGateway: vi.fn(),
  isSupabaseGatewayConfigured: vi.fn(() => false),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("draft persistence with Supabase", () => {
  test("upserts draft rows and replaces related image rows", async () => {
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    const { saveDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({ id: "draft-supabase-save" });
    const upsert = vi.fn(async () => ({ error: null }));
    const deleteEq = vi.fn(async () => ({ error: null }));
    const deleteImages = vi.fn(() => ({ eq: deleteEq }));
    const insertImages = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "article_drafts") {
        return { upsert };
      }

      return {
        delete: deleteImages,
        insert: insertImages,
      };
    });

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const result = await saveDraft(draft);

    expect(result).toEqual({ draft, storageMode: "supabase" });
    expect(from).toHaveBeenCalledWith("article_drafts");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "draft-supabase-save",
        input_payload: draft.inputPayload,
        edited_title: draft.editedTitle,
        generated_image_urls: ["https://example.com/featured.png"],
        status: "draft",
      }),
    );
    expect(deleteEq).toHaveBeenCalledWith("draft_id", "draft-supabase-save");
    expect(insertImages).toHaveBeenCalledWith([
      expect.objectContaining({
        draft_id: "draft-supabase-save",
        slot: "featured",
        image_url: "https://example.com/featured.png",
        storage_path: "generated/featured.png",
        source: "generated",
      }),
    ]);
  });

  test("hydrates drafts and image rows from Supabase without losing edited content", async () => {
    const { getSupabaseAdmin } = await import("@/lib/server/supabase");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({
      id: "draft-supabase-load",
      editedBodyHtml: "<h2>Edited</h2><p>Human reviewed body.</p>",
      status: "approved",
    });
    const draftRow = {
      id: draft.id,
      input_payload: draft.inputPayload,
      fetched_references: draft.fetchedReferences,
      fetched_competitors: draft.fetchedCompetitors,
      competitor_research: null,
      ai_result: draft.aiResult,
      edited_title: draft.editedTitle,
      edited_slug: draft.editedSlug,
      edited_meta_description: draft.editedMetaDescription,
      edited_body_html: draft.editedBodyHtml,
      faq_items: draft.faqItems,
      tags: draft.tags,
      categories: draft.categories,
      author_payload: draft.author,
      status: draft.status,
      wordpress_post_url: null,
      created_at: draft.createdAt,
      updated_at: draft.updatedAt,
    };
    const imageRows = [
      {
        id: "image-row-1",
        slot: "featured",
        image_url: "https://example.com/featured.png",
        storage_path: "generated/featured.png",
        prompt: "Clean B2B editorial visual",
        alt_text: "AIO workflow hero image",
        source: "generated",
      },
    ];
    const maybeSingle = vi.fn(async () => ({ data: draftRow, error: null }));
    const draftEq = vi.fn(() => ({ maybeSingle }));
    const draftSelect = vi.fn(() => ({ eq: draftEq }));
    const orderImages = vi.fn(async () => ({ data: imageRows, error: null }));
    const imageEq = vi.fn(() => ({ order: orderImages }));
    const imageSelect = vi.fn(() => ({ eq: imageEq }));
    const from = vi.fn((table: string) => {
      if (table === "article_drafts") {
        return { select: draftSelect };
      }

      return { select: imageSelect };
    });

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from,
    } as unknown as ReturnType<typeof getSupabaseAdmin>);

    const hydrated = await getDraft("draft-supabase-load");

    expect(hydrated).toMatchObject({
      id: "draft-supabase-load",
      editedBodyHtml: "<h2>Edited</h2><p>Human reviewed body.</p>",
      status: "approved",
      wordpressPostUrl: undefined,
    });
    expect(hydrated?.images).toEqual([
      {
        id: "image-row-1",
        slot: "featured",
        url: "https://example.com/featured.png",
        path: "generated/featured.png",
        prompt: "Clean B2B editorial visual",
        altText: "AIO workflow hero image",
        source: "generated",
      },
    ]);
    expect(draftEq).toHaveBeenCalledWith("id", "draft-supabase-load");
    expect(imageEq).toHaveBeenCalledWith("draft_id", "draft-supabase-load");
    expect(orderImages).toHaveBeenCalledWith("created_at", { ascending: true });
  });
});
