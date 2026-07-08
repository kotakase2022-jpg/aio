# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: Previous handoffs kept Loop 3 continuation for the long-running reliability / live-verification / non-commodity article-quality objective. This pass continued Loop 3 by turning the latest human editorial article-quality findings into deterministic checks and repair guidance.
- Phase: Production Merge / Deployment / Handoff
- Last updated: 2026-07-08 18:48 +09:00

## 1. Current Goal

Current objective:

- Move the AIO article generator closer to 100/100 for functional reliability, PC browser flows, daily-use UX, and non-commodity generated article quality.
- This continuation focused on the next article-quality proof gap that could be executed safely:
  - promote the repeated opening-definition / first-heading issue from prompt-only guidance into deterministic article-quality evaluation;
  - keep quality edit guidance and regeneration actions specialized for the new check id;
  - recognize concrete SaaS onboarding operational FAQ answers as practical specificity instead of generic filler.
- Overall goal is still not complete. Do not call the goal complete until WordPress sandbox/live posting is proven and representative generated outputs receive human editorial review.
- This handoff was refreshed after PR #1 was merged to `main` and deployed to Vercel production.

## 2. Current Branch / Commit / PR

- Branch: `main`
- Latest merge commit on `main`: `ca59610 Merge pull request #1 from kotakase2022-jpg/codex/persistent-quality-gate-operations`
- Latest PR head merged: `774521b Refresh handoff after deterministic quality checks`
- Latest implementation commit: `ee1a9de Add deterministic checks for repetitive heading quality`
- Latest checked local quality state: `ee1a9de`, verified by `npm.cmd run quality`; push-time checks for `774521b` also passed.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- PR status: merged to `main` on 2026-07-08 18:43 +09:00.
- CodeRabbit OSS review status: passed for `774521b`.
- GitHub Actions status for `774521b`: `Typecheck, lint, tests, E2E, build` passed in 3m41s.
- Vercel production deployment:
  - Deployment ID: `dpl_8qHKF8PDEQpKLFiYmTNNoofnL5jj`
  - Production URL: https://aio-article-generator.vercel.app
  - Deployment URL: https://aio-article-generator-mra8mi2e1-sl2026.vercel.app
  - Status: Ready

## 3. What Was Done

Completed in this Codex pass:

- Re-read `AGENTS.md`, `CLAUDE.md`, `AI_HANDOFF.md`, `README.md`, and `package.json`.
- Confirmed PR #1 was green at pushed head `2bd2b69` before new local work.
- Re-ran live OpenAI artifacts because ignored `test-results/live-openai/` artifacts were not present in the current workspace.
- Identified two residual live artifact issues:
  - one-person contractor sample had a near-boundary `target-length-alignment` issue in the main article body;
  - SaaS onboarding sample had a `numeric-claim-support` issue for a "third recurring meeting" phrase even though the previous sentence provided first-party estimate context.
- Updated `src/lib/article-quality.ts` so numeric support can also come from a short previous sentence, but only when that sentence contains real first-party / estimate / condition / caveat context. A broad previous-source check was attempted and rejected by an existing unit test, then narrowed.
- Updated `src/lib/server/article-generation.ts` so OpenAI is explicitly told that the main article body before FAQ, author, source, and auxiliary blocks must still carry enough substance.
- Added unit coverage for:
  - previous-sentence numeric support with first-party estimate context;
  - the new main-body-length prompt contract.
