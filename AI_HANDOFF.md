# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Claude Code
- Next owner: User / Codex (remaining: production write checks after the access-code task; customer report send by the user)
- Loop: 10
- Loop number inferred from: Loop 9 (Codex, 11/13) handed off to Claude Code; this is the first Claude record after it, for Aizawa's 11/16 re-verification items ② and ③.
- Phase: PR #50 (11/16) and PR #51 (11/17) released to production; `aio-store` v6 deployed (section 2). Production write checks still pending.
- Last updated: 2026-11-17 (UTC session; Claude Code cloud container)

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
  - Not yet confirmed: that the app actually reads the list through `list_job_page`, rather than the fallback. See section 10, step 1. A `+00:00` cursor proves it only when production uses the gateway path alone.
  - Rollback = redeploy the v5 source (`git show ed81c15:supabase/functions/aio-store/index.ts`; a downloaded copy is in the ignored `.verification-files/aio-store-backup-v5/`).

## 3. What Was Done
- ③ cursor pagination for generation logs: `GET /api/generation-logs?cursor=&limit=` returns `{ logs, nextCursor, complete }`; first-page URL unchanged. Stable order = creation time desc + id (saving/posting no longer moves a log between pages). Supabase direct: SQL keyset; gateway (production): pages inside the existing `list_jobs` window (100 jobs / 400 newest-updated rows) and reports `complete:false` when that window is full; local: in-memory keyset. UI: 「さらに古いログを表示（20件ずつ）」, count badge, end/incomplete notices, load-more error keeps the list, automatic refresh keeps the loaded range (≤100).
- ② root cause fixed: job completion wrote `status:completed` and the save step `done` in two writes; a poll between them froze 「ドラフト保存: 処理中」. Now one write. Stored legacy records with completed + save `running` are presented as saved only when the canonical draft is readable (no DB rewrite), otherwise as unconfirmed.
- ② robustness: save/approve 60 s timeout; timeout / dropped connection / bare 502-504 are reported as **unconfirmed** (not success/failure), edits kept, retry hits the same draft ID; in-flight ref blocks double submit; save/approve routes compare-and-set against the revision read just before writing (late stale request → 409, lost-response retry → 200); polling retries transient loss up to 4 times, then shows an unconfirmed state and keeps the resume key; unknown generation start tells the editor to check logs before retrying; an unconfirmed WordPress post asks to check WordPress before posting again (no timeout added to posting).
- Details, evidence and the customer-facing guide: `docs/aizawa-nov16-followup.md`.

## 3b. Self-verification after release (follow-up branch)
- Found: (1) with more than 100 jobs the gateway `list_jobs` window hides the oldest logs again (③ recurs as data grows); (2) every log page read up to 400 full rows; (3) `complete` could be true while jobs outside the 400-row window were hidden; (4) a refresh during 「さらに古いログを表示」 dropped the page being loaded; (5) after an unconfirmed generation status, the primary button could start a second paid generation.
- Fixed: `aio-store` gains `list_job_page` (created_at/id keyset, jobs only, limit+1 rows); the app uses it first and falls back to the window paging on the old gateway's 400 `Unsupported gateway action.` (cached 5 min), so the app release is safe before the gateway deploy. A refresh during a pending older page includes that page. The primary/regenerate button re-checks a stored unconfirmed job instead of starting a new one.
- Gated production check scripts (not yet run successfully on production; the first attempt stopped at login because the entered access code was rejected, nothing was written): `scripts/production-older-draft-check.mjs`, extended `scripts/production-article-smoke.mjs`. Paused on the user's instruction.

