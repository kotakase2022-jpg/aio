# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Claude Code
- Next owner: User / Codex. Remaining:
  - Send Aizawa the evening reply. It is drafted outside this repository and has not been sent.
  - After the site side lifts its server's overseas REST restriction and exposes コラム to the REST API, retest 「投稿先」 and a draft post to コラム (section 3e).
  - Clean up own test records, with approval.
  - The session handoff of 2026-11-24 (`docs/session-handoff-2026-11-24.md`) is completed.
- Loop: 10
- Loop number inferred from: Loop 9 (Codex, 11/13) handed off to Claude Code; this is the first Claude record after it, for Aizawa's 11/16 re-verification items ② and ③.
- Phase: PR #50 (11/16) and PR #51 (11/17) released. Strict self-verification on 11/17 (section 3c): production write checks PASS on the current production; PR #53 (log sync beyond 100 jobs) released: `aio-store` v7 (14:29 JST) and the app `dpl_4vhEWVZSwNqnF3eeF3XKjPM4k55m` (16:03 JST), verified on production (section 2).
- 2026-11-24: Aizawa reported that the guide's 「投稿先」 (コラム) was missing in the tool. PR #58 adds the post-type choice, released 13:48 JST. PR #59 shows WordPress post failures under the post button (section 3d). PR #59 was squash-merged as `3d73e43` after the CodeRabbit re-review and released at 15:57 JST (`dpl_AkQuX4NMABeYSZSy24dFfoAb3BSp`, section 2).
- 2026-11-24 evening: Aizawa retested at 16:41–16:42 JST. Every REST call to the site got 403 from the site's server. The cause is not an app defect; the fix is on the site side (section 3e).
- Last updated: 2026-11-24 evening JST (Claude Code, local Windows session)

## 1. Current Goal
Aizawa 11/16 re-verification: the four article structures were confirmed fine. Remaining items:
- ③ (priority) generation logs listed only the newest 20, so older unposted articles could not be reopened, edited, saved, or posted.
- ② after draft save the "処理中" indicator sometimes stayed (observed on comparison and FAQ structures).
Customer was told results/operation guidance around 2026-11-18〜19 (external estimate, not a measured plan).