- Re-ran live OpenAI generation. The latest three artifacts all passed the live threshold and had no failed deterministic article-body checks.
- Re-ran the full local `npm.cmd run quality` gate successfully.
- Updated `docs/quality-audit.md` with the latest live OpenAI evidence and remaining proof gaps.
- Pushed `4b58edc` + `34be79d` and confirmed hosted PR checks:
  - CodeRabbit: pass.
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: pass in 3m34s.
- In this short continuation, rechecked PR #1 at `5abd638`; CodeRabbit and GitHub Actions were still green.
- Ran `npm.cmd run test:live:readiness:supabase`; it passed.
- Ran `npm.cmd run test:live:supabase` with the previously approved production write/delete path; it passed and cleaned up the disposable generation-job record.
- Ran `npm.cmd run test:live:readiness:wordpress`; it failed closed before live calls because sandbox WordPress credentials and explicit allow flags are not configured.
- Updated `docs/quality-audit.md` and this handoff with the latest live-provider evidence.
- Re-ran OpenAI live artifact generation with artifact writing enabled after the Supabase verification pass.
- Human-read the latest generated openings and first H2s. The deterministic quality checks were clean, but the pre-change live artifacts showed a subtle editorial quality risk: definition-style openings could be followed by a first H2 that repeated the same "Xとは..." angle.
- Updated `src/lib/server/article-generation.ts` so after a definition-style opening, the first H2/H3 must use a different editorial angle such as the reader's first decision, a failure pattern, a comparison axis, or an operational checkpoint.
- Added prompt-contract coverage in `tests/unit/article-generation.test.ts`.
- Re-ran post-change OpenAI live artifact generation. The latest first H2s moved toward decision/failure/operation angles:
  - "建設業の一人親方が最初に分けるべき確認事項"
  - "初期設定完了をゴールにすると3週目で利用が止まる"
  - "BtoBマーケティングチームが最初に決めるべき分離ルール"
- Re-ran focused verification and full `npm.cmd run quality`; both passed.
- Promoted the first-heading repetition issue into deterministic quality evaluation:
  - `src/lib/article-quality.ts` now emits `opening-heading-angle` when a definition-style opening paragraph is followed by a first H2/H3 that repeats the definition angle.
  - `quality-edit-guidance` and `quality-regeneration-action` now provide specialized instructions for that check id.
- Updated FAQ specificity so concrete SaaS operational terms such as management education, usage logs, work outputs, approval flow, approval owners, and continuation decisions count as practical answer specificity.
- Added unit coverage for the new article-quality check, the valid first-heading decision-angle case, SaaS onboarding FAQ specificity, and the quality-guidance / regeneration-action coverage guard.
- Re-ran OpenAI live generation after these deterministic evaluator updates. The latest three representative artifacts have no failed article, title, FAQ, or meta checks.
- Re-ran full `npm.cmd run quality`; it passed.
- Pushed final local commits `ee1a9de` and `774521b`; pre-push checks passed.
- Rechecked PR #1 at head `774521b`; CodeRabbit and GitHub Actions were green.
- Merged PR #1 to `main` with merge commit `ca59610`.
- Synced local `main` to `origin/main`.
- Deployed `main` to Vercel production:
  - `vercel --prod --yes` completed successfully.
  - Production alias: https://aio-article-generator.vercel.app
  - Deployment inspect with `--scope sl2026` reported status Ready.
- Ran a production HTTP smoke check; `/` returned 200 and redirected to `/demo-login?next=%2F`, which is expected because simple demo auth protects the app.

## 4. Files Changed

Main files changed:

- `src/lib/article-quality.ts`
- `src/lib/server/article-generation.ts`
- `tests/unit/article-quality.test.ts`
- `tests/unit/article-generation.test.ts`
- `src/lib/faq-quality.ts`
- `src/lib/quality-edit-guidance.ts`
- `src/lib/quality-regeneration-action.ts`
- `tests/unit/faq-quality.test.ts`
- `docs/quality-audit.md`
- `AI_HANDOFF.md`

## 5. Current Status

Current state:

- Focused tests are green.
- Local full quality gate is green.
- PR #1 is merged to `main`.
- Vercel production deployment is Ready at https://aio-article-generator.vercel.app.
- Production root smoke check returned HTTP 200 and landed on the demo login flow.
- OpenAI live generation passed after the numeric-context and main-body-length pass.
- Latest OpenAI live artifacts from the final successful deterministic-check run:
  - `2026-07-08T09-28-51-571Z-one-person-contractor-workers-compensation.json`: score 88; article body 100, title 100, FAQ 100, meta 100; failed checks: none.
  - `2026-07-08T09-30-02-161Z-saas-onboarding-operations.json`: score 88; article body 98, title 100, FAQ 100, meta 100; failed checks: none.
  - `2026-07-08T09-31-06-515Z-aio-content-operations.json`: score 88; article body 100, title 100, FAQ 100, meta 100; failed checks: none.
