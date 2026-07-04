import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  basicAuth,
  cleanEnvValue,
  expectLiveContractEnabled,
  expectNonProductionConfirmed,
  expectRequiredEnv,
  loadLiveEnv,
} from "./live-test-helpers";

describe("WordPress live sandbox contract", () => {
  test(
    "creates and deletes a disposable sandbox draft post",
    async () => {
      loadLiveEnv();
      expectLiveContractEnabled();
      expectNonProductionConfirmed();
      expect(cleanEnvValue(process.env.AIO_LIVE_WORDPRESS_ALLOW_POST)).toBe("1");
      expectRequiredEnv([
        "WORDPRESS_SANDBOX_SITE_URL",
        "WORDPRESS_SANDBOX_USERNAME",
        "WORDPRESS_SANDBOX_APPLICATION_PASSWORD",
      ]);

      const tempDir = await mkdtemp(path.join(os.tmpdir(), "aio-wp-live-"));
      const siteUrl = cleanEnvValue(process.env.WORDPRESS_SANDBOX_SITE_URL).replace(/\/$/, "");
      const username = cleanEnvValue(process.env.WORDPRESS_SANDBOX_USERNAME);
      const applicationPassword = cleanEnvValue(process.env.WORDPRESS_SANDBOX_APPLICATION_PASSWORD);
      const slug = `aio-live-contract-${Date.now()}`;
      const authHeader = basicAuth(username, applicationPassword);
      let postId: number | undefined;

      process.env.AIO_LOCAL_DATA_DIR = tempDir;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "";
      process.env.SUPABASE_GATEWAY_TOKEN = "";
      process.env.VERCEL = "";
      process.env.WORDPRESS_ENCRYPTION_KEY =
        cleanEnvValue(process.env.WORDPRESS_ENCRYPTION_KEY) ||
        "live-wordpress-contract-key-32-bytes";
      vi.resetModules();

      try {
        const { createSampleDraft } = await import("../fixtures/article");
        const { saveWordpressConnection, publishDraftToWordpress } = await import(
          "@/lib/server/wordpress"
        );
        const connection = await saveWordpressConnection({
          siteUrl,
          username,
          applicationPassword,
        });
        const draft = createSampleDraft({
          id: slug,
          status: "approved",
          editedTitle: "AIO live contract disposable draft",
          editedSlug: slug,
          editedMetaDescription: "Disposable sandbox draft created by AIO live contract tests.",
          editedBodyHtml:
            "<h2>AIO live contract</h2><p>This disposable draft verifies WordPress REST draft posting and cleanup.</p>",
          faqItems: [],
          tags: [],
          categories: [],
          images: [],
        });

        const result = await publishDraftToWordpress({
          draft,
          connectionId: connection.id,
          status: "draft",
          origin: siteUrl,
        });
        const posts = await findWordpressPostsBySlug(siteUrl, authHeader, slug);
        postId = posts[0]?.id;

        expect(result.draft.status).toBe("posted");
        expect(result.postUrl.length).toBeGreaterThan(0);
        expect(postId).toBeGreaterThan(0);
      } finally {
        if (postId) {
          const cleanup = await deleteWordpressPost(siteUrl, authHeader, postId);
          expect(cleanup.ok).toBe(true);
        }
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    120_000,
  );
});

async function findWordpressPostsBySlug(siteUrl: string, authHeader: string, slug: string) {
  const response = await fetch(
    `${siteUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(
      slug,
    )}&status=draft,publish,pending,private,future&context=edit&per_page=10`,
    {
      headers: { Authorization: authHeader },
    },
  );
  expect(response.ok).toBe(true);
  return (await response.json()) as Array<{ id?: number }>;
}

async function deleteWordpressPost(siteUrl: string, authHeader: string, postId: number) {
  const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts/${postId}?force=true`, {
    method: "DELETE",
    headers: { Authorization: authHeader },
  });
  return {
    ok: response.ok,
    status: response.status,
    detail: await response.text().catch(() => ""),
  };
}
