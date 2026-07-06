import { afterEach, describe, expect, test, vi } from "vitest";
import { createSampleDraft } from "../fixtures/article";

vi.mock("@/lib/server/wordpress", () => ({
  publishDraftToWordpress: vi.fn(),
}));

vi.mock("@/lib/server/drafts", () => ({
  getDraft: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("WordPress post route", () => {
  test("delegates approved draft posting with request origin and selected status", async () => {
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({ status: "approved" });
    vi.mocked(getDraft).mockResolvedValueOnce(draft);
    vi.mocked(publishDraftToWordpress).mockResolvedValueOnce({
      postUrl: "https://wordpress.example.com/post",
      draft: {
        ...draft,
        status: "posted",
        wordpressPostUrl: "https://wordpress.example.com/post",
      },
    });
    const { POST } = await import("@/app/api/wordpress/post/route");

    const response = await POST(
      new Request("http://localhost/api/wordpress/post", {
        method: "POST",
        headers: { origin: "https://app.example.com" },
        body: JSON.stringify({
          draft,
          connectionId: "wp-connection-1",
          connection: {
            id: "wp-connection-1",
            siteUrl: "https://wordpress.example.com",
            username: "editor",
            connectionToken: "encrypted-token",
            createdAt: "2026-07-02T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
          status: "publish",
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.postUrl).toBe("https://wordpress.example.com/post");
    expect(publishDraftToWordpress).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ id: draft.id }),
        connectionId: "wp-connection-1",
        status: "publish",
        origin: "https://app.example.com",
      }),
    );
  });

  test("rejects unapproved drafts before calling WordPress publishing", async () => {
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");
    const { getDraft } = await import("@/lib/server/drafts");
    const draft = createSampleDraft({ status: "draft" });
    vi.mocked(getDraft).mockResolvedValueOnce(draft);
    const { POST } = await import("@/app/api/wordpress/post/route");

    const response = await POST(
      new Request("http://localhost/api/wordpress/post", {
        method: "POST",
        headers: { origin: "https://app.example.com" },
        body: JSON.stringify({
          draft,
          connectionId: "wp-connection-1",
          connection: {
            id: "wp-connection-1",
            siteUrl: "https://wordpress.example.com",
            username: "editor",
            connectionToken: "encrypted-token",
            createdAt: "2026-07-02T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
          status: "draft",
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toMatchObject({
      ok: false,
      error: "承認済みドラフトのみWordPress投稿できます。",
      detail: "先に「承認済みに変更」を押してから投稿してください。",
    });
    expect(publishDraftToWordpress).not.toHaveBeenCalled();
  });

  test("rejects a client-approved payload when the persisted draft is not approved", async () => {
    const { publishDraftToWordpress } = await import("@/lib/server/wordpress");
    const { getDraft } = await import("@/lib/server/drafts");
    const clientDraft = createSampleDraft({ status: "approved" });
    const persistedDraft = createSampleDraft({ id: clientDraft.id, status: "draft" });
    vi.mocked(getDraft).mockResolvedValueOnce(persistedDraft);
    const { POST } = await import("@/app/api/wordpress/post/route");

    const response = await POST(
      new Request("http://localhost/api/wordpress/post", {
        method: "POST",
        headers: { origin: "https://app.example.com" },
        body: JSON.stringify({
          draft: clientDraft,
          connectionId: "wp-connection-1",
          connection: {
            id: "wp-connection-1",
            siteUrl: "https://wordpress.example.com",
            username: "editor",
            connectionToken: "encrypted-token",
            createdAt: "2026-07-02T00:00:00.000Z",
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
          status: "draft",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(getDraft).toHaveBeenCalledWith(clientDraft.id);
    expect(publishDraftToWordpress).not.toHaveBeenCalled();
  });
});