- The latest artifact sample no longer repeats the opening definition angle in the first H2, and FAQ specificity now recognizes concrete SaaS operational answers.
- WordPress live readiness is still not configured locally and is expected to fail closed before live calls.
- Supabase production write/delete passed again in this continuation with explicit user approval and the production-specific confirmation flag.

## 6. Known Issues

Known issues:

- `npm.cmd run test:live:readiness:wordpress` is still expected to fail until sandbox WordPress credentials and allow flags are configured:
  - `WORDPRESS_SANDBOX_SITE_URL`
  - `WORDPRESS_SANDBOX_USERNAME`
  - `WORDPRESS_SANDBOX_APPLICATION_PASSWORD`
  - `AIO_LIVE_WORDPRESS_ALLOW_POST`
  - `AIO_LIVE_WORDPRESS_ALLOW_MEDIA`
  - `AIO_LIVE_WORDPRESS_ALLOW_DELETE`
  - `AIO_LIVE_CONFIRM_NON_PRODUCTION`
- WordPress live posting was not run in this pass.
- OpenAI live samples now have no deterministic article-body / FAQ / title / meta failed checks, but model self-evaluation remains 88 because the model honestly notes missing real public/sandbox data. Do not inflate the score by hiding those caveats.
- Supabase production live write/delete has passed again in this continuation, but keep using `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1` only when explicitly authorized. Do not set `AIO_LIVE_CONFIRM_NON_PRODUCTION=1` for the production project.
- `.env.local` contains live provider credentials locally. Do not print, commit, or paste secrets anywhere.
- Do not mark the active 100/100 goal complete yet.

## 7. CodeRabbit Review

CodeRabbit OSS review status:

- Review status: success at merged PR head `774521b`.
- Critical findings: none known for this pass.
- Resolved findings: none in this pass.
- Deferred findings: none known.
- False positives / not applicable: none.

## 8. Optional Bugbot Findings

Cursor Bugbot optional review:

- Status: Not run.
- Findings: none.
- Actions taken: none.
- Reason: Cursor Bugbot is optional/backup only. CodeRabbit and GitHub Actions passed before merge. This pass performed a production deployment, but did not add new auth, credential-handling, payment, or application write/delete behavior after CodeRabbit review.

## 9. Verification Results

Commands run during this pass:

```bash
npm.cmd run test:live:openai
npx.cmd vitest run tests/unit/article-quality.test.ts tests/unit/article-generation.test.ts tests/unit/openai-live-artifacts.test.ts
npm.cmd run typecheck
AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1 AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai npm.cmd run test:live:openai
npm.cmd run quality
git commit -m "Tighten numeric and body length quality checks"
git push
gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15
npm.cmd run test:live:readiness:supabase
npm.cmd run test:live:readiness:wordpress
npm.cmd run test:live:supabase
npm.cmd run test:live:readiness:openai
AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1 AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai npm.cmd run test:live:openai
npx.cmd vitest run tests/unit/article-generation.test.ts
npm.cmd run typecheck
AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1 AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai npm.cmd run test:live:openai
npm.cmd run quality
npx.cmd vitest run tests/unit/article-quality.test.ts
npx.cmd vitest run tests/unit/article-quality.test.ts tests/unit/faq-quality.test.ts
AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1 AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai npm.cmd run test:live:openai
npm.cmd run quality
npx.cmd vitest run tests/unit/article-quality.test.ts tests/unit/faq-quality.test.ts tests/unit/quality-edit-guidance.test.ts tests/unit/quality-regeneration-action-coverage.test.ts
npm.cmd run typecheck
npm.cmd run quality
git push
gh pr view 1 --repo kotakase2022-jpg/aio --json headRefOid,statusCheckRollup,url,isDraft,state,title,mergeStateStatus,mergeable
gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15
gh pr merge 1 --repo kotakase2022-jpg/aio --merge
git fetch origin main
git checkout main
git pull --ff-only origin main
vercel --prod --yes
Invoke-WebRequest -Uri 'https://aio-article-generator.vercel.app' -UseBasicParsing -TimeoutSec 30
vercel inspect https://aio-article-generator-mra8mi2e1-sl2026.vercel.app --scope sl2026
```

Results:

- Initial `npm.cmd run test:live:openai`: passed, 1 file / 1 test, in 195.05s; regenerated missing ignored live artifacts and exposed the current weaknesses.
- Focused Vitest after implementation: passed, 3 files / 108 tests.
- `npm.cmd run typecheck`: passed.
- Final `npm.cmd run test:live:openai`: passed, 1 file / 1 test, in 219.92s.
- `npm.cmd run quality`: passed.
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 346 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.53%, branches 76.51%, functions 92.48%, lines 88.96%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- Pre-commit hook for `4b58edc`: passed.
  - lint passed
  - test integrity passed, 48 files
- Pre-push hook for `34be79d`: passed.
  - lint passed
  - typecheck passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 346 tests
  - contract tests passed, 3 files / 13 tests
- `gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15`: passed for `34be79d`.
  - CodeRabbit passed.
  - GitHub Actions `Typecheck, lint, tests, E2E, build` passed in 3m34s.
- `gh pr view 1 --repo kotakase2022-jpg/aio --json headRefOid,statusCheckRollup,url,isDraft,state,title`: PR #1 open and ready, head `5abd638`; CodeRabbit and GitHub Actions success.
- `npm.cmd run test:live:readiness:supabase`: passed.
- `npm.cmd run test:live:readiness:wordpress`: failed closed before live calls because sandbox WordPress credentials and explicit post/media/delete/non-production allow flags are not configured.
- `npm.cmd run test:live:supabase`: passed, 1 file / 1 test, in 891ms after readiness; disposable generation-job record was cleaned up.
- `npm.cmd run test:live:readiness:openai`: passed.
- Pre-change artifact-producing `npm.cmd run test:live:openai`: passed, 1 file / 1 test, in 247.75s; exposed the human editorial risk that definition openings could be followed by repetitive first H2s.
- `npx.cmd vitest run tests/unit/article-generation.test.ts`: passed, 1 file / 25 tests.
- `npm.cmd run typecheck`: passed.
- Post-change artifact-producing `npm.cmd run test:live:openai`: passed, 1 file / 1 test, in 227.55s.
- Final `npm.cmd run quality`: passed.
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 346 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.53%, branches 76.51%, functions 92.48%, lines 88.96%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- `npx.cmd vitest run tests/unit/article-quality.test.ts`: passed, 1 file / 82 tests.
- `npx.cmd vitest run tests/unit/article-quality.test.ts tests/unit/faq-quality.test.ts`: passed, 2 files / 91 tests.
- Artifact-producing `npm.cmd run test:live:openai`: passed, 1 file / 1 test, in 246.71s; exposed a SaaS FAQ specificity false negative in deterministic review.
- First `npm.cmd run quality` after adding `opening-heading-angle`: failed as designed because `quality-edit-guidance` and `quality-regeneration-action` had no specialized handling for the new check id.
- After adding specialized guidance/actions, `npx.cmd vitest run tests/unit/article-quality.test.ts tests/unit/faq-quality.test.ts tests/unit/quality-edit-guidance.test.ts tests/unit/quality-regeneration-action-coverage.test.ts`: passed, 4 files / 106 tests.
- `npm.cmd run typecheck`: passed.
- Final artifact-producing `npm.cmd run test:live:openai`: passed, 1 file / 1 test, in 212.52s.
  - `2026-07-08T09-28-51-571Z-one-person-contractor-workers-compensation.json`: score 88; article body 100, title 100, FAQ 100, meta 100; failed checks: none.
  - `2026-07-08T09-30-02-161Z-saas-onboarding-operations.json`: score 88; article body 98, title 100, FAQ 100, meta 100; failed checks: none.
  - `2026-07-08T09-31-06-515Z-aio-content-operations.json`: score 88; article body 100, title 100, FAQ 100, meta 100; failed checks: none.
- Final `npm.cmd run quality`: passed.
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 349 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.6%, branches 76.64%, functions 92.52%, lines 89.03%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- `git push`: passed; pre-push hook ran lint, typecheck, test integrity, unit/integration tests, and contract tests successfully.
- `gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15`: passed for `774521b`.
  - CodeRabbit passed.
  - GitHub Actions `Typecheck, lint, tests, E2E, build` passed in 3m41s.
