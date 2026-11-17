# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Claude Code
- Next owner: User / Codex. Remaining:
  - The app release of PR #53, from an account that can access Vercel scope `sl2026`.
  - The access-code task: PR #55, which needs `AIO_AUTH_USERS` set before its release (section 10).
  - The customer report, sent by the user.
- Loop: 10
- Loop number inferred from: Loop 9 (Codex, 11/13) handed off to Claude Code; this is the first Claude record after it, for Aizawa's 11/16 re-verification items ② and ③.
- Phase: PR #50 (11/16) and PR #51 (11/17) released. Strict self-verification on 11/17 (section 3c): production write checks PASS on the current production; PR #53 (log sync beyond 100 jobs) merged as `028e84b`; `aio-store` v7 deployed; the app release of PR #53 is pending (Vercel access, section 2).
- Access-code task (a second Claude Code session on 11/17, section 3d): PR #55 replaces the shared access code with email + password login. It is open with CI PASS, CodeRabbit is rate-limited, and it is not deployed. **Do not deploy it before `AIO_AUTH_USERS` exists in Vercel Production** (otherwise nobody can log in).
- Last updated: 2026-11-17 (UTC; two Claude Code cloud sessions)

## 1. Current Goal
Aizawa 11/16 re-verification: the four article structures were confirmed fine. Remaining items:
- ③ (priority) generation logs listed only the newest 20, so older unposted articles could not be reopened, edited, saved, or posted.
- ② after draft save the "処理中" indicator sometimes stayed (observed on comparison and FAQ structures).
Customer was told results/operation guidance around 2026-11-18〜19 (external estimate, not a measured plan).