## 2. Current Branch / Commit / PR
- PR kotakase2022-jpg/aio#50 (`claude/aizawa-nov16-logs-and-save-status`) merged to main as `ed81c15`; production deployment `dpl_3TyMQRKm6Z63o55mPRoysRvKnSKu` promoted by the user on the Windows workstation (11/16 20:42 JST build). Read-only smoke on the canonical URL PASS (logs pages 2 / listed 36 / unpostedCompleted 32 / complete true). Rollback = promote `dpl_9aoGSRfatAYc1MqScMyPTgPecVAU` (previous production).
- PR kotakase2022-jpg/aio#51 (`claude/aizawa-nov16-production-checks`) squash-merged as `efebb89` on 11/17 after the owner's decisions (section 7). Main CI PASS.
- App release 2026-11-17, by the user on the Windows workstation:
  - Staged `efebb89` as `dpl_4GpH2wKgF3rAmoYN8HSvt7h6LtVJ` (Ready; local tree clean). The stage is SSO-protected, so instead of the smoke: `vercel curl` showed the app's own 401 with its security headers.
  - Promoted, then the read-only smoke on the canonical URL PASS (logs pages 2 / listed 36 / unpostedCompleted 32 / complete true).
  - Rollback = promote `dpl_3TyMQRKm6Z63o55mPRoysRvKnSKu` (PR #50).
- `aio-store` Edge Function, Supabase project `npdyfhqugniuxfxpgngh` (dashboard name `esg-chat-data-analysis`): v5 → v6 at 2026-11-17 13:10 JST. Deployed from this cloud session (owner approved) with Supabase CLI 3.2.0 `functions deploy --use-api --no-verify-jwt --yes` and an access token the owner saved as a network secret on the personal environment `aio`.
  - Before: v5 source matched `ed81c15` except one trailing blank line.
  - After: v6 = `efebb89` (contains `list_job_page`), ACTIVE, `verify_jwt` false. OPTIONS 200; an invalid gateway token gets the function's own 401 (so it boots and reads its token table).
  - Confirmed on 11/17 (section 3c): the app reads the list through `list_job_page` on the gateway path.
  - Rollback = redeploy the v5 source (`git show ed81c15:supabase/functions/aio-store/index.ts`; a downloaded copy is in the ignored `.verification-files/aio-store-backup-v5/`).
- PR kotakase2022-jpg/aio#53 (`claude/aizawa-nov17-log-sync-by-draft`) squash-merged as `028e84b` on 11/17. CI PASS; CodeRabbit: no actionable comments.
- `aio-store` v6 → v7 at 2026-11-17 14:29 JST, from this cloud session with the same command (adds `get_job_by_draft` only).
  - Before: v6 source matched `efebb89` (copy in the ignored `.verification-files/aio-store-backup-v6/`).
  - After: v7 = `028e84b`, ACTIVE, `verify_jwt` false, OPTIONS 200, invalid token → the function's own 401. The current app (`efebb89`) does not call the new action; the read-only smoke after the deploy PASS.
  - Rollback = redeploy the v6 source (`efebb89`).
- App release of `b28d093` (= `028e84b` plus docs), 2026-11-17 16:03 JST, from this cloud session: production `dpl_4vhEWVZSwNqnF3eeF3XKjPM4k55m` (canonical alias confirmed).
  - The first three Vercel tokens belonged to another account, which is not authorized for scope `sl2026`. The owner then saved a token of `kotakase2022-jpg` scoped to `sl2026` (network secret on environment `aio`).
  - That token cannot read the user (`/v2/user` 404), so the Vercel CLI stopped at start. The same steps were therefore run through the REST API:
    - 204 files: tracked files minus `.vercelignore` and the CLI defaults, identical to the file list of the previous CLI deployment `efebb89`.
    - `POST /v13/deployments` with `target: production`, `autoAssignCustomDomains: false` (= `--prod --skip-domain`) and git metadata. Result READY / STAGED; the build log shows Compiled successfully, 19 pages, all API routes.
    - `vercel curl` on the SSO-protected stage was not possible without the CLI. Instead: promote, then check the canonical URL at once with the rollback ready (recorded as the releaser's decision).
    - `POST /v10/projects/{id}/promote/{deployment}`, after which the production target and the canonical alias point to the new deployment.
  - After the release, all PASS:
    - 16:03 read-only smoke (2 pages / 37 / 33 unposted completed / complete).
    - 16:04 older-draft check. Page-2 customer job `6a79a954-a334-435f-bc08-02fda9844956` was opened read-only and matched. The own 11/17 article (job `f9f6177c-…`) was saved unchanged: no warning, revision advanced, log synced.
    - `aio-store` stats 16:03–16:04: 4 + 25 requests, all 2xx, 0 client and 0 server errors, so `get_job_by_draft` served the sync.
  - More than 100 jobs has not yet happened on production (37); that state is covered by the integration and E2E tests.
  - Rollback = promote `dpl_4GpH2wKgF3rAmoYN8HSvt7h6LtVJ` (`efebb89`). `aio-store` v7 can stay (compatible with both).
- PR kotakase2022-jpg/aio#58 (投稿先) squash-merged as `d41bd1f`, released 2026-11-24 13:48 JST as `dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN` from the cloud session (rollback `dpl_7p9Gv5UwUaHaiywBZXtkZeqCDyh8`). Details: `docs/aizawa-nov24-wordpress-destination.md` §検証.
- PR kotakase2022-jpg/aio#59 squash-merged as `3d73e43` at 15:54 JST (tree identical to the PR head `9398baa`, CI PASS). App release 2026-11-24 15:57 JST from a local Windows session: production `dpl_AkQuX4NMABeYSZSy24dFfoAb3BSp`.
  - Method: the same flow as PR #58 (production build without domains, checks, then promote), authenticated by the workstation's signed-in Vercel CLI.
    - REST calls go through `vercel api`; no token value was handled.
    - Upload: `vercel deploy --prod --skip-domain` from a clean worktree at `3d73e43` with the project link copied in. It ran without `--yes` in non-interactive mode, so a missing link would fail instead of creating a project.
  - 209 files. Against the previous production (208): 1 added (`docs/session-handoff-2026-11-24.md`), 6 changed, 0 removed. After staging, the deployment's sources matched the local list exactly.
  - Build READY / STAGED: Compiled successfully, 20 static pages, all 17 API routes including `/api/wordpress/post-types`, no error lines. Before the promote, the canonical domain still pointed to `dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN`.
  - Promote (`POST /v10/projects/{id}/promote/{deployment}`, 201) at 15:57:35 JST. Afterwards the canonical alias and the project's production target both point to the new deployment.
  - Sign-in-free checks at 15:57 JST: the login page is 200 with the form; unauthenticated logs, post-types and post all get 401; the old default code gets 401.
  - Not checked: the screens after login (the session has no access code).
  - Rollback = promote `dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN` (PR #58), then check that `alias` points to it.

## 3. What Was Done
- ③ cursor pagination for generation logs: `GET /api/generation-logs?cursor=&limit=` returns `{ logs, nextCursor, complete }`; first-page URL unchanged. Stable order = creation time desc + id (saving/posting no longer moves a log between pages). Supabase direct: SQL keyset; gateway (production): pages inside the existing `list_jobs` window (100 jobs / 400 newest-updated rows) and reports `complete:false` when that window is full; local: in-memory keyset. UI: 「さらに古いログを表示（20件ずつ）」, count badge, end/incomplete notices, load-more error keeps the list, automatic refresh keeps the loaded range (≤100).
- ② root cause fixed: job completion wrote `status:completed` and the save step `done` in two writes; a poll between them froze 「ドラフト保存: 処理中」. Now one write. Stored legacy records with completed + save `running` are presented as saved only when the canonical draft is readable (no DB rewrite), otherwise as unconfirmed.
- ② robustness: save/approve 60 s timeout; timeout / dropped connection / bare 502-504 are reported as **unconfirmed** (not success/failure), edits kept, retry hits the same draft ID; in-flight ref blocks double submit; save/approve routes compare-and-set against the revision read just before writing (late stale request → 409, lost-response retry → 200); polling retries transient loss up to 4 times, then shows an unconfirmed state and keeps the resume key; unknown generation start tells the editor to check logs before retrying; an unconfirmed WordPress post asks to check WordPress before posting again (no timeout added to posting).
- Details, evidence and the customer-facing guide: `docs/aizawa-nov16-followup.md`.

## 3b. Self-verification after release (follow-up branch)
- Found: (1) with more than 100 jobs the gateway `list_jobs` window hides the oldest logs again (③ recurs as data grows); (2) every log page read up to 400 full rows; (3) `complete` could be true while jobs outside the 400-row window were hidden; (4) a refresh during 「さらに古いログを表示」 dropped the page being loaded; (5) after an unconfirmed generation status, the primary button could start a second paid generation.
- Fixed: `aio-store` gains `list_job_page` (created_at/id keyset, jobs only, limit+1 rows); the app uses it first and falls back to the window paging on the old gateway's 400 `Unsupported gateway action.` (cached 5 min), so the app release is safe before the gateway deploy. A refresh during a pending older page includes that page. The primary/regenerate button re-checks a stored unconfirmed job instead of starting a new one.
- Gated production check scripts (not yet run successfully on production; the first attempt stopped at login because the entered access code was rejected, nothing was written): `scripts/production-older-draft-check.mjs`, extended `scripts/production-article-smoke.mjs`. Paused on the user's instruction.

## 3c. Strict self-verification (2026-11-17, this session; JST)
- Requirement-by-requirement check of ② / ③, the required tests and the six earlier features: table in `docs/aizawa-nov16-followup.md` §「11/17 厳密な自己検証」.
- Production, read-only:
  - 13:44 smoke PASS (2 pages / 36 / 32 unposted completed / complete). This was the first check after the v6 deploy at 13:10; the morning smoke ran before it.
  - The list uses `list_job_page`: the cursor carries the DB format `+00:00` (the fallback always issues `Z`), and `aio-store` stats show exactly our 4 + 2 list requests in those minutes, all 2xx. The save response later reported `storageMode: supabase-gateway`.
  - One read-only SQL count through the Supabase Management API: the team's own 11/13 draft ID matches exactly its job (1 of 36 job rows). No content was printed. Further direct DB queries were stopped after an auto-mode safety prompt.
- Production writes (approved on 11/16 as checks 2 and 3; current production `efebb89` + v6):
  - 14:12 `production-older-draft-check.mjs`: stopped before any save, caused by a race in the script (it clicked 「編集」 before the opened article had loaded). Fixed in PR #53: it now waits for the preview heading. A local 3 s delay reproduces the failure on the old script, and the fixed script passes.
  - 14:20 the same check with the fixed script, **PASS**:
    - The page-2 customer job `39287a76-875d-4d14-a6da-26f698fe14df` was opened read-only, and its title, body, status, save step, structure, table and FAQ settings matched.
    - One unchanged save of the own 11/13 article (job `4f8e7082-…`, draft `675536f8-…`, on page 1, since no own article is on page 2): fields unchanged, revision advanced, log synced, position kept.
  - 14:21–14:22 `production-article-smoke.mjs`, **PASS**:
    - One synthetic article (marker `AIO-RELEASE-SMOKE-ba2a0609-402e-432b-a7e5-90ccbd070399`, job `f9f6177c-d568-4a2d-bb2f-3868e2b2110f`, draft `dd20f96b-57c6-4896-a396-d753084abf53`; comparison, table none, FAQ none, image 0, 1000 chars).
    - The first completed poll already showed 「ドラフトを保存しました」.
    - The edit save had no warnings, and the article was first in the logs as 完了/未投稿.
    - Reopen restored the edits and modes. Preview, copy and download were identical. Readiness issues 0, no console or network errors.
- Found and fixed (PR #53): the log sync on save, approve, post and image regeneration searched only the 100 most recently updated jobs. Beyond that, an old article's log kept its old title and 「未投稿」 after saving or posting, with no warning (the article itself was saved; the post reservation still blocks duplicates).
  - `findGenerationJobForDraft` looks the job up by draft ID: one-row query on the service-role path, `get_job_by_draft` on the gateway with the window fallback for old gateways, all jobs locally.
  - New tests: 7 integration + 1 WordPress-path integration + 1 E2E, all failing on the previous code.
- Code check: the screen's 5 timers only clear transient messages, focus, abort requests (reported as unconfirmed) or pace polling; none hides a processing state.

## 3d. WordPress 投稿先 (2026-11-24, PR #58)
- Report: the guide says to choose 「投稿先」=「コラム」 (preselected from the second time) and that drafts appear under コラム. The tool showed no such field, and a draft posted without it was not under コラム. The attached Google Drive file could not be opened from this session.
- Cause: the tool had no destination and always posted to `/wp-json/wp/v2/posts` (standard 投稿). No branch or commit ever had a post-type choice; the guide came from outside this repository.
- Production record (read-only, owner approved): `wordpress_posts` has 0 rows. The reservation stays after a completed post and is released after a WordPress 4xx or a failure before the post, so **according to the app's record the test post did not complete**.
  - The WordPress side was not read, so whether a draft exists in 投稿 is not verified (CodeRabbit). WordPress creates the post before it sets terms and other fields, so a 4xx returned at that stage would leave the post in WordPress and 0 rows here. Ask for 投稿 drafts to be checked before posting again.
  - The failure message was shown only at the top of the page (`active-error`), out of sight of the post button.
  - The cause is unknown (no record kept, Vercel logs expired). Candidates: user permissions (term creation or media upload), Application Password, REST API blocked, network.
  - The article should still be 承認済み (not verified). No data change is needed to post it again to コラム.
- A second read (connections, approved drafts) was refused by the auto-mode safety check as outside the approved scope and was not run.
- Change:
  - `POST /api/wordpress/post-types` lists creatable post types from `/wp/v2/types?context=edit`.
  - The screen adds a 「投稿先」 select. A first post to a site needs an explicit choice; the choice is remembered per site in `localStorage`.
  - The server posts to the type's own REST route after re-reading the list, before the reservation, and skips unsupported fields with one warning.
  - Requests without a post type, or with `post`, behave exactly as before.
- Not verified: the customer's WordPress (no post, no type read). コラム appears only if it has `show_in_rest`, the connected user can edit it, and it supports title and editor (types without both are excluded, CodeRabbit).
- Not possible from this session: a production UI check after login, because the access code changed.
- PR #59: WordPress post failures and unconfirmed outcomes now appear right under the post button (`wordpress-post-error`, `role="alert"`), not at the page top; editing the WordPress form clears them.
  - `8b93cfc` (CodeRabbit follow-up on PR #58): a custom post type whose response lacks `supports` is no longer listed, and posting to it is refused before the reservation. 投稿 is unchanged.
  - `06e283b` (CodeRabbit on PR #59): the post result (failure or success) carries its draft id and is shown only while that article is open. Before, opening another article from the logs kept showing it; the old page-top banner was cleared on open, so this part was a regression of PR #59. A result added below the visible area is scrolled into view (`block: "nearest"`). The reply draft no longer says unfamiliar categories or tags can be deleted, because the tool reuses existing terms with the same name.
- Record and customer reply draft: `docs/aizawa-nov24-wordpress-destination.md`.

## 3e. Aizawa's retest after PR #59 (2026-11-24 evening)
- Report, after the 15:57 release:
  - ① Their admin has no 投稿 menu. The reply had asked them to check 投稿 drafts.
  - ② 「投稿先」 shows 投稿 but not コラム.
  - ③ Posting with 投稿 and 下書き fails.
  - This session read their screenshot (16:43) through the Google Drive connector.
- Screen:
  - Under the post button: 「WordPressカテゴリーの検索に失敗しました。」
  - In 投稿先: 「WordPressの投稿先一覧を取得できませんでした。」, with the fallback to 投稿.
- Production request log (Vercel, read only, no DB query), 16:41–16:42 JST, all on `dpl_AkQuX4NMABeYSZSy24dFfoAb3BSp`:
  - `POST /api/wordpress/connect`: 200 ×2
  - `POST /api/wordpress/post-types`: 403 ×2
  - `POST /api/wordpress/post`: 403 ×2
- Reading of the log:
  - These routes pass on the WordPress response status, so the site's server answered 403. Wrong credentials give 401 in WordPress.
  - The post's 403 came from the category search. That search runs before the post is created, and the reservation was released.
  - So these attempts created nothing in WordPress. This comes from the log and the code; the WordPress side was not read.
- Read-only checks from this PC in Japan, without credentials:
  - The site's REST API answered 200 for the root, the category search and the types list.
  - `types?context=edit` returned 401, as expected without credentials.
  - The app's functions run in `iad1` (US).
- Cause (inferred; the site's server settings were not seen): the hosting's overseas-access restriction for the REST API, which is on by default.
  - Since 2025 it also covers Japanese IPs of major overseas clouds. Moving the functions to `hnd1` would therefore not help.
  - Its allow list needs a fixed source IP. The Vercel Hobby plan does not provide one.
  - The morning failure probably had the same cause, but its logs had expired.
- コラム is still not exposed to the REST API: it was missing from the public `/wp/v2/types` list at about 17:40 JST. Even after the restriction is lifted, it needs `show_in_rest` on the site.
- 投稿 is not a usable destination for them, since their admin has no 投稿 menu. The request to check 投稿 drafts is withdrawn.
- Site-side fix, asked in the new reply:
  1. Turn only the REST API item of the overseas restriction OFF.
  2. Have the site's developer expose コラム to the REST API, keeping the classic editor.
  3. Then save the connection again and post a draft to コラム.
- Replies:
  - The evening reply is a draft and has not been sent. It was given to the owner outside this repository, because it names the hosting company and other site specifics.
  - The earlier reply in `docs/aizawa-nov24-wordpress-destination.md` was sent: Aizawa answered its requests.
- Vantage point: WebFetch from the Windows workstation goes out through the owner's line in Japan, so it cannot test overseas access. Use the production request log instead (section 14).
- App change in the same PR (#61, not released yet). Its release needs the owner's approval (section 10).
  - For a WordPress 401 or 403, the error detail now says what usually causes it and what to do.
  - The detail then gives what the site said, with the markup removed.
  - A 403 is split into two cases:
    - WordPress itself refused, with a `rest_` error code. The hint points to the role of the connected user (編集者 or above).
    - It was refused before WordPress, with no such code (for example an HTML page). The hint points to the server's overseas restriction of the REST API, a WAF or a security plugin.
  - The texts are in `src/lib/wordpress-rejection-hints.ts`. Every WordPress request in `src/lib/server/wordpress.ts` uses them.
  - In 投稿先, the next step follows the status:
    - after a 403, press 「再読み込み」 once the cause is fixed;
    - after a 401, nothing more is needed, because 保存 reloads the list.

## 4. Files Changed
- `src/lib/server/generation-jobs.ts`, `src/lib/server/article-generation-job-runner.ts`, `src/lib/server/drafts.ts`, `src/types/aio.ts`
- `src/app/api/generation-logs/route.ts`, `src/app/api/generation-jobs/[id]/route.ts`, `src/app/api/save-draft/route.ts`, `src/app/api/approve-draft/route.ts`
- `src/components/aio/article-generator-app.tsx`
- Tests: new `tests/integration/generation-job-completion|generation-logs-pagination|draft-save-retry.integration.test.ts`; new E2E in `tests/e2e/aio-workflow.spec.ts`; `playwright.config.ts` isolates the E2E server's local store (`AIO_E2E_LOCAL_DATA_DIR`). Four existing tests that used the removed `listGenerationLogs` helper were migrated with unchanged assertions.
- `scripts/production-smoke.mjs`: adds read-only paged-log checks (paged API deployed, all pages without duplicates, load-more grows the list) and prints counts only; mutation blocking unchanged. Verified against a local production build with a git-ignored copy (host/browser lines only); not run on production.
- Docs: `docs/aizawa-nov16-followup.md`, `docs/testing.md`, this file. AGENTS.md / CLAUDE.md unchanged.
- PR #53: `src/lib/server/generation-jobs.ts`, `supabase/functions/aio-store/index.ts`, `scripts/production-older-draft-check.mjs`, `tests/integration/generation-logs-pagination.integration.test.ts`, `tests/integration/wordpress.integration.test.ts`, `tests/e2e/aio-workflow.spec.ts`.
- PR #61:
  - Code: `src/lib/wordpress-rejection-hints.ts` (new), `src/lib/server/wordpress.ts`, `src/components/aio/article-generator-app.tsx`.
  - Tests: `tests/integration/wordpress-post-destination.integration.test.ts`, `tests/integration/wordpress.integration.test.ts`, `tests/e2e/aio-workflow.spec.ts`.
  - Docs: this file, `docs/aizawa-nov24-wordpress-destination.md`.

## 5. Current Status
- Local quality gate: see section 9 (all steps run in this session on 2026-11-16).
- Repro-first: ② 3 failed / 0 passed before fix; ③ 17 failed / 1 passed before fix (the passing one is the auth-gate regression guard); stale-overwrite test fails when the save route is reverted to the old call.
- PR #50 and PR #51: deployed; read-only smoke verified on both releases (section 2).
- `aio-store` v7 deployed and boot-checked; `list_job_page` is confirmed in use (section 3c).
- The approved write checks PASSED on 11/17 before the release (section 3c). After the release of PR #53, the older-draft check passed again and the `get_job_by_draft` path was confirmed on production (section 2).
- Production changes made from this session: `aio-store` v6 → v7; the app release `dpl_4vhEWVZSwNqnF3eeF3XKjPM4k55m`; one unchanged save of the team's own 11/13 article; one synthetic article (one paid generation) with its own edit save, later saved once more unchanged by the post-release check. No WordPress post. No customer article changed. No message to Aizawa (draft only).
- 2026-11-24: PR #58 and PR #59 are released (section 2). The local session that released PR #59 changed production only by that app release: no WordPress post, no production DB query, no message to Aizawa (the reply is a draft).

## 6. Known Issues
- Gateway window: resolved by `aio-store` v6 (`list_job_page`), confirmed in use on 11/17.
- Accepted by the owner as known limitations (11/17): the late-write duplicate window and the browser clock jump (sections 3b and 7). A full guard needs a save-RPC migration; a follow-up task was suggested.
- Security, separate task (owner, 11/17): `src/app/api/demo-auth/route.ts` accepts a default code committed in this public repository when `DEMO_ACCESS_CODE` is unset. The owner confirms the production `DEMO_ACCESS_CODE` holds a strong, non-default value (sets it and redeploys if not), then the fallback is removed. Production specifics are reported to the owner directly, not in this public repository.
- Log sync on save/post beyond the 100 most recently updated jobs: fixed in PR #53 and released on 11/17 (v7 + app); the new path is confirmed on production.
- Dev-only dependencies: `npm audit` reports 7 moderate advisories (typescript-eslint chain, minimatch); production dependencies 0.
- The other Vercel account used first has no two-factor authentication (CLI warning). Its three tokens created for this release are unused now and can be revoked; the `kotakase2022-jpg` token saved on environment `aio` should be revoked when no longer needed.
- WordPress post requests have no client timeout (existing reservation prevents duplicates).
- WordPress errors:
  - Before PR #61, a 403 from the site appeared only as 「WordPressカテゴリーの検索に失敗しました。」 (section 3e).
  - PR #61 adds hints for 401 and 403. It is not released yet.
  - Other statuses still show only the failed step and what the site said.
  - 保存 does not check the credentials, so a wrong Application Password shows up only when 投稿先 loads or when posting.
- The WordPress connection lives only in page state. After a reload the user enters the Application Password and presses 保存 again. 投稿先 loads only after 保存 or 「再読み込み」.
- Compare-and-set protects against delays after the server reads the revision, not before.
- Unverified in this session: Codex history, the Windows working tree, production version and data counts, the customer Google Doc.
- Earlier items still open: shared demo auth (no per-user isolation), human source review, 11/13 pending own records cleanup (below).

## 7. CodeRabbit Review
- PR kotakase2022-jpg/aio#50, review of `8344f5e`: 5 actionable comments.
  - Fixed: inherited `VERCEL` could split the E2E seed/read store (`VERCEL: ""` in webServer env); a 2xx response with an unreadable body is now an unconfirmed outcome; refresh assertions now wait for the `limit=` refresh response before counting rows.
  - Intentionally not adopted in this PR (recorded on the threads): (a) a stale request delayed *before* the server reads the revision can still win: not only after the 60 s timeout but also on a quick retry after an early connection drop if the old request starts processing late (an earlier "only >60 s delay" statement was wrong and was corrected after CodeRabbit's reply); concurrent editing from several screens stays last-writer-wins as before this PR; (b) concurrent *first* saves of a draft that has no stored row are not create-only (legacy drafts without a canonical row only). Both need client base-revision tracking plus a request ID and/or an RPC change (migration). Follow-up recommended.
- Re-review requested with `@coderabbitai review` after the rate limit reset (09:07 UTC): review of `8344f5e..0585dbb` raised 2 Minor findings, both fixed in the next commit: the smoke now rejects duplicate IDs inside the first page too, and a refresh of more than 100 listed logs reads the range page by page (≤100 per request) instead of dropping the oldest entries.
- PR kotakase2022-jpg/aio#51 (follow-up), review of `c796ef9`: 6 inline + 2 outside-diff findings (1 Major). All verified as real and fixed in `32409be` and the next commit:
  - (Major) a 5xx status read removed the stored job ID and re-enabled duplicate starts. Now 5xx is retried and keeps the ID; 404 still clears it.
  - A failing manual re-check keeps the ID while the job could still be generating: 7 min from start, past the 300 s worker budget and the 6 min server expiry. After that it releases the ID with guidance. Changed after CodeRabbit's follow-up reply on the thread.
  - The worker itself also enforces the 6 min deadline: `assertGenerationJobActive` runs before every step, including right before saving. Outside Vercel nothing stops the request at 300 s, so a job past its deadline fails without saving an article (integration test). It is checked once more, synchronously, right before the save call.
  - Remaining (CodeRabbit, awaiting the owner's decision): a save request that itself stalls for more than 1 minute could land after the browser released the ID, adding one late draft (no overwrite).
    - On Vercel the worker runs in `after()` within `maxDuration = 300` and never makes the completion write after it is stopped. A late in-flight save there only leaves an unlinked draft row (the existing "orphan draft" issue).
    - A completion update sent just before the stop and applied after 7 min could still show a second article. This needs that late write plus 5xx status reads for 7+ min plus a new start.
    - Outside Vercel, a save stalled for more than 1 minute is enough.
    - A full guard needs the deadline inside the save RPC transaction (migration).
  - The primary button now stays enabled for a re-check when the form was never restored.
  - Overlapping refreshes keep the requested range.
  - The article smoke has no access-code fallback.
  - The older-draft check bounds page loads by the listed pages and takes no screenshot.
  - Doc fixes: page to the end; the rollback target of the follow-up release is `dpl_3TyMQRKm6Z63o55mPRoysRvKnSKu`.
  - CodeRabbit was rate-limited after `32409be`; a re-review of the final head is requested when the limit resets.
- PR #51, CodeRabbit review of `a61adaf` (after the rate limit reset): 4 inline and 2 outside-diff findings.
  - The worker deadline now counts from job creation (the browser hold starts later), so a late worker start gets no extra time.
  - The overlapping-refresh E2E tests now wait until the held answers are delivered and handled.
  - The older-draft check also blocks a save whose stored body the save route would rewrite when sanitizing.
  - Docs: the SSO-protected stage step (inspect + `vercel curl` 401 + recorded decision), and a direct post-deploy check that `list_job_page` serves the list (function version + 200s, no 400 `Unsupported gateway action.`).
  - Also awaiting the owner, as part of the same residual-risk decision: a forward jump of the browser clock during a 5xx outage could end the 7 min hold early (CodeRabbit). A full guarantee needs server-side control of the save (migration).
  - Not changed, left for the owner: remove the default demo access code from `src/app/api/demo-auth/route.ts` and reject login when `DEMO_ACCESS_CODE` is unset. A valid security finding, but if production relies on the default it would lock everyone out. The owner asked to set the access-code topic aside.
- PR kotakase2022-jpg/aio#53: CodeRabbit review of `2aa463d` after the rate limit reset: no actionable comments, merge risk minimal.
- PR kotakase2022-jpg/aio#58: 4 findings fixed in `935a66c` before the merge (types without title and editor excluded, keys starting with `_` allowed, why a type may be missing, wording of unverified items). After the release CodeRabbit added that a missing `supports` still passed; fixed in PR #59 `8b93cfc` and answered on the thread.
- PR kotakase2022-jpg/aio#59, review of `8b93cfc`: 3 Minor findings, all fixed in `06e283b`, threads answered and resolved: the post error was not tied to its draft, the alert could be added off screen, the reply draft suggested deleting categories/tags that may be in use. The incremental review of `06e283b` was rate limited at first.
  - Re-review of `8b93cfc..1290d80` (requested 06:37 UTC, finished 06:43 UTC): 2 inline and 1 outside-diff Minor findings, all in docs, fixed in the next commit. No finding on the code.
    - 0 rows in `wordpress_posts` do not show that WordPress has no post: WordPress creates the post before it sets terms, so a 4xx at that stage leaves the post. The record, this file, the session handoff and the reply draft now say that the WordPress side is not verified, and the reply asks to check 投稿 drafts before posting again.
    - The release helper in the session handoff: `promote` exits non-zero on an HTTP error, and the rollback step checks `alias` afterwards.
  - Merged after CI PASS on `9398baa`. CodeRabbit did not review `9398baa` itself (rate limit: 1 review per hour); that commit only applies its suggestions.
- Codex GitHub review: not performed on #50, #51, #53, #58 or #59 (usage limit); no credits added.

## 8. Optional Bugbot Findings
- Status: Not run.

## 9. Verification Results
- 2026-11-16, this session only: baseline before changes 55 files / 598 tests, E2E 59/59. Final tree: typecheck/lint/integrity (64 files) PASS; 58 files / 622 tests PASS; contract 15 PASS; coverage S/B/F/L 87.95/79.76/92.98/88.61% on the last run (about ±0.1 pt run-to-run on identical code); Chromium PC E2E 77/77 PASS (59 existing + 18 new; the first full run of the final tree had one failure of the known favicon-abort flake, the re-run was 77/77); build PASS (19 routes).
- Intermittent pre-existing E2E failures seen in two earlier full runs (tests unchanged): `legacy fixed authentication cookie cannot bypass the login screen` (favicon `net::ERR_ABORTED` during redirect; reproduced 2/20 on untouched main `1077edc`) and `user can stop an in-progress generation job from the primary CTA` (asserts the cancel counter right after click; 20/20 in isolation on both main and branch). CI uses `retries: 1`. Worth a separate test-robustness fix.
- Follow-up after CodeRabbit (`32409be`): full gate PASS again (625 tests, contract 15, coverage 88.01/79.87/92.99/88.66%, E2E 81/81, build PASS). The final commit adds 1 more E2E (reload re-check without form input). Its gate result is recorded in the PR.
- Follow-up branch (self-verification fixes), 2026-11-16, this session: typecheck/lint/integrity (64 files) PASS; 58 files / 625 tests PASS (+3 net: 4 new gateway tests, 1 test now models the old gateway); contract 15 PASS; coverage S/B/F/L 88.04/79.91/93.11/88.69%; Chromium PC E2E 79/79 PASS (77 + 2 new); build PASS. The new tests fail on the previous code. One full run hit the known `user can stop an in-progress generation job` race (30/30 in isolation): the test asserted the cancel counter before the routed request was counted. It now waits for the count and still requires exactly one cancel at the end (not weakened).
- 11/17 (PR #53), this session: typecheck / lint / integrity (64 files) PASS; 58 files / 636 tests PASS; contract 15 PASS; coverage S/B/F/L 88.35/80.23/93.05/88.97%; build PASS; E2E first full run 82 passed / 1 failed (the known favicon-abort flake), second full run 83/83 PASS. CI PASS on both PR heads.
- 11/24 (PR #58), this session: typecheck / lint / integrity (65 files) PASS; 59 files / 646 tests PASS; contract 15 PASS; E2E 85/85 PASS (the first full run had the known favicon-abort flake); build PASS; CI PASS.
- 11/24 (PR #59 at `06e283b`), this session: typecheck / lint / integrity (65 files) PASS; 59 files / 647 tests PASS; coverage S/B/F/L 88.41/80.48/93.03/89.08%; contract 15 PASS; E2E 89/89 PASS (build run by the E2E web server); CI PASS. The 3 new E2E tests and the new integration test fail on the previous code.
- 11/24 (PR #59 at `9398baa`, docs only on top of `06e283b`), local Windows session: lint / typecheck / integrity (65 files) PASS; 59 files / 647 tests PASS; contract 15 PASS; CI (typecheck, lint, tests, E2E, build) PASS; the Vercel production build PASS. E2E and coverage were not run on the workstation.
- 11/24 evening (PR #61, 401/403 hints), local Windows session. These ran with the project config on the workstation (bundled Chromium, no local override):
  - typecheck, lint and integrity (65 files): PASS.
  - Tests: 59 files and 652 tests PASS; contract 15 PASS.
  - Coverage S/B/F/L: 88.49/80.62/93.29/89.09%.
  - E2E: 90/90 PASS. The E2E web server ran the build.
  - The 5 new integration tests, the updated 401 integration test and the new E2E test fail on the previous code.
  - Two contract tests were updated to the new detail. The alt-text 403 mock now carries the `code` and `data` that WordPress sends.
- Details and the list of new E2E flows: `docs/aizawa-nov16-followup.md` §検証 and §「11/17 厳密な自己検証」; for 11/24 `docs/aizawa-nov24-wordpress-destination.md` §検証.
- E2E ran with the container's Chromium rev 1243 through the git-ignored `.verification-files/playwright.local.config.ts` (project config targets the Chrome channel locally / bundled Chromium in CI). CI result must be checked on the PR.

## 10. Next Recommended Action
1. Send Aizawa the evening reply. It was given to the owner outside this repository and has not been sent. It withdraws the 投稿 check and asks the site side for two changes (section 3e). PR #58 and PR #59 stay released: current production `dpl_AkQuX4NMABeYSZSy24dFfoAb3BSp`, rollback `dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN`.
2. After the site side reports the changes, Aizawa (or the owner):
   - saves the connection again;
   - checks that 「投稿先」 lists コラム;
   - posts a 下書き.

   Read the production request log within an hour of that test (section 14). A 401 means the user or Application Password is wrong. If 403 continues, check other blockers such as a WAF or a security plugin.
3. PR #61 also carries the app change for the 401/403 hints (section 3e). Its merge and release need the owner's approval.
   - After the release, run the no-sign-in checks as for PR #59 (section 2).
   - Checking the credentials on 保存 is not done. It is a possible separate task.
4. Access code: done by the owner on 11/17 (production value set, session secret rotated). Remove the code fallback in `src/app/api/demo-auth/route.ts` as a separate task (open PR #55 replaces the shared code with per-user login; review it separately).
5. Cleanup, with approval: the three own test articles in section 12. Revoke Vercel tokens that are no longer needed and the Supabase token if unneeded.

## 11. Suggested Review Scope for Codex
- `listGenerationLogsPage` (three storage paths) and `decodeGenerationLogCursor` input validation.
- `presentCompletedSaveStep` read-time presentation only for completed + running.
- `saveDraftAgainstStoredRevision` conflict mapping and the UI split between definite errors (top banner) and unconfirmed outcomes (near the buttons).

## 12. Risk Notes
- Pending own records from 11/13, Supabase `npdyfhqugniuxfxpgngh` (unchanged, not touched in this session):
  - marker `AIO-RELEASE-SMOKE-08c3240b-9b01-40c6-a6ca-ad75ab7f0106`; job `454104b7-aacb-4d21-bb69-e502370c038d`; draft `62f62b95-057a-4f6a-9a5b-b523a6069e8e`.
  - marker `AIO-RELEASE-SMOKE-ab7832f3-8e5a-4418-bda5-95c825bf61c0`; job `4f8e7082-32c6-4b94-8664-f9b904a86173`; draft `675536f8-b7dd-44b8-8ba7-6f8b5c211d72`.
  - Both unpublished, image0. Delete only after confirmed approval and ID/marker checks.
  - On 11/17 the second one (job `4f8e7082-…`) was saved once without changes by the approved older-draft check (fields unchanged, revision advanced).
- Own record from 11/17 (approved synthetic generation): marker `AIO-RELEASE-SMOKE-ba2a0609-402e-432b-a7e5-90ccbd070399`; job `f9f6177c-d568-4a2d-bb2f-3868e2b2110f`; draft `dd20f96b-57c6-4896-a396-d753084abf53`. Unpublished, unposted, image 0; its body has one added verification sentence. Local artifacts in the ignored `.verification-files/AIO-RELEASE-SMOKE-ba2a0609-…/`.
  - Saved once more without changes by the post-release older-draft check (16:04 JST).
- The list order changed from update time to creation time (matches the displayed date column). Mention it to the customer.

## 13. Do Not Touch
- Secrets/env/token values; user-owned `output/`; existing production articles; WP publication; customer messaging.
- No force push, protection bypass, weakened tests, silent evidence deletion, cleanup-confirmation bypass, bulk data rewrite.

## 14. Notes for the Next Owner
- Windows uses npm.cmd/npx.cmd. In this Linux container Node 24 lives at `/opt/node24/bin`.
- `.verification-files/` is ignored and deploy-excluded. It holds the local Playwright override, run manifests (IDs and booleans only), the `aio-store` v5/v6 backups, and `*.local.mjs` copies of the production scripts that change only the browser launch (container Chromium + session proxy) or, for local runs, the target host.
- Previous release evidence: `docs/aizawa-nov11-followup.md`, `docs/adversarial-verification-2026-11-09.md`.
- Session handoff of 2026-11-24 (state, next steps, the REST release helper, the no-sign-in check, the local Playwright config): `docs/session-handoff-2026-11-24.md`. A new cloud container does not have `.verification-files/`; recreate the Playwright override from that file.
- GitHub GraphQL is not available from cloud sessions: list review threads with `GET /repos/{o}/{r}/pulls/{n}/ccr/review_threads`, resolve with `POST /repos/{o}/{r}/pulls/{n}/ccr/comments/{id}/resolve`. On the Windows workstation the `ccr/` routes return 404 and GraphQL works (`gh api graphql`, `resolveReviewThread`).
- Release from the Windows workstation (used for PR #59): the signed-in Vercel CLI 54 serves the REST calls of the handoff's helper through `vercel api` (beta), so no token is handled. Upload with `vercel deploy --prod --skip-domain` from a clean worktree with `.vercel/project.json` copied in, and without `--yes`: on an unlinked folder, `--yes` can let the CLI create a new project and connect the Git repository to it.
- Production request logs (Vercel Hobby) can be read back for only about one hour. Older ranges return `Response Error (400)`. Read them right after a customer's test:
  - Command: `vercel logs --project aio-article-generator --scope sl2026 --environment production --no-branch --since <ISO> --json`.
  - Print only the time, path and status. `--query` with a path matched nothing, so filter locally.
  - The WordPress routes return the site's own status code.
- WebFetch on the Windows workstation goes out through the owner's line in Japan (ipinfo: JP), so it is not an overseas vantage point.
- Extra git worktrees get no husky hooks (`core.hooksPath` is the relative `.husky/_`, which `npm ci` did not create there). Run the hook commands by hand before committing and pushing.
- `npm run test:integrity` misreads a test whose body (comments included) has an odd number of apostrophes and reports "does not appear to contain an assertion"; avoid `'` in comments inside tests.
