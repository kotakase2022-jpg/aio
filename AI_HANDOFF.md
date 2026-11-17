# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Claude Code
- Next owner: Owner (account setup and release, in the order of section 10), then Codex / CodeRabbit review of the PR.
- Loop: 10 (continued). A separate task in the same Claude Code loop: retire the shared access code (CodeRabbit finding on PR #51; owner decisions on 11/17, section 1).
- Phase: PR open from `claude/zen-mendel-fuml66`, not merged, not deployed. **Do not deploy it before `AIO_AUTH_USERS` exists in Vercel Production** (otherwise nobody can log in).
- Last updated: 2026-11-17 (UTC session; Claude Code cloud container)

## 1. Current Goal
- Task as given: `src/app/api/demo-auth/route.ts` accepted the default code `202607` committed in this public repository whenever `DEMO_ACCESS_CODE` was unset or empty. Remove the fallback without locking users out.
- Owner decisions in this session (11/17):
  1. Asked whether production `DEMO_ACCESS_CODE` is set to a private value (this container has no Vercel login), the owner answered: discard the demo access-code feature and delete it.
  2. Told that the access code is the app's only login (deleting it without a replacement would let anyone with the URL run paid generation, read and edit customer drafts, and post to the customer's WordPress), the owner chose: migrate to email + password authentication.
  3. Accounts live in a Vercel environment variable (recommended option), not in Supabase Auth.
  4. Add a logout button (recommended option).
- The production `DEMO_ACCESS_CODE` status was never confirmed. After this release the variable is not read anymore, so the exposure ends with the release; until then production behaves as before.

## 2. Current Branch / Commit / PR
- This task: branch `claude/zen-mendel-fuml66` from main `4a3d69b`; PR kotakase2022-jpg/aio#53 (open). Production was not changed by this session: no deploy, no environment change, no request to the production app.
- Still current from the previous task:
  - Production runs PR kotakase2022-jpg/aio#51 (`efebb89`), deployment `dpl_4GpH2wKgF3rAmoYN8HSvt7h6LtVJ`, promoted 11/17 by the user on the Windows workstation; read-only smoke PASS. Rollback = promote `dpl_3TyMQRKm6Z63o55mPRoysRvKnSKu` (PR #50).
  - `aio-store` Edge Function v6 (`list_job_page`), Supabase project `npdyfhqugniuxfxpgngh` (dashboard name `esg-chat-data-analysis`), deployed 11/17 13:10 JST. Rollback = redeploy the v5 source (`git show ed81c15:supabase/functions/aio-store/index.ts`). Whether the app actually reads through `list_job_page` is still unconfirmed (section 10, step 7).
  - Rollback for this task after its release = promote the deployment before it. That restores the access-code login, including the committed-default exposure.

## 3. What Was Done (this task)
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
- Test robustness (pre-existing race): `uploaded visual tone image is sent to generation as upload mode` read the routed request right after `click()` without waiting. It failed once in a full run and passed 15/15 alone. It now waits for that request; the assertions are unchanged.

## 3b. Previous task in this loop (PR #50 / #51, released)
- ③ cursor-paged generation logs (`GET /api/generation-logs?cursor=&limit=`, creation time + id order; gateway `list_job_page` with fallback) and ② the save step no longer freezes on 「処理中」. Details and the customer guide: `docs/aizawa-nov16-followup.md`.
- Gated production checks `scripts/production-older-draft-check.mjs` and `scripts/production-article-smoke.mjs` have not run successfully yet. The first attempt stopped at login because the entered access code was rejected; nothing was written. They now need a production login (section 10, step 8).

