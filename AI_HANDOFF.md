# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 4
- Loop number inferred from: The previous handoff remained in Loop 3 for reliability and generated-content quality. This is a new user-requested PC input-flow feature, so Codex starts Loop 4.
- Phase: Development / Verification / Handoff
- Last updated: 2026-08-24 19:32 +09:00

## 1. Current Goal

Current objective:

- Replace the always-expanded left input column with a one-card-at-a-time, sequential PC input wizard.
- Make "AIOのための一次情報" required.
- Let users select concrete primary-information categories and enter their own detailed evidence.
- Treat those inputs as high-priority article-generation evidence.
- Merge through a pull request and deploy the verified result to Vercel production.

## 2. Current Branch / Commit / PR

- Branch: `codex/sequential-input-wizard`
- Latest commit: `b92f6a7` (feature changes are not committed yet at this handoff checkpoint)
- Last known good commit: `b92f6a7`
- PR: Not created yet
- CodeRabbit OSS review status: Not run; PR creation is the next release step

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

- Implementation is complete locally.
- Full deterministic quality validation is green.
- The feature is not committed, reviewed, merged, or deployed yet.
- Existing untracked `output/` files are generated usage-manual artifacts. They are intentionally excluded from this feature commit and must not be deleted.

## 6. Known Issues

- CodeRabbit OSS and hosted GitHub Actions have not run because the pull request is not created yet.
- Production deployment and production browser smoke verification remain pending.
- The browser automation CLI accessibility command did not return usable output. Existing Playwright interaction/label checks passed, but this pass does not claim a standalone accessibility audit.
- The local visual session saw the generation-log request fail against the current live local provider configuration; this did not crash the page and is outside the wizard change. The mocked E2E error paths passed. Recheck production logs after deployment.
- OpenAI, WordPress, and Supabase live mutation tests were not run for this UI change. The full suite uses isolated provider mocks and does not change production data.
- `output/` remains untracked from the previous PDF-manual task.

## 7. CodeRabbit Review

- Review status: Not run; PR pending.
- Critical findings: None known.
- Resolved findings: None.
- Deferred findings: None.
- False positives / not applicable: None.

## 8. Optional Bugbot Findings

- Status: Not run.
- Findings: None.
- Actions taken: None.
- Reason: Cursor Bugbot is optional/backup only; no CodeRabbit ambiguity or new high-risk credential/database behavior currently requires a second review.

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

## 10. Next Recommended Action

Next Claude Code should:

1. Review the pull request and CodeRabbit OSS output after Codex creates it.
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
