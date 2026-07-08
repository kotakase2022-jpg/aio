# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: The previous handoff kept Loop 3 continuation for the long-running reliability and 100/100 improvement objective. This pass continued the Codex implementation phase by tightening OpenAI article-generation prompts and rerunning deterministic plus live checks.
- Phase: Article Quality Improvement / Live Verification / Handoff
- Last updated: 2026-07-08 16:33 +09:00

## 1. Current Goal

Current objective:

- Move the AIO article generator closer to 100/100 for functional reliability, PC browser flows, daily-use UX, and non-commodity generated article quality.
- This pass focused on reducing commodity AI writing in live OpenAI article outputs by hardening prompts around primary information digestion, FAQ specificity, target-reader reflection, concrete article anchors, numeric/claim support, and target length control.
- Overall goal is still not complete. Do not call the goal complete until WordPress live/sandbox posting is proven and representative live artifacts receive human editorial review.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest checked base before this pass: `4c5419e Refresh handoff after deterministic artifact review`
- Current implementation commit: `5f46bb5 Tighten article generation quality prompts`
- Current implementation changes:
  - `src/lib/server/article-generation.ts`
  - `tests/unit/article-generation.test.ts`
  - `docs/quality-audit.md`
  - `AI_HANDOFF.md`
- Latest implementation commit: `5f46bb5`
- Last known good local quality state: `5f46bb5`, verified by `npm.cmd run quality`.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- CodeRabbit OSS review status: previous PR head `4c5419e` passed. Re-check CodeRabbit after `5f46bb5` and this handoff update are pushed.
- GitHub Actions status: previous PR head `4c5419e` passed. Re-check GitHub Actions after `5f46bb5` and this handoff update are pushed.

## 3. What Was Done

Completed in this Codex pass:

- Re-read `AGENTS.md`, `CLAUDE.md`, `AI_HANDOFF.md`, `README.md`, and `package.json`.
- Confirmed PR #1 was green at prior head `4c5419e` before new work:
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: success.
  - CodeRabbit: success.
- Parsed the latest OpenAI live artifacts and found that the previous AIO sample failures for `target-length-alignment` and `numeric-claim-support` had improved, while live runs still showed weaker cases around generic openings, primary information digestion, FAQ input reflection, target reader reflection, unsupported claims, and concrete detail.
- Tightened OpenAI article-generation instructions:
  - primary information must be broken into observed problem, affected reader, operational cause, decision criterion, and caveat instead of being pasted as long clauses.
  - FAQ items must visibly reuse concrete input terms from theme, primary information, references, or competitors while explaining them through decisions, conditions, caveats, field examples, or source boundaries.
  - target-reader role phrases must appear in the opening answer and at least one heading, example, or FAQ item.
  - visible body length now targets 90-110% of the requested length with a 130% hard maximum buffer below the evaluator's 135% limit.
  - body HTML should include concrete anchors such as decision criteria, caveats, failure examples, field observations, sources, conditions, cost, timing, or owners.
- Updated unit coverage so the new generation constraints are protected.
- Updated `docs/quality-audit.md` with the latest OpenAI live evidence and remaining proof gaps.
- Re-ran focused tests, full local quality gate, and OpenAI live generation with artifact writing enabled.

Relevant prior completed work that still matters:

- Optional live OpenAI artifact capture exists via:
  - `AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1`
  - `AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai`
- Supabase production live write/delete verification previously passed under explicit user approval with `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1`.
- `.env.local` contains live provider credentials locally and remains gitignored. Do not print or commit secrets.

## 4. Files Changed

Main files changed in this pass:

- `src/lib/server/article-generation.ts`
- `tests/unit/article-generation.test.ts`
- `docs/quality-audit.md`
- `AI_HANDOFF.md`

## 5. Current Status

- Local focused tests are green.
- Local full quality gate is green.
- OpenAI live generation passed after the final prompt update with artifacts written under ignored `test-results/live-openai/`.
- Latest OpenAI live article artifact scores from the final run:
  - one-person contractor workers compensation: 88
  - SaaS onboarding operations: 90
  - AIO content operations: 88
- Latest deterministic artifact review from the final run:
  - one-person contractor workers compensation: article body 88, title 100, FAQ 100, meta 100
    - remaining body issue: `unsupported-claims`
  - SaaS onboarding operations: article body 100, title 100, FAQ 100, meta 100
  - AIO content operations: article body 92, title 100, FAQ 100, meta 100
    - remaining body issue: `concrete-detail`
- The previous AIO content failures for `target-length-alignment`, `numeric-claim-support`, and `target-reader-reflection` did not recur in the latest live run.
- WordPress live readiness is still not configured locally and fails closed before live calls.

## 6. Known Issues

