# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: Previous handoff had `Current owner: Claude Code`, `Next owner: Codex`, and `Loop: 3`; Claude Code returned the same uncommitted Loop 2 + Loop 3 worktree to Codex for the next development pass.
- Phase: Autonomous Improvement / Handoff
- Last updated: 2026-07-06 10:25 +09:00

## 1. Current Goal
Current objective:
- Move the AIO article generator closer to the 100/100 targets for functional reliability, daily-use UX value, and non-commodity article quality.
- Keep changes scoped and reviewable while preserving existing UI, specs, routes, tests, and quality gates.
- Prepare the large uncommitted Loop 2 + Loop 3 diff for Claude Code review and, after review, CodeRabbit OSS/PR flow.

## 2. Current Branch / Commit
- Branch: `codex/persistent-quality-gate-operations`
- Latest commit: `d20ac08 Validate source digestion threshold`
- Last known good commit: `d20ac08` plus the current uncommitted Loop 2 + Loop 3 worktree has passed `npm run quality`.
- Important: The worktree still contains a large uncommitted diff. Several new files are untracked and must be staged deliberately before any commit.

## 3. What Was Done
Completed in this Codex pass:
- Read the required handoff/orientation context and confirmed Claude Code returned Loop 3 to Codex.
- Addressed Claude Code's noted risk in HTML attachment extraction: legitimate article sections such as `subscription-pricing` are now preserved instead of being removed as noise.
- Kept subscription UI noise removal for widget-like markers such as `subscribe-box` and newsletter subscribe blocks.
- Added regression assertions to the HTML extraction unit test for both the preserved article section and removed subscribe/newsletter widgets.
- Ran the targeted unit test and the full project quality gate successfully.
- Rewrote this handoff file to clean ASCII text because the previous rendered content was mojibake in the shell.
- Migrated automated review policy documentation: CodeRabbit OSS is now the standard PR reviewer, and Cursor Bugbot is optional/backup only for cost control.
- Added `.coderabbit.yaml` and `docs/review-automation.md`; updated `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/testing.md`, and the PR template to match the new review policy.
- Added CodeRabbit schema metadata to `.coderabbit.yaml` and documented `@coderabbitai configuration` as the PR-side check for resolved settings.
- Added `docs/quality-audit.md` with the current feature inventory, mechanical evidence, proof gaps, self-scores, and next improvement targets for the active 100/100 goal.
- Linked `docs/quality-audit.md` from `README.md`.
- Ran `npm run test:live:readiness`; it failed closed without calling providers because sandbox-only flags/credentials are not ready. Documented the result in `docs/quality-audit.md`.
- Performed a manual PC-browser smoke pass at 1440 x 1000 through demo login, initial form visibility, sticky CTA, generation-log collapse/expand, reference/theme/primary-info inputs, and console-error checks.
- Found and fixed a sticky step-navigation overlap where anchor clicks left target cards slightly hidden under the nav; increased left/right card `scroll-mt` from 280px to 360px.
- Added an E2E regression assertion to the core workflow so `#theme` anchor navigation must leave visible clearance below the sticky step navigation.
- Fixed the remaining draft-only step-navigation issue: before a draft exists, `承認` and `WordPress` now render as disabled non-link items instead of anchors to missing sections; after draft generation, they become normal links again.
- Added E2E assertions for the draft-only nav states and the generated `#approval` anchor clearance.
- Performed an additional generated-draft PC browser smoke pass using local fallback `.data` and no live providers.
- Confirmed generation-log reopening, preview, fullscreen preview, edit form visibility, approval/WordPress section visibility, no page-level horizontal overflow, clipboard-error recovery messaging, HTML export success messaging, and zero console errors.
- Saved ignored local screenshots under `test-results/manual-generated-draft-*.png`.
- Confirmed CodeRabbit GitHub App was already installed for the account, added `kotakase2022-jpg/aio` to its selected repository access, and verified GitHub now shows `Selected 3 repositories` including `kotakase2022-jpg/aio`.
- Re-ran the full local quality gate after the CodeRabbit installation documentation updates; it passed.
- Ran a focused secret-pattern scan over the repository. Matches were limited to documented/test dummy values, not real keys.

