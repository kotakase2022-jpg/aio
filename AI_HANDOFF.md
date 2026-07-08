# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: The prior handoff kept Loop 3 continuation for the long-running reliability and 100/100 improvement objective. This pass continued the same Codex phase and closed a known article-quality risk before handing off to Claude Code.
- Phase: Article Quality Hardening / Handoff
- Last updated: 2026-07-08 13:16 +09:00

## 1. Current Goal

Current objective:

- Move the AIO article generator closer to 100/100 for functional reliability, PC browser flows, daily-use UX, and non-commodity generated article quality.
- This pass addressed the previously documented risk that normal question-style H2/H3 article sections could be over-filtered from the section-specificity quality check.
- Overall goal is still not complete. Do not call the goal complete until representative article quality, WordPress live/sandbox posting, and remaining high-risk flows are proven.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest implementation commit: `403b1b7 Tighten question heading quality checks`
- Latest implementation commit before this pass: `53415fb Record Supabase production live verification success`
- Last known good local quality commit: `403b1b7`
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- CodeRabbit OSS review status: Passed previously at PR head `53415fb`; needs re-check on the new head after this handoff/code push.
- GitHub Actions status: Passed previously at PR head `53415fb`; needs re-check on the new head after this handoff/code push.

## 3. What Was Done

Completed in this Codex pass:

- Re-read `AGENTS.md`, `CLAUDE.md`, `AI_HANDOFF.md`, `README.md`, `package.json`, recent commits, working tree state, and PR check status.
- Confirmed PR #1 was green before this pass at head `53415fb`.
- Tightened article quality scoring so managed auxiliary blocks are removed before heading-section specificity checks.
- Removed the broad question-heading auxiliary heuristic. Normal question-style H2/H3 headings are now evaluated as main article sections instead of being ignored.
- Kept managed FAQ/source/author blocks excluded from weak-prose and thin-section checks by relying on `removeAuxiliaryQualityHtml`.
- Added regression coverage proving regular question-style headings are still evaluated by the `section-specificity` check.
- Ran the focused unit test and full local quality gate successfully.

Relevant prior completed work that still matters:

- Live OpenAI sandbox verification passed after quota recovery.
- Supabase production live write/delete verification passed with explicit user approval and a production-specific confirmation flag.
- `.env.local` contains live provider credentials locally and remains gitignored. Do not print or commit secrets.

## 4. Files Changed

Main files changed in this pass:

- `src/lib/article-quality.ts`
- `tests/unit/article-quality.test.ts`
- `AI_HANDOFF.md`

## 5. Current Status

- Working tree after the implementation commit was ahead of origin by one commit before this handoff update.
- Local quality gate is green for the article-quality implementation:
  - focused `article-quality` unit test passes
  - full `npm.cmd run quality` passes
- Current handoff update is documentation-only.
- PR #1 should be rechecked after pushing the new implementation/handoff commits.

## 6. Known Issues

- WordPress live posting was not run in this pass.
- Real generated article quality still needs human review on representative customer inputs, even though the live OpenAI sandbox contract passed previously.
- The live OpenAI test incurs provider cost and takes roughly 3 minutes for the current fixture set.
- Supabase production live write/delete has passed, but keep using `AIO_LIVE_CONFIRM_PRODUCTION_WRITE=1` only when explicitly authorized. Do not set `AIO_LIVE_CONFIRM_NON_PRODUCTION=1` for the production project.
- `.env.local` contains a production Supabase service role key. Do not print, commit, or paste it anywhere.
- Do not mark the active 100/100 goal complete yet.

## 7. CodeRabbit Review

CodeRabbit OSS review status:

- Review status: Passed previously on PR #1 at head `53415fb`.
- Critical findings: none known for this pass.
- Resolved findings: none in this pass.
- Deferred findings: current head needs CodeRabbit review after push.
- False positives / not applicable: none.

## 8. Optional Bugbot Findings