- `npm.cmd run test:live:readiness:wordpress` is still expected to fail until sandbox WordPress credentials and allow flags are configured:
  - `WORDPRESS_SANDBOX_SITE_URL`
  - `WORDPRESS_SANDBOX_USERNAME`
  - `WORDPRESS_SANDBOX_APPLICATION_PASSWORD`
  - `AIO_LIVE_WORDPRESS_ALLOW_POST`
  - `AIO_LIVE_WORDPRESS_ALLOW_MEDIA`
  - `AIO_LIVE_WORDPRESS_ALLOW_DELETE`
  - `AIO_LIVE_CONFIRM_NON_PRODUCTION`
- WordPress live posting was not run in this pass.
- OpenAI live samples remain above the configured minimum score, but they are not a human editorial 100/100 claim.
- The latest live run still flagged one unsupported-claims issue and one concrete-detail issue in different samples.
- Supabase production live write/delete has passed in a prior approved run, but keep using `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1` only when explicitly authorized. Do not set `AIO_LIVE_CONFIRM_NON_PRODUCTION=1` for the production project.
- `.env.local` contains a production Supabase service role key. Do not print, commit, or paste it anywhere.
- Do not mark the active 100/100 goal complete yet.

## 7. CodeRabbit Review

CodeRabbit OSS review status:

- Review status: previous PR head `4c5419e` passed before this pass. Current pass needs CodeRabbit re-check after push.
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
npx.cmd vitest run tests/unit/article-generation.test.ts
npm.cmd run typecheck
AIO_LIVE_OPENAI_WRITE_ARTIFACTS=1 AIO_LIVE_OPENAI_ARTIFACT_DIR=test-results/live-openai npm.cmd run test:live:openai
npm.cmd run quality
git commit -m "Tighten article generation quality prompts"
```

Results:

- Focused Vitest: passed, 1 file / 25 tests.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run quality`: passed.
  - typecheck passed
  - lint passed
  - test integrity passed, 48 files
  - unit/integration tests passed, 44 files / 343 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.4%, branches 76.46%, functions 92.35%, lines 88.84%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- `npm.cmd run test:live:openai`: passed after the final prompt update, 1 file / 1 test, in 191.28s.
- Pre-commit hook for `5f46bb5`: passed.
  - lint passed
  - test integrity passed, 48 files

Not run in this pass:

- `npm.cmd run test:live:supabase` because production Supabase write/delete had already passed in the prior explicitly approved run and this pass did not touch Supabase behavior.
- `npm.cmd run test:live:readiness:wordpress` because known missing sandbox credentials and allow flags remain unchanged.
- `npm.cmd run test:live:wordpress` because sandbox WordPress credentials and allow flags are still not configured.

## 10. Next Recommended Action

Next Claude Code should:

1. Review the prompt changes in `src/lib/server/article-generation.ts` for overconstraint, token bloat, and whether the instructions match the deterministic article-quality checks.
2. Open the latest ignored `test-results/live-openai/*.html` artifacts locally and inspect the two remaining article-body issues:
   - one-person contractor workers compensation: `unsupported-claims`
   - AIO content operations: `concrete-detail`
3. Decide whether the remaining live score range of 88-90 is acceptable for the next product increment or whether one more prompt/evaluator adjustment is needed.
4. Prepare a real sandbox WordPress setup and run `npm.cmd run test:live:readiness:wordpress`, then `npm.cmd run test:live:wordpress` only after the sandbox target is confirmed.
5. Continue with WordPress sandbox live verification or focused editorial review of the live artifacts.

## 11. Suggested Review Scope for Claude Code

- `src/lib/server/article-generation.ts`: check whether prompt constraints are clear, non-contradictory, and practical for OpenAI live generation.
- `tests/unit/article-generation.test.ts`: confirm the new prompt constraints are covered without overfitting to wording.
- `docs/quality-audit.md`: confirm live OpenAI evidence and remaining proof gaps are accurate.
- Latest `test-results/live-openai/*.html` artifacts: human-read the current outputs before claiming article-quality completion.

## 12. Risk Notes

- OpenAI live artifact generation passed, but provider behavior is stochastic and can drift.
- The prompt is now stricter; monitor whether future live runs become too formulaic or overfilled with labels.
- WordPress live posting still needs sandbox credentials before execution.
- The live WordPress test creates and deletes disposable resources; keep post, media, delete, and non-production confirmations explicit.
- Production Supabase live verification was previously explicitly authorized and passed, but should remain guarded and should not become the routine release path.

## 13. Do Not Touch

- `.env*`, OpenAI/Supabase/WordPress/Vercel credentials, and production data.
- `.claude/` unless the user explicitly asks.
- Quality gate, test integrity, and CodeRabbit operating docs should not be weakened.
- Avoid unrelated UI rewrites, screen-transition changes, broad refactors, production deploys, production DB/API writes without explicit approval, `git push --force`, or `git reset --hard`.

## 14. Notes for Claude Code

- Use `npm.cmd` / `npx.cmd` on Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer. Cursor Bugbot is optional/backup only.
- Keep Loop 3 continuation unless you decide the next work should become a new Loop 4.
- Do not call `update_goal complete`; the 100/100 objective is not fully proven yet.
