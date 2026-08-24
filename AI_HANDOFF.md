# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 4
- Loop number inferred from: The previous handoff remained in Loop 3 for reliability and generated-content quality. This is a new user-requested PC input-flow feature, so Codex starts Loop 4.
- Phase: Post-deploy Visual Fix / Verification / Handoff
- Last updated: 2026-08-24 19:57 +09:00

## 1. Current Goal

Current objective:

- Replace the always-expanded left input column with a one-card-at-a-time, sequential PC input wizard.
- Make "AIOのための一次情報" required.
- Let users select concrete primary-information categories and enter their own detailed evidence.
- Treat those inputs as high-priority article-generation evidence.
- Merge through a pull request and deploy the verified result to Vercel production.

## 2. Current Branch / Commit / PR

- Branch: `codex/wizard-scroll-reset`
- Latest commit: `ef585b1` (the wizard scroll-reset fix is not committed yet at this checkpoint)
- Last known good commit: `ef585b1`
- PR: https://github.com/kotakase2022-jpg/aio/pull/3 (merged); follow-up scroll-reset PR not created yet
- CodeRabbit OSS review status: Check passed but detailed review was rate-limited; no CodeRabbit finding was produced

## 3. What Was Done

- Added a six-step input wizard that renders only the active input card:
  - reference information
  - competitor information
  - theme / closing text / author
  - AIO primary information
  - image visual tone
  - character count
- Added a sticky step guide, progress bar, previous/next controls, direct step navigation for corrections, and completion feedback.
- Kept approval and WordPress controls in their existing post-generation area.
- Made primary information a required generation input.
- Added eight selectable primary-information categories and a required free-text field using the requested example text.
- Added client-side required-step feedback and disabled article generation until reference information, primary information, and visual tone are valid.
- Added server-side validation to both synchronous and durable article-generation routes so clients cannot bypass required inputs.
- Added primary-information categories to theme candidate generation and article-generation prompts, while preserving the concrete free text as the factual source.
- Preserved compatibility when loading old saved drafts by keeping the new payload property optional; new generation requires users to complete it.
- Added and updated unit, integration, fixture, and Playwright coverage for the wizard, validation, request payload, and AI prompt contracts.
- Ran the complete local quality gate successfully.
- Verified the UI at a 1440 x 1000 PC viewport with isolated browser automation. No page error, console error, framework overlay, overlap, or blank-content issue was observed.
- Reviewed one optional Cursor Bugbot finding and confirmed it was valid: URL extraction details disappeared when the user moved away from the reference or competitor wizard card.
- Moved URL extraction notices into a persistent right-column panel that shows the URL and Japanese reason from every wizard step, with buttons that return to the relevant input.
- Updated both URL failure E2E scenarios to generate from the final wizard step, verify the persistent details, and verify the correction navigation.
- Re-ran the full quality gate after the review fix; it remained green.
- Pushed the Bugbot fix and confirmed hosted GitHub Actions passed again at `c0f8359` in 4m52s.
- Merged PR #3 to `main` as `ef585b1` and deployed it to Vercel production.
- Verified the production login, one-card wizard, eight primary-information choices, required-message behavior, free-text input, and transition to the visual-tone step in a 1440 x 1000 browser.
- During that production visual smoke, found that the scroll position of a long input card was retained after changing steps, which could hide the next card's heading.
- Added an input-panel ref and reset its internal scroll position to zero whenever the active wizard step changes.
- Added a deterministic core E2E assertion that scrolls the primary-information panel to the bottom, advances, and verifies the visual-tone panel starts at scroll position zero.
- Re-ran the full local quality gate after the scroll fix; it passed.

## 4. Files Changed

Main files changed:

- `src/components/aio/article-generator-app.tsx`
- `src/lib/primary-information.ts`
- `src/lib/generation-requirements.ts`
- `src/lib/server/article-form-validation.ts`
- `src/lib/server/article-generation.ts`
- `src/types/aio.ts`
- `src/app/api/generate-article/route.ts`
- `src/app/api/generation-jobs/route.ts`
- `src/app/api/theme-candidates/route.ts`
- `tests/unit/article-form-validation.test.ts`
- `tests/unit/generation-requirements.test.ts`
- `tests/unit/article-generation.test.ts`
- `tests/integration/core-routes.integration.test.ts`
- `tests/integration/ai-routes.integration.test.ts`
- `tests/e2e/aio-workflow.spec.ts`
- `tests/fixtures/article.ts`
- `AI_HANDOFF.md`

## 5. Current Status

- The requested feature and URL-result review fix are merged in `main` and deployed.
- The production visual smoke found one scroll-position issue; its fix is complete locally on `codex/wizard-scroll-reset`.
- Full deterministic quality validation is green.
- The scroll-reset fix still needs commit, PR, hosted CI, merge, production redeploy, and a final visual smoke.
- Current production deployment before the scroll-reset follow-up: `dpl_1DoFxnfvLb5ABarWVjPQ5xyNoHFY`, Ready and aliased to `https://aio-article-generator.vercel.app`.
- Existing untracked `output/` files are generated usage-manual artifacts. They are intentionally excluded from this feature commit and must not be deleted.

## 6. Known Issues

- CodeRabbit could not provide a detailed review because the free-plan review limit was reached. Its status check passed with a rate-limit notice.
- Hosted GitHub Actions must run for the follow-up scroll-reset PR.
- The browser automation CLI accessibility command did not return usable output. Existing Playwright interaction/label checks passed, but this pass does not claim a standalone accessibility audit.
- The local visual session saw the generation-log request fail against the current live local provider configuration; this did not crash the page and is outside the wizard change. The mocked E2E error paths passed. Recheck production logs after deployment.
- OpenAI, WordPress, and Supabase live mutation tests were not run for this UI change. The full suite uses isolated provider mocks and does not change production data.
- `output/` remains untracked from the previous PDF-manual task.