Cursor Bugbot optional review:

- Status: Not run.
- Findings: none.
- Actions taken: none.
- Reason: Cursor Bugbot is optional/backup only. This pass did not change auth, credentials, payment, production deployment, or write/delete behavior.

## 9. Verification Results

Commands run during this pass:

```bash
gh pr checks 1 --repo kotakase2022-jpg/aio
npx.cmd vitest run tests/unit/article-quality.test.ts
npm.cmd run quality
git commit -m "Tighten question heading quality checks"
```

Results:

- `gh pr checks 1 --repo kotakase2022-jpg/aio`: passed at pre-pass PR head `53415fb`.
  - CodeRabbit passed.
  - GitHub Actions `Typecheck, lint, tests, E2E, build` passed in 3m45s.
- Focused Vitest: passed, 1 file / 76 tests.
- `npm.cmd run quality`: passed.
  - typecheck passed
  - lint passed
  - test integrity passed, 47 files
  - unit/integration tests passed, 43 files / 336 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.39%, branches 76.39%, functions 92.35%, lines 88.83%
  - E2E passed, 49 Chromium PC tests
  - build passed, Next.js 16.2.9 production build
- Pre-commit hook for `403b1b7`: passed.
  - lint passed
  - test integrity passed

Not run in this pass:

- `npm.cmd run test:live:openai`
- `npm.cmd run test:live:supabase`
- `npm.cmd run test:live:wordpress`

## 10. Next Recommended Action

Next Claude Code should:

1. Review `src/lib/article-quality.ts` and `tests/unit/article-quality.test.ts` for the new heading-section logic.
2. Confirm managed FAQ/source/author blocks remain excluded from quality false positives while normal question-style article sections are no longer hidden.
3. Re-check PR #1 CodeRabbit and GitHub Actions on the final pushed head.
4. If checks remain green, move next toward human review of representative generated articles or WordPress live/sandbox verification if explicitly requested.

## 11. Suggested Review Scope for Claude Code

- `src/lib/article-quality.ts`: verify `removeAuxiliaryQualityHtml(html)` before `extractHeadingSections` is the right boundary for managed helper blocks.
- `tests/unit/article-quality.test.ts`: verify the new regression test checks behavior rather than implementation details.
- Existing OpenAI article-generation changes from the prior pass remain worth reviewing:
  - managed FAQ/key-takeaway/source fallback HTML
  - source URL safety filtering
  - sentence boundary handling for English and HTML block boundaries
- Supabase production live guard from the prior pass remains worth reviewing:
  - `scripts/check-live-readiness.mjs`
  - `tests/live/live-test-helpers.ts`
  - `tests/live/supabase.live.test.ts`
  - `tests/unit/live-readiness-script.test.ts`

## 12. Risk Notes

- The old `isQuestionLikeAuxiliaryHeading` risk is addressed in this pass by removing the heuristic and pre-removing managed auxiliary blocks before heading-section extraction.
- Provider/model behavior can drift. Keep deterministic local article-quality scoring as the final safety cap.
- WordPress live posting still needs sandbox or explicit production approval before execution.
- Production Supabase live verification was explicitly authorized and passed previously, but should remain guarded.

## 13. Do Not Touch

- `.env*`, OpenAI/Supabase/WordPress/Vercel credentials, and production data.
- `.claude/` unless the user explicitly asks.
- Quality gate, test integrity, and CodeRabbit operating docs should not be weakened.
- Avoid unrelated UI rewrites, screen-transition changes, broad refactors, production deploys, production DB/API writes, `git push --force`, or `git reset --hard`.

## 14. Notes for Claude Code

- Use `npm.cmd` / `npx.cmd` on Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer. Cursor Bugbot is optional/backup only.
- Keep Loop 3 continuation unless you decide the next work should become a new Loop 4.
- Do not call `update_goal complete`; the 100/100 objective is not fully proven yet.