## 4. Files Changed
- `src/lib/server/generation-jobs.ts`, `src/lib/server/article-generation-job-runner.ts`, `src/lib/server/drafts.ts`, `src/types/aio.ts`
- `src/app/api/generation-logs/route.ts`, `src/app/api/generation-jobs/[id]/route.ts`, `src/app/api/save-draft/route.ts`, `src/app/api/approve-draft/route.ts`
- `src/components/aio/article-generator-app.tsx`
- Tests: new `tests/integration/generation-job-completion|generation-logs-pagination|draft-save-retry.integration.test.ts`; new E2E in `tests/e2e/aio-workflow.spec.ts`; `playwright.config.ts` isolates the E2E server's local store (`AIO_E2E_LOCAL_DATA_DIR`). Four existing tests that used the removed `listGenerationLogs` helper were migrated with unchanged assertions.
- `scripts/production-smoke.mjs`: adds read-only paged-log checks (paged API deployed, all pages without duplicates, load-more grows the list) and prints counts only; mutation blocking unchanged. Verified against a local production build with a git-ignored copy (host/browser lines only); not run on production.
- Docs: `docs/aizawa-nov16-followup.md`, `docs/testing.md`, this file. AGENTS.md / CLAUDE.md unchanged.

## 5. Current Status
- Local quality gate: see section 9 (all steps run in this session on 2026-11-16).
- Repro-first: ② 3 failed / 0 passed before fix; ③ 17 failed / 1 passed before fix (the passing one is the auth-gate regression guard); stale-overwrite test fails when the save route is reverted to the old call.
- PR #50 and PR #51: deployed; read-only smoke verified on both releases (section 2).
- `aio-store` v6 deployed and boot-checked; the app-side `list_job_page` confirmation is pending (section 2).
- The approved write checks have NOT been completed: an existing unposted draft save and one synthetic generation. The first attempt stopped at login because the entered access code was rejected; nothing was written. The checks are paused until the access-code task.
- No application data written by this session. The Edge Function deploy is the only production change made from here. No WordPress post. No paid AI call. No message to Aizawa (draft only).

## 6. Known Issues
- Gateway window: resolved by `aio-store` v6 (`list_job_page`), pending the app-side confirmation in section 2. Until then the app falls back to the old window, where more than 100 jobs may leave older logs unlisted (the UI says so).
- Accepted by the owner as known limitations (11/17): the late-write duplicate window and the browser clock jump (sections 3b and 7). A full guard needs a save-RPC migration; a follow-up task was suggested.
- Security, separate task (owner, 11/17): `src/app/api/demo-auth/route.ts` accepts a default code committed in this public repository when `DEMO_ACCESS_CODE` is unset. First confirm or set the production variable, then remove the fallback. A follow-up task was suggested.
- Log sync on save/post (`syncGenerationJobDraft`, `markGenerationJobWordpressPost`) still scans the 100 most recently updated jobs (pre-existing). Beyond that, the log title/WordPress state may not refresh; the draft itself is saved.
- WordPress post requests have no client timeout (existing reservation prevents duplicates).
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
- Codex GitHub review: not performed on #50 or #51 (usage limit); no credits added.

## 8. Optional Bugbot Findings
- Status: Not run.

## 9. Verification Results
- 2026-11-16, this session only: baseline before changes 55 files / 598 tests, E2E 59/59. Final tree: typecheck/lint/integrity (64 files) PASS; 58 files / 622 tests PASS; contract 15 PASS; coverage S/B/F/L 87.95/79.76/92.98/88.61% on the last run (about ±0.1 pt run-to-run on identical code); Chromium PC E2E 77/77 PASS (59 existing + 18 new; the first full run of the final tree had one failure of the known favicon-abort flake, the re-run was 77/77); build PASS (19 routes).
- Intermittent pre-existing E2E failures seen in two earlier full runs (tests unchanged): `legacy fixed authentication cookie cannot bypass the login screen` (favicon `net::ERR_ABORTED` during redirect; reproduced 2/20 on untouched main `1077edc`) and `user can stop an in-progress generation job from the primary CTA` (asserts the cancel counter right after click; 20/20 in isolation on both main and branch). CI uses `retries: 1`. Worth a separate test-robustness fix.
- Follow-up after CodeRabbit (`32409be`): full gate PASS again (625 tests, contract 15, coverage 88.01/79.87/92.99/88.66%, E2E 81/81, build PASS). The final commit adds 1 more E2E (reload re-check without form input). Its gate result is recorded in the PR.
- Follow-up branch (self-verification fixes), 2026-11-16, this session: typecheck/lint/integrity (64 files) PASS; 58 files / 625 tests PASS (+3 net: 4 new gateway tests, 1 test now models the old gateway); contract 15 PASS; coverage S/B/F/L 88.04/79.91/93.11/88.69%; Chromium PC E2E 79/79 PASS (77 + 2 new); build PASS. The new tests fail on the previous code. One full run hit the known `user can stop an in-progress generation job` race (30/30 in isolation): the test asserted the cancel counter before the routed request was counted. It now waits for the count and still requires exactly one cancel at the end (not weakened).
- Details and the list of new E2E flows: `docs/aizawa-nov16-followup.md` §検証.
- E2E ran with the container's Chromium rev 1243 through the git-ignored `.verification-files/playwright.local.config.ts` (project config targets the Chrome channel locally / bundled Chromium in CI). CI result must be checked on the PR.

