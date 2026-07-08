# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: The previous handoff used `Loop: 3 continuation`; the active 100/100 objective still lacks live sandbox proof and human article-quality review, so this remains a narrow continuation rather than a new loop.
- Phase: Autonomous Improvement / Image Recovery Prompt Scope / Handoff
- Last updated: 2026-07-08 09:24 +09:00

## 1. Current Goal

Improve the AIO article generator toward the active 100/100 goal:

- all major functions and PC-browser flows work without bugs or confusing recovery states
- the app feels strong enough for daily article-production work
- generated articles feel specific, source-aware, accessible, and editorial rather than commodity AI content

This Codex pass tightened generated-image recovery behavior. When a draft has a saved `imageCount`, the UI now treats only the expected generated image slots as recoverable missing images:

- `featured` for 1 image
- `featured`, `inline-1` for 2 images
- `featured`, `inline-1`, `inline-2` for 3 images
- no expected generated image prompts for 0 images

This prevents an unnecessary recovery banner when the AI or older data contains extra `image_prompts` beyond the user-requested image count.

The overall goal is not complete. Live sandbox contract tests for OpenAI/Supabase/WordPress, live WordPress recovery verification, and human review of real generated article quality are still open.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest implementation/test commit: `96ef26b Respect requested image count in recovery prompts`
- Previous pushed status head checked on PR: `0b57f5a Record English boilerplate PR checks`
- Last known good local verification: `npm.cmd run quality` passed after `96ef26b`.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- PR status before this pass at pushed head `0b57f5a`:
  - CodeRabbit: pass
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: pass in 3m30s
- PR status after this pass at pushed head `df451fe`:
  - CodeRabbit: pass
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: pass in 3m30s
- If this file is included in a later status-only handoff commit, re-check the latest PR head; status-only handoff commits do not change runtime code.
- CodeRabbit OSS review status: CodeRabbit is installed and responding on PR #1. Current local code addresses the older duplicate review history about partial image recovery and parallel image regeneration. This pass further addresses the review note about considering `imageCount` when showing missing-image recovery.

## 3. What Was Done

- Read the required workflow files, current handoff, README, package scripts, branch state, recent commits, PR status, CodeRabbit status, and relevant image recovery code/tests before editing.
- Confirmed the branch was clean and PR #1 was green before this pass at head `0b57f5a`.
- Confirmed the older generation-requirement duplication comment is already addressed by `missingGenerationRequirements`.
- Confirmed the older image-regeneration parallelism comment is already addressed by `Promise.allSettled`.
- Updated `getMissingGeneratedImagePrompts` in `src/components/aio/article-generator-app.tsx` so saved `imageCount` scopes which image slots are considered expected and recoverable.
- Kept legacy compatibility: when `imageCount` is missing on an old draft, the UI preserves the previous behavior and considers all saved image prompts.
- Passed `draft.inputPayload.imageCount` into both bulk image regeneration and preview recovery-banner computation.
- Added an E2E regression test proving that a one-image draft with an extra `inline-1` prompt does not show the missing-image recovery banner.
- During the first run, the new test exposed that the mocked E2E route reflects current form state into the returned draft. The test was corrected to select `1枚` through the UI before generation, matching real user behavior.
- Ran focused E2E, typecheck, diff whitespace check, and the full local quality gate successfully.
- Cursor Bugbot was not run; CodeRabbit OSS remains the standard review path, and this pass did not touch auth, DB, credentials, production writes, or other high-risk areas that would justify optional Bugbot use.

## 4. Files Changed

- `src/components/aio/article-generator-app.tsx`
- `tests/e2e/aio-workflow.spec.ts`
- `docs/quality-audit.md`
- `AI_HANDOFF.md`

## 5. Current Status

- Implementation/test commit `96ef26b` exists locally and passed focused checks plus the full local quality gate.
- Handoff/docs updates are prepared in this file and `docs/quality-audit.md`.
- Hosted CodeRabbit and GitHub Actions are green on pushed head `df451fe`.
- If a later status-only handoff commit is pushed, Claude Code should re-check the latest PR head.

## 6. Known Issues

- Remaining low-priority deferred / cleanup items:
  - markdownlint/document formatting items remain
  - broader malformed generated HTML coverage can still be expanded if future review finds real examples outside managed FAQ/source/author blocks
- `test:live:*` was not run because sandbox credentials are required.
- Human review of real generated article quality is still needed.
- The active 100/100 goal is not complete.

## 7. CodeRabbit Review

- Review status before this pass: PR #1 open; CodeRabbit SUCCESS and GitHub Actions SUCCESS at head `0b57f5a`.
- Review status after this pass: CodeRabbit SUCCESS and GitHub Actions SUCCESS at pushed head `df451fe`.
- Current pass:
  - Addresses the still-relevant part of the older image recovery feedback about respecting requested `imageCount`.
  - Keeps the fix narrow to preview/recovery behavior and one E2E regression.
