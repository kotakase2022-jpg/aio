import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");

describe("Supabase migration contract", () => {
  test("tracks the production hardening migration before the gateway store", async () => {
    const filenames = (await readdir(migrationDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    const requiredMigrations = [
      "001_initial_schema.sql",
      "002_harden_aio_schema.sql",
      "003_aio_gateway_token_store.sql",
    ];
    expect(filenames).toEqual(expect.arrayContaining(requiredMigrations));
    expect(filenames.indexOf(requiredMigrations[0])).toBeLessThan(
      filenames.indexOf(requiredMigrations[1]),
    );
    expect(filenames.indexOf(requiredMigrations[1])).toBeLessThan(
      filenames.indexOf(requiredMigrations[2]),
    );

    const hardeningSql = await readFile(
      path.join(migrationDirectory, "002_harden_aio_schema.sql"),
      "utf8",
    );
    expect(hardeningSql).toContain(
      'drop policy if exists "public read article assets" on storage.objects',
    );
    expect(hardeningSql).toContain(
      "revoke execute on function public.rls_auto_enable() from authenticated",
    );

    const expectedIndexes = [
      "projects_user_id_idx",
      "article_inputs_project_id_idx",
      "article_inputs_user_id_idx",
      "competitor_research_project_id_idx",
      "competitor_research_user_id_idx",
      "authors_user_id_idx",
      "article_drafts_project_id_idx",
      "article_drafts_user_id_idx",
      "article_images_draft_id_idx",
      "wordpress_connections_user_id_idx",
      "wordpress_posts_draft_id_idx",
      "wordpress_posts_connection_id_idx",
    ];
    for (const indexName of expectedIndexes) {
      expect(hardeningSql).toContain(`create index if not exists ${indexName}`);
    }
  });

  test("keeps production gateway credentials out of tracked migrations", async () => {
    const gatewaySql = await readFile(
      path.join(migrationDirectory, "003_aio_gateway_token_store.sql"),
      "utf8",
    );

    expect(gatewaySql).toContain("create table if not exists public.aio_gateway_tokens");
    expect(gatewaySql).toContain(
      "alter table public.aio_gateway_tokens enable row level security",
    );
    expect(gatewaySql).toContain("revoke all on public.aio_gateway_tokens from anon, authenticated");
    expect(gatewaySql).toContain(
      "grant select, insert, update, delete on public.aio_gateway_tokens to service_role",
    );
    expect(gatewaySql).toContain('create policy "deny client gateway token access"');
    expect(gatewaySql).toContain("to anon, authenticated");
    expect(gatewaySql).toContain("using (false)");
    expect(gatewaySql).toContain("with check (false)");
    expect(gatewaySql).not.toMatch(/values\s*\(\s*'[a-f0-9]{64}'/i);
  });
});
