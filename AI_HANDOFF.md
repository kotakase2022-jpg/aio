# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 5
- Loop number inferred from: The previous handoff was already Loop 5 and no intervening Claude Code handoff was recorded. This work continues the same strict production-audit loop.
- Phase: Development / Autonomous Improvement / Handoff
- Last updated: 2026-08-25 16:48 +09:00

## 1. Current Goal

Current objective:

- Verify the complete application through deterministic quality gates and real production PC-browser, OpenAI, Supabase, Storage, authentication, error-path, and persistence checks.
- Fix reproducible defects without changing the existing product flow.
- Restore migration reproducibility and keep production test data cleanup exact.
- Merge through a protected pull request, deploy `main` to Vercel, and retest production.

## 2. Current Branch / Commit / PR

- Branch: `codex/loop5-strict-production-audit`
- Latest branch commit before the final race-condition follow-up: `0c4cd9d` (`Harden generation restore consistency`)
- Last known good commit: `8b7636e06cb12ca62fceb74d8bca65f5433f975e`
- PR: https://github.com/kotakase2022-jpg/aio/pull/13
- CodeRabbit OSS review status: First-pass review received; all five actionable findings are resolved. Hosted revalidation is pending the additional review-fix commit.

## 3. What Was Done

- Audited requirements, routes, persistence, auth, uploads, security controls, migrations, tests, CI, GitHub settings, Supabase state, and Vercel production state.
- Made the GitHub repository public after secret and history scans found no committed credentials.
- Enabled GitHub vulnerability alerts, automated security fixes, secret scanning, and push protection.
- Configured `main` branch protection to require a pull request, an up-to-date branch, resolved conversations, and the `Typecheck, lint, tests, E2E, build` check; direct pushes, force pushes, deletions, and admin bypass are disallowed.
- Preserved the already-published `002_aio_gateway_token_store.sql` migration and added hardening as the new `003_harden_aio_schema.sql`. Production remote history was verified separately as timestamped `initial_schema`, `harden_aio_schema`, and `aio_gateway_token_store`; local filename versions are never reused.
- Expanded migration contracts to allow future migrations, enforce published order, verify gateway RLS/service-role/deny-policy boundaries, and reject gateway-token data mutation in every tracked SQL migration.
- Added the missing `AIO_LIVE_WORDPRESS_ALLOW_DELETE` example variable used by destructive sandbox readiness checks.
- Found a production workflow defect: reopening a generation log restored the article but not its original form inputs, leaving `記事の再作成` disabled after a reload or cross-session restore.
- Fixed log and active-job restoration so saved references, competitors, attached-file metadata, theme, first-party information, CTA, author, visual tone, image count, word count, and editable competitor research return to the form.
- Limited input restoration to log opening and the first poll after a tab reload, so normal generation polling cannot overwrite user edits.
- Added PC E2E regression coverage for restored form content and enabled article regeneration after log reopening and active-job reload recovery.
- Fixed ten additional automated-review findings: active and archived logs are both disabled during generation; output-less failed logs clear the previous draft; initial resume inputs are locked until the first response; Strict Mode cannot start duplicate resume polling; stale polling, competitor-research, theme-candidate, attachment, author-image, visual-tone-image, and generation-log responses are ignored; and restored logs clear previous theme candidates.
- Added PC E2E coverage for delayed resume locking, post-resume edit preservation, active-log disabling, stale competitor/attachment/log-response invalidation, theme-candidate clearing, draft/job competitor-research precedence, and failed-log draft clearing.
- Ran live OpenAI article generation, live Supabase disposable CRUD, exact DB count checks, and a production PC-browser flow covering authentication, the six-step wizard, live competitor/theme research, required first-party information, visual modes/counts, durable article generation, image generation, edit/save/reload/log restore, full-screen preview, image-regeneration dialog, approval, and WordPress inline validation.
- Verified one real PDF extraction in production. The complete PDF/PPTX/XLSX/DOCX fixture suite passed deterministic integration tests, and the unchanged deployment passed all six supported formats in the previous production smoke.
- Inspected the generated production image at original resolution; it was relevant, nonblank, legible, and free of malformed text.
- Deleted only the exact marked production audit job, draft, image row, and Storage object. Counts returned exactly to article inputs 8, drafts 6, images 7, WordPress connections 2, WordPress posts 0; marker rows are zero.

## 4. Files Changed

- `.env.example`
- `README.md`
- `AI_HANDOFF.md`
- `src/components/aio/article-generator-app.tsx`
- `supabase/migrations/002_aio_gateway_token_store.sql`
- `supabase/migrations/003_harden_aio_schema.sql`
- `tests/contract/supabase-migrations.contract.test.ts`
- `tests/e2e/aio-workflow.spec.ts`

## 5. Current Status

- Local `npm.cmd run quality`: PASS.
- Unit/integration: 49 files / 411 tests PASS.
- Contract: 4 files / 15 tests PASS.
- Chromium PC E2E: 51/51 PASS.
- Production build: 19 routes PASS.
- Live OpenAI contract: PASS.
- Live Supabase contract and exact cleanup: PASS.
- Production browser flow: PASS for all exercised operations; browser console warnings/errors: 0.
- Production audit cleanup: PASS, exact baseline counts restored.
- Current PR, CodeRabbit review, hosted CI, merge, deployment, and post-deploy smoke: pending.
- Existing untracked `output/` was not modified. Untracked `.claude/settings.local.json` was not created or modified by this task and must not be staged without owner review.

## 6. Known Issues

- Live WordPress post/media/delete remains `UNVERIFIED`: no disposable sandbox credentials or seven required safety variables are configured. Production WordPress was not used.
- Supabase Security Advisor still reports leaked-password protection as WARN. The application does not use Supabase password Auth; reassess if that changes.
- Supabase Performance Advisor unused-index/Auth connection notices remain informational. No production index was removed.
- PR #13 is open. The final two race-condition fixes pass focused checks and still require a full quality rerun, commit, push, hosted CI, conversation resolution, and merge.