Previously completed in the broader Loop 2 + Loop 3 uncommitted diff:
- Shared source URL normalization in `src/lib/source-url.ts`.
- Expanded article, title, FAQ, source digestion, and regeneration-action quality checks.
- Strengthened draft HTML handling and quality edit guidance.
- Improved article/image generation validation and tests.
- Improved file extraction for Office XML entities, HTML noise removal, and Shift_JIS fallback.
- Added/expanded extensive unit, integration, contract, and Playwright E2E coverage.
- Added demo login recovery E2E coverage.

## 4. Files Changed
Main files changed in this Codex pass:
- `src/lib/server/file-extraction.ts`
- `tests/unit/file-extraction.test.ts`
- `AI_HANDOFF.md`
- `.coderabbit.yaml`
- `.github/pull_request_template.md`
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/testing.md`
- `docs/review-automation.md`
- `docs/quality-audit.md`
- `src/components/aio/article-generator-app.tsx`
- `tests/e2e/aio-workflow.spec.ts`

The worktree also still contains the larger existing Loop 2 + Loop 3 diff across:
- `src/components/aio/article-generator-app.tsx`
- `src/components/aio/demo-login-form.tsx`
- `src/lib/article-quality.ts`
- `src/lib/draft-html.ts`
- `src/lib/faq-quality.ts`
- `src/lib/server/article-generation.ts`
- `src/lib/server/article-images.ts`
- `src/lib/title-quality.ts`
- `tests/e2e/aio-workflow.spec.ts`
- `tests/fixtures/article.ts`
- `tests/integration/drafts-supabase.integration.test.ts`
- multiple `tests/unit/*` files
- untracked `src/lib/quality-regeneration-action.ts`
- untracked `src/lib/source-url.ts`
- untracked `tests/unit/quality-edit-guidance.test.ts`
- untracked `tests/unit/quality-regeneration-action-coverage.test.ts`
- untracked `tests/unit/source-url.test.ts`

## 5. Current Status
- `npm run quality` passes locally after the latest Codex change.
- A manual PC-browser smoke pass for the initial workflow passes with zero console errors.
- A manual PC-browser smoke pass for an already generated draft passes with zero console errors.
- The targeted core workflow E2E passes after adding the sticky-anchor and draft-only-nav regression assertions.
- Test integrity, unit/integration tests, contract tests, coverage, Playwright E2E, and production build all pass.
- `docs/quality-audit.md` now records the current inventory and why the three 100/100 scores are still unproven.
- Live readiness is currently not ready. This is expected and safe: the readiness script stopped before live provider calls.
- The current diff is still intentionally uncommitted.
- CodeRabbit is installed/enabled for `kotakase2022-jpg/aio`; an actual PR review by CodeRabbit is still pending until a PR is opened or updated.
- No deploy, production DB write, production API mutation, force push, or secret output was performed.

## 6. Known Issues
- Live OpenAI / Supabase / WordPress sandbox verification is still not completed. Existing E2E tests mock external services to avoid production data/API damage.
- `npm run test:live:readiness` reports missing `AIO_LIVE_CONTRACT_TESTS`, Supabase live-test confirmation/write variables, and WordPress sandbox credentials. It also warns that the current Supabase host does not look like a sandbox/staging host.
- Real generated-article quality review and live WordPress recovery remain manual/sandbox follow-up work.
- The large uncommitted diff should be reviewed carefully before staging/committing. Untracked files are required by tests and should not be missed.
- The three high-level 100/100 targets are not yet fully proven because live sandbox/manual checks remain.

## 7. Bugbot Findings
Automated review findings and status:
- CodeRabbit OSS is now the standard automated PR reviewer for this repository.
- CodeRabbit GitHub App is installed and includes `kotakase2022-jpg/aio` in the selected repository list.
- Cursor Bugbot is optional/backup only. Do not run Bugbot by default.
- No CodeRabbit PR review has run for this uncommitted diff yet, and no Bugbot findings were provided in this Codex pass.
- Recommended next step after Claude Code review: open/update the PR and let CodeRabbit review the full diff. Use Bugbot only if CodeRabbit is unavailable, a second opinion is materially useful, or the user explicitly asks for it.

## 8. Verification Results
Commands run in this Codex pass:

```bash
npx vitest run tests/unit/file-extraction.test.ts
npm run quality
git diff --check
git diff --stat
git status --short
rg -n "Bugbot|CodeRabbit|Cursor|bugbot|coderabbit" .
rg -n "quality-audit|coderabbitai configuration|schema.v2" README.md docs .coderabbit.yaml AI_HANDOFF.md
npm run test:live:readiness
npx playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "PC browser can complete"
Chrome/GitHub manual verification for CodeRabbit installation
git diff --check
```

Results:
- `npx vitest run tests/unit/file-extraction.test.ts`: passed, 1 file / 7 tests.
- `npm run quality`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 40 files checked.
  - `npm run test`: passed, 36 files / 223 tests.
  - `npm run test:contract`: passed, 3 files / 9 tests.
  - `npm run test:coverage`: passed, statements 84.5%, branches 70.69%, functions 90.74%, lines 84.97%.
  - `npm run test:e2e`: passed, 45 Chromium PC tests.
- `npm run build`: passed, Next.js 16.2.9 production build.
- `git diff --check`: passed with no whitespace errors.
- Review-policy migration docs/config were included in the latest full `npm run quality` run, and the full gate passed.
- The full `npm run quality` gate was rerun after the live-readiness/audit documentation updates, and it passed again.
- `.coderabbit.yaml` was inspected with UTF-8 decoding and now includes `# yaml-language-server: $schema=https://coderabbit.ai/integrations/schema.v2.json`.
- `docs/quality-audit.md` was added and README-linked; the audit explicitly keeps all three scores below 100 until live sandbox checks, hosted CodeRabbit review, and manual PC browser review are proven.
- `npm run test:live:readiness`: failed closed as expected because sandbox live-test env vars are not configured. No live provider calls were made.
- Manual PC-browser smoke: passed at 1440 x 1000 after the anchor fix; screenshots were written to ignored local files under `test-results/manual-pc-*.png`; console error log was empty.
- Initial manual anchor measurement found `#theme` and other left cards hidden by the sticky step navigation by about 26px. After the `scroll-mt` fix, the main left-card anchors measured visible clearance and no console errors.
- `npx playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "PC browser can complete"`: passed, 1 Chromium PC test.
- After the draft-only nav fix, `npx playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "PC browser can complete"` passed again, 1 Chromium PC test.
- Generated-draft manual PC browser smoke: passed using local fallback `.data` and no live provider calls.
  - Generation log reopen worked.
  - Draft preview, fullscreen preview, edit form, approval section, and WordPress section were visible.
  - Page-level horizontal overflow was absent (`bodyScrollWidth` matched client width).
  - Clipboard copy showed the expected manual recovery message when this browser environment denied clipboard access.
  - HTML export showed success after a direct click retry; the browser download-event hook itself timed out once in the in-app browser, but the app UI recovered and reported success without console errors.
  - Console error log remained empty.
- `git diff --check` after the generated-draft smoke documentation updates: passed with no whitespace errors.
- Final `npm run quality` after the draft-only navigation fix: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 40 files checked.
  - `npm run test`: passed, 36 files / 223 tests.
  - `npm run test:contract`: passed, 3 files / 9 tests.
  - `npm run test:coverage`: passed, statements 84.5%, branches 70.69%, functions 90.74%, lines 84.97%.
  - `npm run test:e2e`: passed, 45 Chromium PC tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- Final `git diff --check`: passed with no whitespace errors.
- Chrome/GitHub manual verification for CodeRabbit installation: passed. GitHub App settings show `coderabbitai` installed with selected repository access and selected repositories including `kotakase2022-jpg/aio`, `kotakase2022-jpg/ai-jimukyoku`, and `kotakase2022-jpg/SalesForm`. All-repositories access remains disabled.
- `git diff --check` after the CodeRabbit installation documentation updates: passed with no whitespace errors.
- Secret-pattern scan after CodeRabbit setup: passed for real-secret risk. Matches were only documented/test dummy values such as CI placeholders and test-only Supabase/OpenAI/WordPress keys.
- Latest `npm run quality` after the CodeRabbit installation documentation updates: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 40 files checked.
  - `npm run test`: passed, 36 files / 223 tests.
  - `npm run test:contract`: passed, 3 files / 9 tests.
  - `npm run test:coverage`: passed, statements 84.5%, branches 70.69%, functions 90.74%, lines 84.97%.
  - `npm run test:e2e`: passed, 45 Chromium PC tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- Final `npm run quality` after the manual-smoke documentation, anchor fix, and E2E regression update: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 40 files checked.
  - `npm run test`: passed, 36 files / 223 tests.
  - `npm run test:contract`: passed, 3 files / 9 tests.
  - `npm run test:coverage`: passed, statements 84.5%, branches 70.69%, functions 90.74%, lines 84.97%.
  - `npm run test:e2e`: passed, 45 Chromium PC tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.

## 9. Next Recommended Action
Next first action for Claude Code:
1. Review the small latest Codex fix in `src/lib/server/file-extraction.ts` and `tests/unit/file-extraction.test.ts`.
2. Confirm the HTML noise marker policy is conservative enough: keep article sections like `subscription-pricing`, remove widget blocks like `subscribe-box` and newsletters.
3. Review the broader uncommitted Loop 2 + Loop 3 diff and verify untracked files are included before commit/PR.
4. Review the CodeRabbit OSS migration docs/config added in this pass.
5. Review the sticky-anchor and draft-only navigation changes in `src/components/aio/article-generator-app.tsx` and the E2E assertions in `tests/e2e/aio-workflow.spec.ts`.
6. Review the generated-draft manual smoke notes in this handoff and `docs/quality-audit.md`.
7. Review `docs/quality-audit.md` for accuracy against the actual app/test state.
8. Prepare disposable `.env.live.local` settings if live sandbox verification is required, then rerun `npm run test:live:readiness`.
9. Open/update the PR and let the installed CodeRabbit app review the diff. Record CodeRabbit findings here.
10. Comment `@coderabbitai configuration` on the PR to verify the effective CodeRabbit settings.
11. Use Cursor Bugbot only as optional backup if CodeRabbit is unavailable, a second opinion is needed, or the user explicitly asks for it.
12. If CodeRabbit and quality checks are clean, prepare a deliberate commit/PR flow. Do not push to `main` directly.

## 10. Suggested Review Scope for Claude Code
Please focus review on:
- False positives/false negatives in `isHtmlNoiseMarker`.
- Whether `subscription`/`subscribe` widget detection should include or exclude any additional token combinations.
- The larger quality-check additions in `article-quality`, `draft-html`, title/FAQ quality, and regeneration-action mapping.
- E2E coverage realism for PC workflows, especially mocked OpenAI/Supabase/WordPress boundaries.
- Whether the untracked files are correctly included before staging.
- Whether `.coderabbit.yaml` is appropriately conservative for this public OSS repository and does not create excessive review noise.
- Whether `docs/quality-audit.md` accurately captures the feature inventory, proof gaps, and active self-scores.
- Whether the `scroll-mt-[360px]` anchor clearance and disabled draft-only nav items are the right long-term UX.

## 11. Do Not Touch
Avoid touching:
- `.env`, `.env.local`, `.env.production`, or any secrets.
- Production Supabase, WordPress, OpenAI, or Vercel data/configuration.
- Existing quality gates by deletion, skip, todo, or weakening.
- Generated build artifacts and dependency directories.
- Unrelated UI redesigns or broad refactors.

## 12. Notes for Claude Code
- This is still Loop 3 continuation. Move to Loop 4 only after this large uncommitted diff is reviewed, committed/PR'd, and handed back.
- The repository uses Next.js 16.2.9; read `node_modules/next/dist/docs/` before changing Next.js-specific APIs.
- PR flow is required. Do not push directly to `main`.
- Tests are intentionally strict about no `skip`/`only`/weakened checks.
- CodeRabbit OSS is now the default PR review automation. Cursor Bugbot is backup only; this is a cost-control policy.
- Current high-level self-score after this pass:
  - Functional reliability: 99/100, limited by live sandbox/manual external-service verification.
  - Daily-use UX value: 98/100, limited by remaining live WordPress recovery verification and CodeRabbit PR review.
  - Non-commodity article quality: 98/100, limited by live generated-output review against real business inputs.