## 4. Files Changed (this task)
- New: `src/app/api/auth/session/route.ts`, `src/app/login/page.tsx` (from the old `demo-login` page), `src/components/aio/login-form.tsx`, `src/lib/login-redirect.ts`, `src/lib/server/auth-session.ts`, `src/lib/server/auth-users.ts`, `src/lib/server/login-credentials.ts`, `scripts/create-login-user.mjs`, `docs/login-accounts.md`, `tests/helpers/login-accounts.ts`.
- Removed: `src/app/api/demo-auth/route.ts`, `src/components/aio/demo-login-form.tsx`, `src/lib/demo-session.ts`.
- Changed: `src/proxy.ts`, `src/app/page.tsx` (reads the session for the email, so `/` now renders per request instead of being static), `src/components/aio/article-generator-app.tsx` (header account menu, logout), `scripts/production-smoke.mjs`, `scripts/production-article-smoke.mjs`, `scripts/production-older-draft-check.mjs`, `playwright.config.ts`, `.github/workflows/quality-gate.yml`, `tests/setup/vitest.setup.ts`, `.env.example`, `package.json` (`auth:create-user`), `README.md`, `docs/testing.md`, `docs/quality-audit.md`, this file.
- Tests:
  - New: `tests/unit/login-credentials.test.ts`, `tests/unit/auth-users.test.ts`, `tests/unit/login-redirect.test.ts`, `tests/unit/create-login-user-script.test.ts`.
  - `tests/unit/demo-session.test.ts` became `tests/unit/auth-session.test.ts`; every old rejection case is kept.
  - Rewritten: `tests/integration/auth-and-logs.integration.test.ts`; updated: `tests/integration/generation-logs-pagination.integration.test.ts`, `tests/e2e/aio-workflow.spec.ts` (2 auth tests rewritten, 2 added, all logins through one helper).
- AGENTS.md and CLAUDE.md unchanged (operating rules did not change).

## 5. Current Status
- Full local gate PASS on the final tree (section 9). Not merged, not deployed.
- Production unchanged; no application data written; no paid AI call; no WordPress post; no customer message.

## 6. Known Issues
- Release order: deploying before `AIO_AUTH_USERS` is set in Production locks everyone out (fail closed, by design). Follow section 10.
- No login rate limit: serverless instances share no store. Mitigation: generated ~116-bit passwords or 15+ characters, scrypt cost per attempt, the same answer and cost for unknown emails.
- Account changes need a redeploy (environment variable). There is no self-service password change or reset; the operator re-issues.
- All accounts share one workspace (drafts, logs, WordPress connections); no per-user isolation (as before).
- `scripts/check-test-integrity.mjs` matches braces without understanding comments: an apostrophe in a comment inside a test body hides that test's assertions ("does not appear to contain an assertion"). Avoid apostrophes in such comments, or fix the guard in a separate task.
- From the previous task, still open:
  - Gateway: the app-side `list_job_page` confirmation is pending; until confirmed, more than 100 jobs may leave older logs unlisted (the UI says so).
  - Accepted by the owner (11/17): the late-write duplicate window and the browser clock jump. A full guard needs a save-RPC migration.
  - Log sync on save and post scans the 100 most recently updated jobs.
  - WordPress post requests have no client timeout (a reservation prevents duplicates).
  - Compare-and-set protects against delays after the server reads the revision, not before.
  - Human source review; 11/13 pending own records (section 12).

## 7. CodeRabbit Review
- PR kotakase2022-jpg/aio#53 (this task): review pending at handoff time. Check the PR for findings.
- PRs #50 and #51: all findings were fixed or decided by the owner (see `git log` and the PR threads).
  - The access-code finding from #51 is what this task resolves.
  - The late-write and clock-jump residual risks were accepted as known limitations (section 6).
- Codex GitHub review: not performed on #50, #51 or #53.

## 8. Optional Bugbot Findings
- Status: Not run.

## 9. Verification Results
- Baseline on untouched main `4a3d69b` (this session): typecheck, lint, integrity (64 files) PASS; 58 files / 628 tests PASS; E2E 82/82 PASS.
- Final tree (this session):
  - typecheck PASS; lint PASS (0 warnings); integrity PASS (68 files).
  - 62 files / 658 tests PASS; contract 15 PASS.
  - Coverage S/B/F/L 88.67 / 80.70 / 93.47 / 89.30 %. New auth code: route 100 % statements, `auth-users.ts` 100 %, `login-credentials.ts` 100 % statements, `auth-session.ts` 96.6 %.
  - E2E 84/84 PASS (82 existing + 2 new), run again after the last header change.
  - Build PASS (19 routes; `/login` and `/api/auth/session` replace the two retired routes).
- Not first-time green:
  - The integrity guard failed once on an apostrophe in a test comment; the comment was reworded (section 6).
  - The first full E2E run had 2 failures: (1) the new logout test caught a real defect (logout navigated before reading the response, so Chrome reported the request as aborted; fixed); (2) the pre-existing visual-tone race (section 3). The re-run passed 84/84.