## 7. CodeRabbit Review

- Review status: Status check passed with a review-limit warning; detailed review unavailable for this PR.
- Critical findings: None known.
- Resolved findings: None.
- Deferred findings: Detailed line-by-line CodeRabbit review was not available due to rate limiting.
- False positives / not applicable: None.

## 8. Optional Bugbot Findings

- Status: Run automatically by the repository integration.
- Findings: One medium finding: reference/competitor URL extraction failures were hidden after moving to another wizard step.
- Actions taken: Accepted and fixed with a persistent right-column result panel, correction buttons, and two regression E2E scenarios.
- Reason: The optional review supplied useful backup coverage while CodeRabbit was rate-limited.

## 9. Verification Results

Commands and checks completed:

```bash
npm.cmd run typecheck
npx.cmd vitest run tests/unit/generation-requirements.test.ts tests/unit/article-form-validation.test.ts tests/unit/article-generation.test.ts
npm.cmd run test
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "core|primary information"
npm.cmd run test:e2e
npm.cmd run lint
git diff --check
npm.cmd run quality
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "PC browser can complete the core"
npm.cmd run quality
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "URL fetch failure"
npm.cmd run quality
```

Results:

- `typecheck`: passed.
- Focused unit tests: passed, 3 files / 35 tests.
- Full unit/integration tests: passed; final quality run had 45 files / 356 tests.
- Focused Chromium PC E2E: passed, 2 scenarios.
- Full Chromium PC E2E: passed, 49 scenarios in the final quality run.
- `lint`: passed.
- Test-integrity check: passed, 49 test files.
- Contract tests: passed, 3 files / 13 tests.
- Coverage: passed; statements 88.77%, branches 76.99%, functions 92.70%, lines 89.26%.
- Next.js 16.2.9 production build: passed.
- `npm.cmd run quality`: passed end to end.
- PC visual smoke at 1440 x 1000: passed for the reference and primary-information steps.
- Hosted GitHub Actions for `9e36c86`: passed in 5m43s, including typecheck, lint, integrity, unit/integration, contract, coverage, 49 Chromium PC E2E scenarios, production build, and artifact upload.
- Focused URL failure E2E after the review fix: passed, 2 scenarios.
- Full quality gate after the review fix: passed again with 45 files / 356 unit/integration tests, 3 files / 13 contract tests, 49 Chromium PC E2E scenarios, the same coverage thresholds, and a successful production build.
- Hosted GitHub Actions for `c0f8359`: passed in 4m52s; PR #3 merged as `ef585b1`.
- Vercel deployment `dpl_1DoFxnfvLb5ABarWVjPQ5xyNoHFY`: Ready, production target, canonical alias applied.
- Production HTTP smoke: `307` to `/demo-login?next=%2F`, followed by `200`.
- Production PC browser smoke: login, single-card rendering, primary choices, required feedback, free text, and step transition worked; the retained scroll position issue was found visually.
- Focused core E2E after scroll reset: passed, 1 scenario with explicit `scrollTop === 0` verification after changing steps.
- Full quality gate after scroll reset: passed with 45 files / 356 unit/integration tests, 3 files / 13 contract tests, 49 Chromium PC E2E scenarios, coverage thresholds, and production build.

## 10. Next Recommended Action

Next Claude Code should:

1. Review the follow-up scroll-reset PR after Codex creates it.
2. Verify that rendering only one card at a time does not hide any prior editing path needed by existing users.
3. Review client/server parity for reference, primary-information, and visual-tone requirements.
4. Confirm backward compatibility for old saved drafts that have no `primaryInfoTypes` field.
5. Re-run `npm.cmd run quality` if any review fix is made.

## 11. Suggested Review Scope for Claude Code

- `src/components/aio/article-generator-app.tsx`: wizard navigation, required-step behavior, sticky PC layout, and existing workflow preservation.
- `src/lib/server/article-form-validation.ts`: bypass resistance and Japanese validation messages.
- `src/lib/primary-information.ts`: shared category IDs and labels.
- `src/lib/server/article-generation.ts` and `src/app/api/theme-candidates/route.ts`: evidence priority and factual-use wording.
- `tests/e2e/aio-workflow.spec.ts`: ensure setup does not mask the dedicated missing-primary-information scenario.

## 12. Risk Notes

- Only one input card is displayed, while the sticky step buttons remain directly clickable so users can revisit prior inputs without repeatedly pressing Back.
- Both a selected category and detailed free text are required. This is intentional because a category alone does not provide publishable first-party evidence.
- Provider behavior remains external and stochastic. This pass verified payload/prompt contracts without spending live OpenAI credits or writing production data.

## 13. Do Not Touch

- Do not modify or expose `.env*`, API keys, Supabase credentials, WordPress credentials, or Vercel secrets.
- Do not delete untracked `output/` manual artifacts.
- Do not weaken quality gates or the dedicated primary-information validation scenarios.
- Avoid unrelated UI redesigns and provider/data migrations.

## 14. Notes for Claude Code

- Use `npm.cmd` and `npx.cmd` in Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer; Cursor Bugbot is optional.
- The production URL is `https://aio-article-generator.vercel.app`.
- The feature should go through PR review and green hosted checks before production deployment.
