import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");

describe("Supabase migration contract", () => {
  test("preserves the published gateway migration before additive hardening", async () => {
    const filenames = (await readdir(migrationDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    const requiredMigrations = [
      "001_initial_schema.sql",
      "002_aio_gateway_token_store.sql",
      "003_harden_aio_schema.sql",
    ];
    expect(filenames).toEqual(expect.arrayContaining(requiredMigrations));
    expect(filenames.indexOf(requiredMigrations[0])).toBeLessThan(
      filenames.indexOf(requiredMigrations[1]),
    );
    expect(filenames.indexOf(requiredMigrations[1])).toBeLessThan(
      filenames.indexOf(requiredMigrations[2]),
    );

    const hardeningSql = await readFile(
      path.join(migrationDirectory, "003_harden_aio_schema.sql"),
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

  test("adds the guarded generation completion without changing earlier objects", async () => {
    const { GENERATION_JOB_EXPIRY_MS, GENERATION_JOB_NOT_ACTIVE_SQLSTATE } = await import("@/lib/server/generation-jobs");
    const filenames = (await readdir(migrationDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();
    const guardMigration = "20261117051104_guarded_generation_completion.sql";
    expect(filenames.indexOf(guardMigration)).toBeGreaterThan(
      filenames.indexOf("20261109125814_atomic_draft_save.sql"),
    );
    const sql = await readFile(path.join(migrationDirectory, guardMigration), "utf8");
    const signature = "public.aio_complete_generation_job(jsonb, timestamptz, jsonb, jsonb)";

    // Additive: one new function; nothing existing is dropped, altered or redefined.
    expect(sql.match(/create or replace function/gi)).toEqual(["create or replace function"]);
    expect(sql).toContain("create or replace function public.aio_complete_generation_job(");
    expect(sql).not.toMatch(/\b(?:drop|alter|truncate)\b/i);
    expect(sql).not.toMatch(/\b(?:insert\s+into|delete\s+from)\b/i);
    // Same conventions as aio_save_draft.
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = pg_catalog, public");
    // One transaction: lock the job row, save the draft, complete the job.
    expect(sql).toContain("from public.article_inputs where id = job_id for update");
    expect(sql).toContain("perform public.aio_save_draft(draft_row, image_rows, null)");
    expect(sql).toContain("update public.article_inputs");
    // The deadline of the server, read from the database clock before and again after the writes.
    expect(sql).toContain(`interval '${GENERATION_JOB_EXPIRY_MS / 60_000} minutes'`);
    expect(sql.match(/if clock_timestamp\(\) >= stored\.created_at \+ completion_deadline then/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\bnow\(\)/);
    expect(sql).toContain(`errcode = '${GENERATION_JOB_NOT_ACTIVE_SQLSTATE}'`);
    // Service role only.
    expect(sql).toContain(`revoke all on function ${signature} from public, anon, authenticated;`);
    expect(sql).toContain(`grant execute on function ${signature} to service_role;`);
    expect(sql).not.toMatch(/\bgrant\b[^;]*\bto\b[^;]*\b(?:anon|authenticated|public)\b/i);
  });

  test("keeps production gateway credentials out of tracked migrations", async () => {
    const filenames = (await readdir(migrationDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();
    const gatewaySql = await readFile(
      path.join(migrationDirectory, "002_aio_gateway_token_store.sql"),
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

    const gatewayDataMutation =
      /\b(?:insert\s+into|update|delete\s+from|merge\s+into|copy|truncate(?:\s+table)?)\s+(?:"?public"?\.)?"?aio_gateway_tokens"?\b/i;
    for (const filename of filenames) {
      const migrationSql = await readFile(path.join(migrationDirectory, filename), "utf8");
      expect(migrationSql, `${filename} must not provision gateway credentials`).not.toMatch(
        gatewayDataMutation,
      );
    }
  });
});