- Manual check in a local production build: login screen, wrong-password message, header with email and ログアウト, logout back to `/login`.
- E2E ran with the container's Chromium rev 1243 through the git-ignored `.verification-files/playwright.local.config.ts`. CI must be checked on the PR.

## 10. Next Recommended Action
Owner, in this order (details in Japanese: `docs/login-accounts.md`):
1. Create the accounts (customer and team) on your own PC: `npm run auth:create-user -- <email>` (Windows: `npm.cmd`). Keep the printed passwords private.
2. Vercel Production: add `AIO_AUTH_USERS` (mark it Sensitive) with all entries as one JSON array. Keep `DEMO_AUTH_SECRET` as it is.
3. After CI and CodeRabbit on PR #53, merge it, then stage, check and promote as usual.
4. Read-only smoke with a team account: set `AIO_SMOKE_LOGIN_EMAIL` and `AIO_SMOKE_LOGIN_PASSWORD` (for example in the ignored `.env.local`), then run `node scripts/production-smoke.mjs`.
5. Give the customer their email and password through a private channel, and tell them the access code no longer works.
6. Remove `DEMO_ACCESS_CODE` from Vercel.
Then the open items from the previous task:
7. Confirm the app reads logs through `list_job_page`:
   1. Check that `SUPABASE_SERVICE_ROLE_KEY` is not set for Production (names only).
   2. Open `/api/generation-logs?limit=1` while logged in and decode `nextCursor`.
   3. `c` ending with `+00:00` means `list_job_page`.
8. With a team login, run `scripts/production-older-draft-check.mjs` (one unchanged save of the team's own test article), then `scripts/production-article-smoke.mjs` (one paid generation). Both need explicit approval.
9. Send Aizawa the report (draft in `docs/aizawa-nov16-followup.md`; the owner sends it). Optional: delete the Windows release clone `aio-release-20261116` (holds a Vercel OIDC token in `.env.local`).

## 11. Suggested Review Scope for Codex
- `src/lib/server/login-credentials.ts`: hash format, parameter bounds, canonical base64url, unknown-account hash.
- `src/lib/server/auth-session.ts`: signature bound to the current password hash; v1 rejection.
- `src/app/api/auth/session/route.ts`: fail-closed order (configuration before input) and response codes.
- `src/proxy.ts`: retired-path redirect, exact public paths.

## 12. Risk Notes
- Pending own records from 11/13, Supabase `npdyfhqugniuxfxpgngh` (unchanged, not touched in this session):
  - marker `AIO-RELEASE-SMOKE-08c3240b-9b01-40c6-a6ca-ad75ab7f0106`; job `454104b7-aacb-4d21-bb69-e502370c038d`; draft `62f62b95-057a-4f6a-9a5b-b523a6069e8e`.
  - marker `AIO-RELEASE-SMOKE-ab7832f3-8e5a-4418-bda5-95c825bf61c0`; job `4f8e7082-32c6-4b94-8664-f9b904a86173`; draft `675536f8-b7dd-44b8-8ba7-6f8b5c211d72`.
  - Both unpublished, image0. Delete only after confirmed approval and ID/marker checks.
- The log list order changed from update time to creation time (PR #50). Mention it to the customer.

## 13. Do Not Touch
- Secrets/env/token values; user-owned `output/`; existing production articles; WP publication; customer messaging.
- Never commit or paste real `AIO_AUTH_USERS` entries, passwords or hashes. The only account in this repository is the test-only one in `tests/helpers/login-accounts.ts`.
- No force push, protection bypass, weakened tests, silent evidence deletion, cleanup-confirmation bypass, bulk data rewrite.

## 14. Notes for the Next Owner
- Windows uses npm.cmd/npx.cmd. In this Linux container Node 24 lives at `/opt/node24/bin`.
- `.verification-files/` is ignored and deploy-excluded; the local Playwright override lives there.
- Scripts that import `.ts` files print `MODULE_TYPELESS_PACKAGE_JSON` under plain `node`; `npm run auth:create-user` silences only that warning.
- Previous release evidence: `docs/aizawa-nov16-followup.md`, `docs/aizawa-nov11-followup.md`, `docs/adversarial-verification-2026-11-09.md`.