Access-code task (separate; CodeRabbit finding on PR #51):
- The problem: `src/app/api/demo-auth/route.ts` accepted the default code `202607`, committed in this public repository, whenever `DEMO_ACCESS_CODE` was unset or empty.
- Owner decisions on 11/17, in the second session:
  1. Discard the demo access-code feature.
  2. Told that it was the app's only login (deleting it without a replacement would open paid generation, customer drafts and WordPress posting to anyone with the URL), the owner chose to migrate to email + password authentication.
  3. Accounts live in a Vercel environment variable, not in Supabase Auth.
  4. Add a logout button.

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
- PR kotakase2022-jpg/aio#55 (`claude/zen-mendel-fuml66`, access-code task): open.
  - Branched from `4a3d69b`. Main was merged into it twice: `028e84b` (PR #53) and `b28d093` (PR #56, this file's 11/17 record). CI PASS on `b68316a`.
  - Not deployed. That session made no production change: no deploy, no environment change, no request to the production app.
  - Rollback after its release = promote the deployment before it. That restores the access-code login, including the committed-default exposure.
- App release of `028e84b`: **not done.** The Vercel tokens saved in this session (network secret on environment `aio`, host `api.vercel.com`) authenticate as `renjihirase-8922`, which is not authorized for scope `sl2026` (the production project's scope; its teams `sl-2026` and `kotakase2022-jpgs-projects` do not contain the project). It needs a token from the account used by the Windows Vercel CLI, or the Windows run of the approved steps. Rollback target after the release: `dpl_4GpH2wKgF3rAmoYN8HSvt7h6LtVJ` (`efebb89`).

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

## 3d. Access-code retirement: email + password login (PR #55, second session, 11/17)
- Login: `POST /api/auth/session` checks an email and password against `AIO_AUTH_USERS`, a JSON array of `{ "email", "passwordHash" }`.
  - Hash: scrypt N=2^15, r=8, p=3 (an OWASP equivalent minimum, 32 MiB), 16-byte salt, constant-time compare, NFKC normalization (full-width IME input matches).
  - An unknown email costs the same hash work as a wrong password.
  - Missing, blank or invalid `AIO_AUTH_USERS` refuses every login with 500 「認証設定に不備があります。管理者に連絡してください。」 (fail closed). The server log gives the reason without account data.
  - A wrong password or an unknown email gets 401 「メールアドレスまたはパスワードが違います。」; missing fields get 400. The old code `202607` never logs in.
- Sessions:
  - `aio_session` cookie (HttpOnly, SameSite=Lax, Secure in production, 14 days as before).
  - v2 token: HMAC with the existing `DEMO_AUTH_SECRET` over version, expiry, email, nonce and the account's current password hash. Removing an account or re-issuing its password ends its sessions at once.
  - v1 tokens of the retired login are rejected even with the same secret. The old `aio_demo_auth` cookie is never read and is expired on login and logout.
- Retired: `/api/demo-auth` (the proxy now answers 401), `/demo-login` (redirects to `/login`, keeping `next`), `src/lib/demo-session.ts`, and the `DEMO_ACCESS_CODE` variable (read nowhere now).
- UI:
  - `/login`: email and password, same card style.
  - Header: the signed-in email and a ログアウト button (DELETE, then `location.replace("/login")`, so Back cannot show the signed-in page). It sits beside the primary button column, so the requirement message stays under the button it explains.
  - API 401 text is now 「認証が必要です。ログインしてください。」.
  - The return path after login is checked by URL resolution. This also rejects `/\host` and tab/newline forms that the old `startsWith("//")` check let through (an open redirect).
- Operator tooling: `npm run auth:create-user -- <email>` (`scripts/create-login-user.mjs`). It prints a generated password (about 116 bits) once, plus the entry; `--password-stdin` hashes a chosen password (15+ characters). Japanese guide with the release order: `docs/login-accounts.md`.
- Production scripts:
  - All three require `AIO_SMOKE_LOGIN_EMAIL` and `AIO_SMOKE_LOGIN_PASSWORD`, with no fallback.
  - `production-smoke.mjs` additionally checks that the retired access-code login is gone and that logout ends the session.
  - `accessCodeIsRepositoryTestValue` was removed from the older-draft check record.
- Test configuration: CI and Vitest no longer set `DEMO_ACCESS_CODE`; Vitest clears `AIO_AUTH_USERS` before each test; the E2E server gets only the test-only account from `tests/helpers/login-accounts.ts`.
- Test robustness (pre-existing races, same pattern as the loop-10 fix of `user can stop an in-progress generation job`): two E2E tests asserted, right after `click()`, on a value that the Playwright route callback sets only later in the test process. Each now waits for that value; the assertions are unchanged.
  - `uploaded visual tone image is sent to generation as upload mode` failed once in a full run (15/15 alone).
  - `generation cancel failure keeps the job active and recoverable` failed once on the tree merged with `028e84b` (15/15 alone after the fix).
- Account setup started: at the owner's request, that session generated the owner's own account entry. It went to the owner as a private file, not into this repository. The customer's account is still to be created before the release.

## 4. Files Changed
- `src/lib/server/generation-jobs.ts`, `src/lib/server/article-generation-job-runner.ts`, `src/lib/server/drafts.ts`, `src/types/aio.ts`
- `src/app/api/generation-logs/route.ts`, `src/app/api/generation-jobs/[id]/route.ts`, `src/app/api/save-draft/route.ts`, `src/app/api/approve-draft/route.ts`
- `src/components/aio/article-generator-app.tsx`
- Tests: new `tests/integration/generation-job-completion|generation-logs-pagination|draft-save-retry.integration.test.ts`; new E2E in `tests/e2e/aio-workflow.spec.ts`; `playwright.config.ts` isolates the E2E server's local store (`AIO_E2E_LOCAL_DATA_DIR`). Four existing tests that used the removed `listGenerationLogs` helper were migrated with unchanged assertions.
- `scripts/production-smoke.mjs`: adds read-only paged-log checks (paged API deployed, all pages without duplicates, load-more grows the list) and prints counts only; mutation blocking unchanged. Verified against a local production build with a git-ignored copy (host/browser lines only); not run on production.
- Docs: `docs/aizawa-nov16-followup.md`, `docs/testing.md`, this file. AGENTS.md / CLAUDE.md unchanged.
- PR #53: `src/lib/server/generation-jobs.ts`, `supabase/functions/aio-store/index.ts`, `scripts/production-older-draft-check.mjs`, `tests/integration/generation-logs-pagination.integration.test.ts`, `tests/integration/wordpress.integration.test.ts`, `tests/e2e/aio-workflow.spec.ts`.
- PR #55 (access-code task):
  - New: `src/app/api/auth/session/route.ts`, `src/app/login/page.tsx` (from the old `demo-login` page), `src/components/aio/login-form.tsx`, `src/lib/login-redirect.ts`, `src/lib/server/auth-session.ts`, `src/lib/server/auth-users.ts`, `src/lib/server/login-credentials.ts`, `scripts/create-login-user.mjs`, `docs/login-accounts.md`, `tests/helpers/login-accounts.ts`.
  - Removed: `src/app/api/demo-auth/route.ts`, `src/components/aio/demo-login-form.tsx`, `src/lib/demo-session.ts`.
  - Changed: `src/proxy.ts`, `src/app/page.tsx` (reads the session for the email, so `/` now renders per request instead of being static), `src/components/aio/article-generator-app.tsx` (header account menu, logout), the three production scripts, `playwright.config.ts`, `.github/workflows/quality-gate.yml`, `tests/setup/vitest.setup.ts`, `.env.example`, `package.json` (`auth:create-user`), `README.md`, `docs/testing.md`, `docs/quality-audit.md`, this file.
  - Tests:
    - New: `tests/unit/login-credentials|auth-users|login-redirect|create-login-user-script.test.ts`.
    - `tests/unit/demo-session.test.ts` became `tests/unit/auth-session.test.ts`; every old rejection case is kept.
    - Rewritten: `tests/integration/auth-and-logs.integration.test.ts`; updated: `tests/integration/generation-logs-pagination.integration.test.ts`, `tests/e2e/aio-workflow.spec.ts` (2 auth tests rewritten, 2 added, all logins through one helper, 2 race fixes).

## 5. Current Status
- Local quality gate: see section 9 (all steps run in this session on 2026-11-16).
- Repro-first: ② 3 failed / 0 passed before fix; ③ 17 failed / 1 passed before fix (the passing one is the auth-gate regression guard); stale-overwrite test fails when the save route is reverted to the old call.
- PR #50 and PR #51: deployed; read-only smoke verified on both releases (section 2).
- `aio-store` v7 deployed and boot-checked; `list_job_page` is confirmed in use (section 3c).
- The approved write checks PASSED on 11/17 on the current production (section 3c). The `get_job_by_draft` path is verified on production only after the app release of PR #53: then re-run `scripts/production-older-draft-check.mjs` (no warning, log `updatedAt` advances).
- Production changes made from this session: `aio-store` v6 → v7; one unchanged save of the team's own 11/13 article; one synthetic article (one paid generation) with its own edit save. No WordPress post. No customer article changed. No message to Aizawa (draft only).
- PR #55: local gate PASS on the tree merged with main (section 9), CI PASS; not merged, not deployed. Its session changed nothing in production.

## 6. Known Issues
- Gateway window: resolved by `aio-store` v6 (`list_job_page`), confirmed in use on 11/17.
- Accepted by the owner as known limitations (11/17): the late-write duplicate window and the browser clock jump (sections 3b and 7). A full guard needs a save-RPC migration; a follow-up task was suggested.
- Security, access code: `src/app/api/demo-auth/route.ts` accepts a default code committed in this public repository when `DEMO_ACCESS_CODE` is unset. The owner decided on 11/17 to retire the access code entirely (section 1), and PR #55 does that. The exposure ends with its release; until then production behaves as before. Production specifics are reported to the owner directly, not in this public repository.
- PR #55, known limits:
  - Release order: deploying it before `AIO_AUTH_USERS` is set in Production locks everyone out (fail closed, by design). Section 10.
  - No login rate limit: serverless instances share no store. Mitigation: generated ~116-bit passwords or 15+ characters, scrypt cost per attempt, the same answer and cost for unknown emails.
  - Account changes need a redeploy (environment variable). There is no self-service password change or reset; the operator re-issues.
  - `scripts/check-test-integrity.mjs` matches braces without understanding comments: an apostrophe in a comment inside a test body hides that test's assertions ("does not appear to contain an assertion"). Avoid apostrophes in such comments, or fix the guard in a separate task.
  - Other E2E tests may still read a route-callback value right after `click()` (the races fixed in section 3d). One left as is, `expect(submittedImageCount).toBe(0)`, cannot fail that way: an early read also gives 0, so it may pass without proving anything. A separate test-robustness pass is worth doing.
- Log sync on save/post beyond the 100 most recently updated jobs: fixed in PR #53 (`028e84b`), gateway side deployed (v7); production keeps the old search until the app release (37 jobs today, so no effect yet).
- Dev-only dependencies: `npm audit` reports 7 moderate advisories (typescript-eslint chain, minimatch); production dependencies 0.
- The Vercel account `renjihirase-8922` has no two-factor authentication (CLI warning). The tokens saved on environment `aio` for this attempt should be revoked when no longer needed.
- WordPress post requests have no client timeout (existing reservation prevents duplicates).
- Compare-and-set protects against delays after the server reads the revision, not before.
- Unverified in this session: Codex history, the Windows working tree, production version and data counts, the customer Google Doc.
- Earlier items still open: one shared workspace for every login (no per-user isolation; unchanged by PR #55), human source review, 11/13 pending own records cleanup (below).

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
- PR kotakase2022-jpg/aio#55 (access-code task): not reviewed yet. The automatic review and one `@coderabbitai review` request (06:36 UTC) were both rate-limited. The session watching the PR re-requests once after the reset and fixes valid findings.
- Codex GitHub review: not performed on #50, #51, #53 or #55 (usage limit); no credits added.

## 8. Optional Bugbot Findings
- Status: Not run.

## 9. Verification Results
- 2026-11-16, this session only: baseline before changes 55 files / 598 tests, E2E 59/59. Final tree: typecheck/lint/integrity (64 files) PASS; 58 files / 622 tests PASS; contract 15 PASS; coverage S/B/F/L 87.95/79.76/92.98/88.61% on the last run (about ±0.1 pt run-to-run on identical code); Chromium PC E2E 77/77 PASS (59 existing + 18 new; the first full run of the final tree had one failure of the known favicon-abort flake, the re-run was 77/77); build PASS (19 routes).
- Intermittent pre-existing E2E failures seen in two earlier full runs (tests unchanged): `legacy fixed authentication cookie cannot bypass the login screen` (favicon `net::ERR_ABORTED` during redirect; reproduced 2/20 on untouched main `1077edc`) and `user can stop an in-progress generation job from the primary CTA` (asserts the cancel counter right after click; 20/20 in isolation on both main and branch). CI uses `retries: 1`. Worth a separate test-robustness fix.
- Follow-up after CodeRabbit (`32409be`): full gate PASS again (625 tests, contract 15, coverage 88.01/79.87/92.99/88.66%, E2E 81/81, build PASS). The final commit adds 1 more E2E (reload re-check without form input). Its gate result is recorded in the PR.
- Follow-up branch (self-verification fixes), 2026-11-16, this session: typecheck/lint/integrity (64 files) PASS; 58 files / 625 tests PASS (+3 net: 4 new gateway tests, 1 test now models the old gateway); contract 15 PASS; coverage S/B/F/L 88.04/79.91/93.11/88.69%; Chromium PC E2E 79/79 PASS (77 + 2 new); build PASS. The new tests fail on the previous code. One full run hit the known `user can stop an in-progress generation job` race (30/30 in isolation): the test asserted the cancel counter before the routed request was counted. It now waits for the count and still requires exactly one cancel at the end (not weakened).
- 11/17 (PR #53), this session: typecheck / lint / integrity (64 files) PASS; 58 files / 636 tests PASS; contract 15 PASS; coverage S/B/F/L 88.35/80.23/93.05/88.97%; build PASS; E2E first full run 82 passed / 1 failed (the known favicon-abort flake), second full run 83/83 PASS. CI PASS on both PR heads.
- Details and the list of new E2E flows: `docs/aizawa-nov16-followup.md` §検証 and §「11/17 厳密な自己検証」.
- PR #55 (second session, 11/17):
  - Baseline on untouched main `4a3d69b`: typecheck, lint, integrity (64 files) PASS; 58 files / 628 tests PASS; E2E 82/82 PASS.
  - Own tree before merging main: typecheck, lint (0 warnings), integrity (68 files) PASS; 62 files / 658 tests PASS; contract 15 PASS.
    - Coverage S/B/F/L 88.67 / 80.70 / 93.47 / 89.30 %. New auth code: route 100 % statements, `auth-users.ts` 100 %, `login-credentials.ts` 100 % statements, `auth-session.ts` 96.6 %.
    - E2E 84/84 (82 + 2 new); build PASS (19 routes; `/login` and `/api/auth/session` replace the two retired routes).
  - Merged with `028e84b`: typecheck, lint, integrity PASS; 62 files / 666 tests PASS; contract 15 PASS; build PASS; E2E 85/85 PASS after the cancel race fix. CI PASS on `b68316a`.
  - After merging `b28d093` (docs only): this file's merge conflict was resolved by hand, keeping both sessions' records.
  - Not first-time green:
    - The integrity guard failed once on an apostrophe in a test comment; the comment was reworded.
    - The new logout test caught a real defect: logout navigated before reading the response, so Chrome reported the request as aborted. Fixed.
    - Two pre-existing E2E races (section 3d).
  - Manual check in a local production build: login screen, wrong-password message, header with email and ログアウト, logout back to `/login`.
- E2E ran with the container's Chromium rev 1243 through the git-ignored `.verification-files/playwright.local.config.ts` (project config targets the Chrome channel locally / bundled Chromium in CI). CI result must be checked on the PR.

## 10. Next Recommended Action
1. Release the app `028e84b` (PR #53) with the approved steps (stage with `vercel deploy --prod --skip-domain --scope sl2026`, `vercel inspect` Ready, `vercel curl <stage>/api/generation-logs -i` shows the app's own 401, promote, canonical smoke). It needs an account that can access scope `sl2026`: a token from the Windows Vercel CLI account saved on environment `aio`, or the Windows workstation.
2. After the release, re-run `scripts/production-older-draft-check.mjs` (one unchanged save of the team's own article). The save must have no warning, and the log `updatedAt` must advance. That alone does not prove the new path, because the window fallback also finds a job while there are fewer than 100. So also read the `aio-store` stats (`functions.combined-stats`) for the save minute: `client_err_count` must be 0 (no 400 `Unsupported gateway action.`). With v7 deployed and the action called first, that shows `get_job_by_draft` served the sync.
3. Access-code task (PR #55; owner decision 11/17: retire the access code). Steps in Japanese: `docs/login-accounts.md`.
   1. Create the accounts: `npm run auth:create-user -- <email>` (Windows: `npm.cmd`). The owner's own entry already exists (section 3d); the customer's does not.
   2. Vercel Production: add `AIO_AUTH_USERS` (Sensitive) with every entry in one JSON array. Keep `DEMO_AUTH_SECRET`.
   3. After CI and CodeRabbit, merge PR #55. Release it with the steps of item 1. Once main contains #53, it can ship in the same release.
   4. Read-only smoke with a team login (`AIO_SMOKE_LOGIN_EMAIL`, `AIO_SMOKE_LOGIN_PASSWORD`). Then tell the customer their login privately, and remove `DEMO_ACCESS_CODE` from Vercel.
   5. The production scripts follow the deployed login. While the access-code app is still live, run them from a checkout without PR #55 (for example `b28d093`). After the release, run them with `AIO_SMOKE_LOGIN_*`.
4. Send Aizawa the report. The draft is in the follow-up doc, filled with verified facts; keep the bracketed sentence about PR #53 only after its release. The owner sends it.
5. Cleanup, with approval: the three own test articles in section 12. Revoke Vercel tokens that are no longer needed, and the Supabase token if unneeded.
6. Optional: delete the Windows release clone `aio-release-20261116`; it holds a Vercel OIDC token in `.env.local`.

## 11. Suggested Review Scope for Codex
- `listGenerationLogsPage` (three storage paths) and `decodeGenerationLogCursor` input validation.
- `presentCompletedSaveStep` read-time presentation only for completed + running.
- `saveDraftAgainstStoredRevision` conflict mapping and the UI split between definite errors (top banner) and unconfirmed outcomes (near the buttons).
- PR #55:
  - `src/lib/server/login-credentials.ts`: hash format, parameter bounds, canonical base64url, unknown-account hash.
  - `src/lib/server/auth-session.ts`: signature bound to the current password hash; v1 rejection.
  - `src/app/api/auth/session/route.ts`: fail-closed order (configuration before input) and response codes.
  - `src/proxy.ts`: retired-path redirect, exact public paths.

## 12. Risk Notes
- Pending own records from 11/13, Supabase `npdyfhqugniuxfxpgngh` (unchanged, not touched in this session):
  - marker `AIO-RELEASE-SMOKE-08c3240b-9b01-40c6-a6ca-ad75ab7f0106`; job `454104b7-aacb-4d21-bb69-e502370c038d`; draft `62f62b95-057a-4f6a-9a5b-b523a6069e8e`.
  - marker `AIO-RELEASE-SMOKE-ab7832f3-8e5a-4418-bda5-95c825bf61c0`; job `4f8e7082-32c6-4b94-8664-f9b904a86173`; draft `675536f8-b7dd-44b8-8ba7-6f8b5c211d72`.
  - Both unpublished, image0. Delete only after confirmed approval and ID/marker checks.
  - On 11/17 the second one (job `4f8e7082-…`) was saved once without changes by the approved older-draft check (fields unchanged, revision advanced).
- Own record from 11/17 (approved synthetic generation): marker `AIO-RELEASE-SMOKE-ba2a0609-402e-432b-a7e5-90ccbd070399`; job `f9f6177c-d568-4a2d-bb2f-3868e2b2110f`; draft `dd20f96b-57c6-4896-a396-d753084abf53`. Unpublished, unposted, image 0; its body has one added verification sentence. Local artifacts in the ignored `.verification-files/AIO-RELEASE-SMOKE-ba2a0609-…/`.
- The list order changed from update time to creation time (matches the displayed date column). Mention it to the customer.

## 13. Do Not Touch
- Secrets/env/token values; user-owned `output/`; existing production articles; WP publication; customer messaging.
- Never commit or paste real `AIO_AUTH_USERS` entries, passwords or hashes. The only account in this repository is the test-only one in `tests/helpers/login-accounts.ts`.
- No force push, protection bypass, weakened tests, silent evidence deletion, cleanup-confirmation bypass, bulk data rewrite.

## 14. Notes for the Next Owner
- Windows uses npm.cmd/npx.cmd. In this Linux container Node 24 lives at `/opt/node24/bin`.
- `.verification-files/` is ignored and deploy-excluded. It holds the local Playwright override, run manifests (IDs and booleans only), the `aio-store` v5/v6 backups, and `*.local.mjs` copies of the production scripts that change only the browser launch (container Chromium + session proxy) or, for local runs, the target host.
- Scripts that import `.ts` files print `MODULE_TYPELESS_PACKAGE_JSON` under plain `node`; `npm run auth:create-user` silences only that warning.
- Previous release evidence: `docs/aizawa-nov11-followup.md`, `docs/adversarial-verification-2026-11-09.md`.
