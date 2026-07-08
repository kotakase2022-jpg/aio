# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: Previous handoffs kept Loop 3 continuation for the long-running reliability / live-verification / non-commodity article-quality objective. This pass continued the same Codex implementation phase by addressing the remaining OpenAI live artifact weaknesses from the prior handoff.
- Phase: Article Quality Improvement / Live Verification / Handoff
- Last updated: 2026-07-08 17:36 +09:00

## 1. Current Goal

Current objective:

- Move the AIO article generator closer to 100/100 for functional reliability, PC browser flows, daily-use UX, and non-commodity generated article quality.
- This pass focused on the next concrete article-quality gaps:
  - recognize numeric claims supported by a short previous sentence with real first-party / estimate / condition context;
  - reduce short-main-body failures by telling the model that the body before FAQ / author / source blocks must still carry enough substance;
  - rerun live OpenAI artifacts and full local quality.
- Overall goal is still not complete. Do not call the goal complete until WordPress sandbox/live posting is proven and representative generated outputs receive human editorial review.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest implementation commit: `4b58edc Tighten numeric and body length quality checks`
- Latest checked local quality state: `4b58edc`, verified by `npm.cmd run quality`.
- Latest pushed PR head checked before this pass: `2bd2b69 Record hosted PR checks in handoff`
- Hosted state checked before this pass:
  - CodeRabbit: success at `2bd2b69`
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: success at `2bd2b69`
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- CodeRabbit OSS review status: needs re-check after the current local commits are pushed.

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

## 4. Files Changed

Main files changed:

- `src/lib/article-quality.ts`
- `src/lib/server/article-generation.ts`
- `tests/unit/article-quality.test.ts`
- `tests/unit/article-generation.test.ts`
- `docs/quality-audit.md`
- `AI_HANDOFF.md`

## 5. Current Status

Current state:

- Focused tests are green.
- Local full quality gate is green.
- OpenAI live generation passed after the numeric-context and main-body-length pass.
- Latest OpenAI live artifacts from the final successful run:
  - `2026-07-08T08-32-08-408Z-one-person-contractor-workers-compensation.json`: score 88; article body 98, title 100, FAQ 100, meta 100; article-body failed checks: none.
  - `2026-07-08T08-33-19-923Z-saas-onboarding-operations.json`: score 91; article body 100, title 100, FAQ 100, meta 100; article-body failed checks: none.
  - `2026-07-08T08-34-27-812Z-aio-content-operations.json`: score 91; article body 98, title 100, FAQ 100, meta 100; article-body failed checks: none.
- WordPress live readiness is still not configured locally and is expected to fail closed before live calls.
- Supabase production write/delete passed in a prior explicitly approved run; it was not rerun in this pass because this pass did not touch Supabase behavior.

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
- OpenAI live samples now have no deterministic article-body failed checks, but model self-evaluation remains 88-91 because the model honestly notes missing real public/sandbox data. Do not inflate the score by hiding those caveats.
- Supabase production live write/delete has passed in a prior approved run, but keep using `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1` only when explicitly authorized. Do not set `AIO_LIVE_CONFIRM_NON_PRODUCTION=1` for the production project.
- `.env.local` contains live provider credentials locally. Do not print, commit, or paste secrets anywhere.
- Do not mark the active 100/100 goal complete yet.

## 7. CodeRabbit Review

CodeRabbit OSS review status:

- Review status: success at previous checked pushed head `2bd2b69`; current local commits need re-check after push.
- Critical findings: none known for this pass.
- Resolved findings: none in this pass.
- Deferred findings: none known.
- False positives / not applicable: none.

## 8. Optional Bugbot Findings

Cursor Bugbot optional review:

- Status: Not run.
- Findings: none.
- Actions taken: none.
- Reason: Cursor Bugbot is optional/backup only. This pass did not change auth, credential handling, payment, production deployment, or application production write/delete behavior.

## 9. Verification Results

Commands run during this pass:

```bash
npm.cmd run test:live:openai
npx.cmd vitest run tests/unit/article-quality.test.ts tests/unit/article-generation.test.ts tests/unit/openai-live-artifacts.test.ts
npm.cmd run typecheck
AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1 AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai npm.cmd run test:live:openai
npm.cmd run quality
git commit -m "Tighten numeric and body length quality checks"
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

Not run in this pass:

- `npm.cmd run test:live:supabase` because production Supabase write/delete had already passed in the prior explicitly approved run and this pass did not touch Supabase behavior.
- `npm.cmd run test:live:readiness:wordpress` because known missing sandbox credentials and allow flags remain unchanged.
- `npm.cmd run test:live:wordpress` because sandbox WordPress credentials and allow flags are still not configured.

## 10. Next Recommended Action

Next Claude Code should:

1. Review implementation commit `4b58edc`, especially whether previous-sentence numeric support is narrow enough and whether the main-body-length prompt is not overconstraining.
2. After Codex pushes this handoff state, re-check PR #1 CodeRabbit and GitHub Actions on the latest pushed head.
3. Human-read the latest ignored OpenAI live HTML artifacts for editorial naturalness, because the deterministic checks are now clean but the model still self-scores 88-91.
4. Prepare a disposable WordPress sandbox and run `npm.cmd run test:live:readiness:wordpress`, then `npm.cmd run test:live:wordpress` only after the sandbox target is confirmed.

## 11. Suggested Review Scope for Claude Code

Suggested review scope:

- `src/lib/article-quality.ts`: verify previous-sentence numeric support cannot hide unsupported performance claims.
- `src/lib/server/article-generation.ts`: verify the main-body-length prompt helps without encouraging filler.
- `tests/unit/article-quality.test.ts`: verify the new numeric support test reflects a real live false positive.
- `tests/unit/article-generation.test.ts`: verify the prompt contract is useful and not overfit.
- `docs/quality-audit.md`: confirm live OpenAI evidence and remaining proof gaps are accurate.
- Latest `test-results/live-openai/*.html` artifacts: editorial-read current outputs before claiming article-quality completion.

## 12. Risk Notes

Risks / human confirmation needed:

- OpenAI live artifact generation passed, but provider behavior is stochastic and can drift.
- The latest deterministic body checks are clean, but the model's self-evaluation still reflects missing real source data. Do not treat that as a bug unless product requirements prefer deterministic scoring over model self-review.
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