## 7. CodeRabbit Review

- Review status: First-pass review completed; follow-up validation pending.
- Critical findings: None.
- Resolved findings: Five actionable comments were addressed: full-severity npm audit evidence, precise `.env.example` guidance, forward-compatible migration ordering, gateway-token RLS/grant/deny-policy assertions, and E2E coverage for competitor-research fallback/precedence.
- Deferred findings: None.
- False positives / not applicable: The pre-merge docstring-coverage warning is not applicable to this TypeScript/Next.js repository. Adding nonessential comments solely to satisfy that metric would reduce signal and is not part of the repository's configured quality gate.
- Additional automated review: Ten valid findings were reproduced and fixed. They covered migration-version reuse, same-job log opening, slow-resume overwrite, stale theme candidates, incomplete credential scanning, output-less log draft mismatch, stale competitor research, active-log desynchronization, stale attachment extraction, and a pending log GET racing generation start.

## 8. Optional Bugbot Findings

- Status: Run automatically on PR #13 despite its optional/backup role.
- Findings: One valid Medium finding: opening another generation log during active polling could leave the form inputs on the old log while steps/draft later switched back to the active job.
- Actions taken: Added a handler guard and disabled other log-open buttons while a different job is active. Added a PC E2E regression proving the active form stays unchanged and the archived-job endpoint is not called. Focused E2E and the full quality gate passed.

## 9. Verification Results

Commands and checks completed:

```bash
npm.cmd audit --audit-level=low
npm.cmd run quality
npm.cmd run test:live:openai
npm.cmd run test:live:supabase
npm.cmd run test:live:readiness
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --grep "generation logs show previous output|active generation job is restored|another generation log cannot replace"
git diff --check
```

Results:

- npm audit: PASS, 0 vulnerabilities.
- Typecheck/Lint/test-integrity: PASS; 53 test files have no forbidden skip/only/todo patterns.
- Unit/integration: PASS, 49 files / 411 tests.
- Contract: PASS, 4 files / 15 tests.
- Coverage: PASS; statements 86.85%, branches 76.50%, functions 91.54%, lines 87.30%.
- Chromium PC E2E: PASS, 51 scenarios.
- Next.js 16.3.2 build: PASS, 19 routes.
- Focused restoration/log-race E2E: PASS, 3/3.
- Remote Supabase migration history: PASS; timestamped initial, hardening, and gateway migrations are all recorded.
- Live OpenAI: PASS, 1/1 structured article contract across three BtoB themes.
- Live Supabase: PASS, 2/2 disposable CRUD; cleanup returned exact baseline counts.
- WordPress readiness: NOT READY because all seven sandbox-only variables are absent; no live request was sent.
- Production auth/security headers: PASS; unauthenticated API requests returned 401.
- Production browser diagnostics: console warning/error entries 0.
- Production URL fallback for `https://cierpa.co.jp/`: PASS with the intended metadata/headings fallback, not a failed extraction.

## 10. Next Recommended Action

Next Claude Code should:

1. Review PR #13, prioritizing request-generation invalidation, initial resume locking, and output-less log handling.
2. Confirm input restoration occurs only for log/reload recovery and cannot overwrite in-progress edits or accept stale competitor/theme/upload/log responses.
3. Confirm published `002_aio_gateway_token_store.sql` remains unchanged in meaning, `003_harden_aio_schema.sql` is additive/idempotent, and no migration provisions gateway credentials.
4. Review CodeRabbit comments and fix valid security, data-integrity, runtime, or test findings.
5. Re-run focused restoration E2E and `npm.cmd run quality` after any code change.

## 11. Suggested Review Scope for Claude Code

- `src/components/aio/article-generator-app.tsx`: `pollGenerationJob`, `applyGenerationJob`, `restoreFormFromGenerationJob`.
- `tests/e2e/aio-workflow.spec.ts`: generation-log and tab-reload restoration assertions.
- `supabase/migrations/002_aio_gateway_token_store.sql`: published-version preservation and credential safety.
- `supabase/migrations/003_harden_aio_schema.sql`: additive parity with applied production hardening.
- `tests/contract/supabase-migrations.contract.test.ts`: migration drift guard.

## 12. Risk Notes

- OpenAI latency and wording remain stochastic, although live text and image generation passed.
- WordPress is covered by deterministic integration/E2E mocks but lacks a disposable live sandbox contract.
- The shared demo code is simple access control, not per-user multi-tenant authorization.
- The GitHub repository is now public. Secret scanning and push protection are enabled; future contributors must keep credentials untracked.

## 13. Do Not Touch

- Do not expose or commit secret-bearing environment files or values, API keys, Supabase/WordPress credentials, access cookies, gateway tokens, or token hashes. Sanitized templates such as `.env.example` are allowed and should contain placeholders only.
- Do not delete or stage untracked `output/` manual artifacts.
- Do not stage `.claude/settings.local.json` without determining ownership and reviewing its contents.
- Do not weaken authentication, SSRF, upload validation, sanitization, image concurrency/rollback, migrations, or test-integrity checks.
- Do not run WordPress live post/media/delete without a confirmed disposable sandbox and all readiness flags.

## 14. Notes for Claude Code

- Use `npm.cmd` and `npx.cmd` in Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer; Cursor Bugbot is optional backup.
- Production: `https://aio-article-generator.vercel.app`.
- Vercel commands require `--scope sl2026`.
- The change still requires PR creation, hosted CI, CodeRabbit review, merge, Vercel production deployment, post-deploy regression, and a final handoff update with exact identifiers.