- `gh pr merge 1 --repo kotakase2022-jpg/aio --merge`: passed; PR #1 merged with merge commit `ca59610`.
- `git checkout main` and `git pull --ff-only origin main`: passed; local `main` is aligned with `origin/main`.
- `vercel --prod --yes`: passed; deployment `dpl_8qHKF8PDEQpKLFiYmTNNoofnL5jj` is Ready and aliased to https://aio-article-generator.vercel.app.
- Production smoke via `Invoke-WebRequest`: passed; HTTP 200, final URI `https://aio-article-generator.vercel.app/demo-login?next=%2F`.
- `vercel inspect https://aio-article-generator.vercel.app`: failed when run without `--scope` because the local CLI defaulted to the wrong Vercel scope. This was not a deployment failure.
- `vercel inspect https://aio-article-generator-mra8mi2e1-sl2026.vercel.app --scope sl2026`: passed; deployment status Ready and production aliases listed.

Not run in this pass:

- `npm.cmd run test:live:wordpress` because sandbox WordPress credentials and allow flags are still not configured.

## 10. Next Recommended Action

Next Claude Code should:

1. Review merged PR #1 on `main`, especially whether previous-sentence numeric support, first-heading-angle evaluation, and SaaS FAQ operational specificity are narrow enough.
2. Open https://aio-article-generator.vercel.app in a PC browser and run a manual smoke through demo login and the primary article-generation screen.
3. Human-read the latest ignored OpenAI live HTML artifacts for editorial naturalness, because the deterministic checks are now clean but the model still self-scores 88.
4. Prepare a disposable WordPress sandbox and run `npm.cmd run test:live:readiness:wordpress`, then `npm.cmd run test:live:wordpress` only after the sandbox target is confirmed.

## 11. Suggested Review Scope for Claude Code

Suggested review scope:

- `src/lib/article-quality.ts`: verify previous-sentence numeric support cannot hide unsupported performance claims, and `opening-heading-angle` only flags repeated definition-style first headings after a definition opening.
- `src/lib/faq-quality.ts`: verify SaaS operational terms are specific enough without allowing short generic answers to pass.
- `src/lib/server/article-generation.ts`: verify the main-body-length and first-heading-angle prompts help without encouraging filler or mechanical headings.
- `tests/unit/article-quality.test.ts`: verify the new numeric support test reflects a real live false positive.
- `tests/unit/faq-quality.test.ts`: verify the SaaS onboarding FAQ specificity case reflects a real live false negative.
- `src/lib/quality-edit-guidance.ts` and `src/lib/quality-regeneration-action.ts`: verify the new check id has useful repair guidance.
- `tests/unit/article-generation.test.ts`: verify the prompt contracts are useful and not overfit.
- `docs/quality-audit.md`: confirm live OpenAI evidence and remaining proof gaps are accurate.
- Latest `test-results/live-openai/*.html` artifacts: editorial-read current outputs before claiming article-quality completion.

## 12. Risk Notes

Risks / human confirmation needed:

- OpenAI live artifact generation passed, but provider behavior is stochastic and can drift.
- Production deploy completed and the root HTTP smoke passed, but a full production browser E2E was not run after deploy.
- The latest deterministic body, FAQ, title, and meta checks are clean, and the first H2s in the current sample no longer repeat the opening definition angle. The model's self-evaluation still reflects missing real source data. Do not treat that as a bug unless product requirements prefer deterministic scoring over model self-review.
- WordPress live posting still needs sandbox credentials before execution.
- The live WordPress test creates and deletes disposable resources; keep post, media, delete, and non-production confirmations explicit.
- Production Supabase live verification was previously explicitly authorized and passed, but should remain guarded and should not become the routine release path.

## 13. Do Not Touch

Do not touch:

- `.env*`, OpenAI/Supabase/WordPress/Vercel credentials, and production data.
- `.claude/` unless the user explicitly asks.
- Quality gate, test integrity, and CodeRabbit operating docs should not be weakened.
- Avoid unrelated UI rewrites, screen-transition changes, broad refactors, production deploys, production DB/API writes without explicit approval, `git push --force`, or `git reset --hard`.

## 14. Notes for Claude Code

Notes:

- Use `npm.cmd` / `npx.cmd` on Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer. Cursor Bugbot is optional/backup only.
- Keep Loop 3 continuation unless you decide the next work should become a new Loop 4.
- Do not call `update_goal complete`; the 100/100 objective is not fully proven yet.