## 10. Next Recommended Action
1. Confirm the app reads the list through `list_job_page`:
   1. Confirm production uses only the gateway path: `SUPABASE_SERVICE_ROLE_KEY` is not set for Production (names only: `npx vercel env ls production --scope sl2026`). The direct Supabase path also issues `+00:00` cursors.
   2. In a logged-in browser, open `/api/generation-logs?limit=1` and decode `nextCursor` (base64url JSON).
   3. With the gateway path only, `c` ending with `+00:00` means `list_job_page`. Ending with `Z` means the old window fallback.
2. Access-code task (separate, owner first): confirm or set the production `DEMO_ACCESS_CODE`, then remove the default fallback in `src/app/api/demo-auth/route.ts`.
3. With the correct access code: run `scripts/production-older-draft-check.mjs` (one unchanged save of the team's own test article), then `scripts/production-article-smoke.mjs` (one paid generation).
4. Send Aizawa the report after replacing the remaining placeholders with verified facts. The draft is in the follow-up doc; the owner sends it.
5. Optional: delete the Windows release clone `aio-release-20261116`; it holds a Vercel OIDC token in `.env.local`.

## 11. Suggested Review Scope for Codex
- `listGenerationLogsPage` (three storage paths) and `decodeGenerationLogCursor` input validation.
- `presentCompletedSaveStep` read-time presentation only for completed + running.
- `saveDraftAgainstStoredRevision` conflict mapping and the UI split between definite errors (top banner) and unconfirmed outcomes (near the buttons).

## 12. Risk Notes
- Pending own records from 11/13, Supabase `npdyfhqugniuxfxpgngh` (unchanged, not touched in this session):
  - marker `AIO-RELEASE-SMOKE-08c3240b-9b01-40c6-a6ca-ad75ab7f0106`; job `454104b7-aacb-4d21-bb69-e502370c038d`; draft `62f62b95-057a-4f6a-9a5b-b523a6069e8e`.
  - marker `AIO-RELEASE-SMOKE-ab7832f3-8e5a-4418-bda5-95c825bf61c0`; job `4f8e7082-32c6-4b94-8664-f9b904a86173`; draft `675536f8-b7dd-44b8-8ba7-6f8b5c211d72`.
  - Both unpublished, image0. Delete only after confirmed approval and ID/marker checks.
- The list order changed from update time to creation time (matches the displayed date column). Mention it to the customer.

## 13. Do Not Touch
- Secrets/env/token values; user-owned `output/`; existing production articles; WP publication; customer messaging.
- No force push, protection bypass, weakened tests, silent evidence deletion, cleanup-confirmation bypass, bulk data rewrite.

## 14. Notes for the Next Owner
- Windows uses npm.cmd/npx.cmd. In this Linux container Node 24 lives at `/opt/node24/bin`.
- `.verification-files/` is ignored and deploy-excluded; this session only added the local Playwright override there.
- Previous release evidence: `docs/aizawa-nov11-followup.md`, `docs/adversarial-verification-2026-11-09.md`.