- Critical findings:
  - No known open Critical findings at the time of this handoff.
- Resolved / strengthened findings:
  - Missing generated image recovery no longer treats extra prompts beyond requested image count as user-visible failures.
- Deferred findings:
  - See `Known Issues`.
- False positives / not applicable:
  - Older duplicate comments about all-or-nothing recovery display and sequential image regeneration are already addressed in current code with `missingGeneratedImagePrompts.length > 0`, `Promise.allSettled`, and E2E coverage.

## 8. Optional Bugbot Findings

- Status: Not run
- Findings: None
- Actions taken: None
- Reason: Cursor Bugbot is optional/backup only. This pass is a narrow UI recovery/test update, with CodeRabbit OSS as the standard review path.

## 9. Verification Results

Commands run in this pass:

```bash
gh pr checks 1 --repo kotakase2022-jpg/aio
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc -g "missing generated image recovery ignores prompts beyond requested image count"
npm.cmd run typecheck
git diff --check
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc -g "missing generated image recovery"
npm.cmd run quality
git commit -m "Respect requested image count in recovery prompts"
git commit -m "Update handoff after image recovery prompt scope"
git push
gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15
```

Results:

- `gh pr checks 1 --repo kotakase2022-jpg/aio`: passed before this pass at pushed head `0b57f5a`.
  - CodeRabbit: pass.
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: pass in 3m30s.
- First targeted Playwright run for the new regression failed because the test did not select `1枚` in the UI, so the mocked route returned a draft with the current form default of 2 images. This was a test setup issue, not an implementation bypass.
- `npm.cmd run typecheck`: passed.
- `git diff --check`: passed.
- `npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc -g "missing generated image recovery"`: passed, 2 tests.
- Final `npm.cmd run quality`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 47 files.
  - `npm run test`: passed, 43 files / 328 tests.
  - `npm run test:contract`: passed, 3 files / 13 tests.
  - `npm run test:coverage`: passed, statements 88.2%, branches 76.19%, functions 92.13%, lines 88.64%.
  - `npm run test:e2e`: passed, 49 PC Chromium tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- Commit pre-commit hook for `96ef26b`: passed, `npm run lint` and `npm run test:integrity`.
- Handoff/docs commit `df451fe`: passed pre-commit, `npm run lint` and `npm run test:integrity`.
- `git push`: passed pre-push.
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm run test:integrity`: passed, 47 files.
  - `npm run test`: passed, 43 files / 328 tests.
  - `npm run test:contract`: passed, 3 files / 13 tests.
- `gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15`: passed at head `df451fe`.
  - CodeRabbit: pass.
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: pass in 3m30s.

Not run:

- `npm.cmd run test:live:*` because sandbox credentials and explicit non-production confirmation are required.
- Hosted PR checks after any later status-only handoff commit.

## 10. Next Recommended Action

Next Claude Code should:

1. Review the image recovery prompt-scope change:
   - `src/components/aio/article-generator-app.tsx`
   - `tests/e2e/aio-workflow.spec.ts`
2. Confirm CodeRabbit does not raise a new concern around image recovery or prompt scoping.
3. If checks stay green, decide whether the next pass should focus on live/sandbox readiness or another small generated-output quality regression test.
4. Run `npm.cmd run quality` after any code changes and record the result here.

## 11. Suggested Review Scope for Claude Code

- Whether `generatedImageSlotOrder` matches the server-side image creation order.
- Whether old drafts without `inputPayload.imageCount` should preserve the previous all-prompt recovery behavior.
- Whether the new E2E assertion is strong enough to prevent extra prompt banners without hiding legitimate partial failures.

## 12. Risk Notes

- This pass only changes recovery-banner/regeneration scope for missing generated image prompts.
- It does not alter persistence, auth, WordPress posting, OpenAI calls, Supabase behavior, or production data.
- Real OpenAI output quality still requires human review.

## 13. Do Not Touch

- `.env*`, OpenAI/Supabase/WordPress/Vercel credentials, production data.
- `.claude/` unless the user explicitly asks.
- Quality gate, test integrity, and CodeRabbit operating docs should not be weakened.
- Avoid unrelated UI rewrites, screen-transition changes, broad refactors, production deploys, production DB/API writes, `git push --force`, or `git reset --hard`.

## 14. Notes for Claude Code

- Use `npm.cmd` / `npx.cmd` on Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer. Cursor Bugbot is optional/backup only.
- Keep Loop 3 continuation unless you decide the remaining deferred items are sufficiently closed and the next cycle should become Loop 4.
- Do not call `update_goal complete`; the 100/100 objective is not proven yet.
