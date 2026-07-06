# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: Previous handoff had `Current owner: Claude Code`, `Next owner: Codex`, and `Loop: 3`; Claude Code returned the same uncommitted Loop 2 + Loop 3 worktree to Codex for the next development pass.
- Phase: Autonomous Improvement / Handoff
- Last updated: 2026-07-06 10:54 +09:00

## 1. Current Goal
Current objective:
- Move the AIO article generator closer to the 100/100 targets for functional reliability, daily-use UX value, and non-commodity article quality.
- Keep changes scoped and reviewable while preserving existing UI, specs, routes, tests, and quality gates.
- Prepare the large uncommitted Loop 2 + Loop 3 diff for Claude Code review and, after review, CodeRabbit OSS/PR flow.

## 2. Current Branch / Commit
- Branch: `codex/persistent-quality-gate-operations`
- Latest pushed code commit: `012d786 Address PR review reliability findings`
- Last known good code commit: `012d786`, which passed local `npm run quality` before commit.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- Important: a final handoff-only commit follows `012d786` and should also be pushed to PR #1.

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
- Committed and pushed the large quality/review-flow diff to `codex/persistent-quality-gate-operations`.
- Updated PR #1 title/body to match the current broader implementation diff.
- Added `@coderabbitai configuration` and `@coderabbitai review` comments on PR #1.
- Verified CodeRabbit replied with resolved configuration and "Review triggered"; CodeRabbit commit status remains pending at the time of this handoff.
- Addressed the prior Cursor Bugbot finding "Resume job UI desync": the primary CTA is blocked until resume-state restoration is checked, and stored generation jobs set `activeGenerationJobId` before polling starts.
- Added an E2E assertion that a reloaded active generation job shows `記事作成をストップ` before the completed draft opens.
- Checked PR #1 comments through the GitHub connector after CodeRabbit installation. CodeRabbit is installed and responding on the PR, but no CodeRabbit inline findings were present yet. Additional Codex automated review P2 findings were present and were valid.
- Fixed the remaining review reliability findings:
  - Guarded the `prepare` lifecycle by replacing direct `husky` execution with `scripts/setup-husky.mjs`, so production/CI or missing/nonzero Husky setup no longer breaks installs.
  - Updated branch-protection docs to require the actual GitHub Actions job check `Typecheck, lint, tests, E2E, build`, not just the workflow name `quality-gate`.
  - Tightened HTML attachment noise filtering so article sections such as `market-share-analysis` and `revenue-share` are preserved while share widgets such as `share-buttons` are still removed.
  - Fixed OpenAI retry delay handling so retryable responses without `Retry-After` use the configured/default backoff instead of a zero-delay retry loop.
  - Fixed XLSX rich-text shared string parsing so each `<si>` entry remains one shared-string index and rich text runs are concatenated without corrupting later cell values.
- Added regression tests for share-section preservation, XLSX rich text shared strings, and OpenAI retry backoff without `Retry-After`.

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
- `scripts/setup-husky.mjs`
- `src/lib/server/openai.ts`
- `tests/unit/openai.test.ts`

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
- `npm run quality` passes locally after the latest Codex change, including the PR review reliability fixes.
- A manual PC-browser smoke pass for the initial workflow passes with zero console errors.
- A manual PC-browser smoke pass for an already generated draft passes with zero console errors.
- The targeted core workflow E2E passes after adding the sticky-anchor and draft-only-nav regression assertions.
- Test integrity, unit/integration tests, contract tests, coverage, Playwright E2E, and production build all pass.
- `docs/quality-audit.md` now records the current inventory and why the three 100/100 scores are still unproven.
- Live readiness is currently not ready. This is expected and safe: the readiness script stopped before live provider calls.
- PR #1 is open against `main` and points at `codex/persistent-quality-gate-operations`.
- CodeRabbit is installed/enabled for `kotakase2022-jpg/aio`; CodeRabbit configuration was confirmed on PR #1 and review was manually triggered.
- CodeRabbit is installed and responding on PR #1. No CodeRabbit inline findings were present in the GitHub connector output during this pass; the visible actionable findings were Codex automated review P2 comments, now fixed in `012d786`.
- `012d786` has been pushed to PR #1. Re-check PR #1 for CodeRabbit and GitHub Actions results on the latest pushed head after the final handoff-only commit is pushed.
- No deploy, production DB write, production API mutation, force push, or secret output was performed.

## 6. Known Issues
- Live OpenAI / Supabase / WordPress sandbox verification is still not completed. Existing E2E tests mock external services to avoid production data/API damage.
- `npm run test:live:readiness` reports missing `AIO_LIVE_CONTRACT_TESTS`, Supabase live-test confirmation/write variables, and WordPress sandbox credentials. It also warns that the current Supabase host does not look like a sandbox/staging host.
- Real generated-article quality review and live WordPress recovery remain manual/sandbox follow-up work.
- CodeRabbit review output should be checked again after pushing `012d786` and this handoff update.
- The three high-level 100/100 targets are not yet fully proven because live sandbox/manual checks remain.

## 7. Bugbot Findings
Automated review findings and status:
- CodeRabbit OSS is now the standard automated PR reviewer for this repository.
- CodeRabbit GitHub App is installed and includes `kotakase2022-jpg/aio` in the selected repository list.
- Cursor Bugbot is optional/backup only. Do not run Bugbot by default.
- CodeRabbit PR review has been triggered on PR #1. The GitHub connector confirmed CodeRabbit bot replied to `@coderabbitai review`, but no CodeRabbit inline findings were visible in the fetched PR comments during this pass.
- CodeRabbit configuration comment succeeded and showed `.coderabbit.yaml` as the resolved repository config.
- Prior Cursor Bugbot finding "Resume job UI desync" was verified against current code, reproduced as a valid risk, fixed, and covered by E2E.
- Codex automated review P2 findings addressed in `012d786`:
  - Guard the Husky prepare script.
  - Require the actual Actions job check.
  - Require widget context before dropping share sections.
  - Apply backoff when `Retry-After` is absent.
  - Preserve each XLSX shared string entry.
- Do not run Bugbot again by default. Use Bugbot only if CodeRabbit is unavailable, a second opinion is materially useful, or the user explicitly asks for it.

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
git commit -m "Strengthen AIO quality gates and review flow"
git push -u origin codex/persistent-quality-gate-operations
GitHub PR update for PR #1
@coderabbitai configuration
@coderabbitai review
npx playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "active generation job is restored"
npm run lint
npm run typecheck
npm run quality
GitHub connector fetch of PR #1 comments
npm run prepare
npx vitest run tests/unit/file-extraction.test.ts tests/unit/openai.test.ts
npm run lint
npm run typecheck
npm run quality
git commit -m "Address PR review reliability findings"
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
- `git commit -m "Strengthen AIO quality gates and review flow"`: passed, created `ed3214f`.
- First `git push -u origin codex/persistent-quality-gate-operations`: failed with a transient `curl 55 Send failure: Connection was reset`; no remote update occurred.
- Second `git push -u origin codex/persistent-quality-gate-operations`: passed. The pre-push hook also passed lint, typecheck, test integrity, unit tests, and contract tests.
- PR #1 update: passed. PR URL is https://github.com/kotakase2022-jpg/aio/pull/1.
- `@coderabbitai configuration`: succeeded. CodeRabbit replied with the resolved `.coderabbit.yaml` configuration.
- `@coderabbitai review`: succeeded. CodeRabbit replied that review was triggered, but the `CodeRabbit` commit status remained pending after several minutes of polling.
- Prior Cursor Bugbot finding review: "Resume job UI desync" was still applicable before this follow-up fix. Fixed in `src/components/aio/article-generator-app.tsx`.
- `npx playwright test tests/e2e/aio-workflow.spec.ts --project=chromium-pc --grep "active generation job is restored"`: passed after the resume-job fix.
- `npm run lint`: passed after the resume-job fix.
- `npm run typecheck`: passed after the resume-job fix.
- Latest `npm run quality` after the resume-job fix: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 40 files checked.
  - `npm run test`: passed, 36 files / 223 tests.
  - `npm run test:contract`: passed, 3 files / 9 tests.
  - `npm run test:coverage`: passed, statements 84.5%, branches 70.69%, functions 90.74%, lines 84.97%.
  - `npm run test:e2e`: passed, 45 Chromium PC tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- `git commit -m "Fix resumed generation CTA state"`: passed, created `8e794e0`.
- `git push -u origin codex/persistent-quality-gate-operations` after the resume-job fix: passed. The pre-push hook also passed lint, typecheck, test integrity, unit tests, and contract tests.
- Final `npm run quality` after the manual-smoke documentation, anchor fix, and E2E regression update: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 40 files checked.
  - `npm run test`: passed, 36 files / 223 tests.
  - `npm run test:contract`: passed, 3 files / 9 tests.
  - `npm run test:coverage`: passed, statements 84.5%, branches 70.69%, functions 90.74%, lines 84.97%.
  - `npm run test:e2e`: passed, 45 Chromium PC tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- GitHub connector PR comment fetch: confirmed CodeRabbit bot replied to `@coderabbitai review`; no CodeRabbit inline findings were present in fetched comments. Codex automated review P2 findings were present and addressed.
- `npm run prepare` with `NODE_ENV=production`: passed, proving production/CI style installs skip Husky setup safely.
- Initial normal `npm run prepare` failed because the local Husky command returned nonzero; `scripts/setup-husky.mjs` was adjusted to treat Husky setup failure as nonfatal for install safety.
- Final normal `npm run prepare`: passed.
- `npx vitest run tests/unit/file-extraction.test.ts tests/unit/openai.test.ts`: passed, 2 files / 18 tests.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Latest `npm run quality` after PR review reliability fixes: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 40 files checked.
  - `npm run test`: passed, 36 files / 225 tests.
  - `npm run test:contract`: passed, 3 files / 9 tests.
  - `npm run test:coverage`: passed, statements 84.78%, branches 70.97%, functions 91%, lines 85.21%.
  - `npm run test:e2e`: passed, 45 Chromium PC tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- `git commit -m "Address PR review reliability findings"`: passed, created `012d786`.

## 9. Next Recommended Action
Next first action for Claude Code:
1. Confirm the final handoff-only commit after `012d786` is pushed to PR #1.
2. Re-check PR #1 for CodeRabbit completion and GitHub Actions status on the new head. Record findings here and fix Critical/High issues first.
3. Confirm the old Cursor Bugbot "Resume job UI desync" thread is resolved by the resume-state CTA block and E2E coverage.
4. Review the PR review reliability fixes in `scripts/setup-husky.mjs`, `src/lib/server/file-extraction.ts`, `src/lib/server/openai.ts`, and related tests.
5. Review `docs/quality-audit.md` for accuracy against the actual app/test state.
6. Prepare disposable `.env.live.local` settings if live sandbox verification is required, then rerun `npm run test:live:readiness`.
7. Use Cursor Bugbot only as optional backup if CodeRabbit is unavailable, a second opinion is needed, or the user explicitly asks for it.
8. If CodeRabbit and quality checks are clean, continue the PR review/merge preparation. Do not push to `main` directly.

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
- Whether the Husky prepare guard is conservative enough for Vercel/production installs while still helpful locally.
- Whether the HTML share-widget heuristic preserves enough legitimate article sections without leaving noisy social widgets.
- Whether the OpenAI retry backoff behavior is appropriate for rate-limit recovery without making generation feel stuck.
- Whether the XLSX rich-text shared string parsing covers the real files users attach.

## 11. Do Not Touch
Avoid touching:
- `.env`, `.env.local`, `.env.production`, or any secrets.
- Production Supabase, WordPress, OpenAI, or Vercel data/configuration.
- Existing quality gates by deletion, skip, todo, or weakening.
- Generated build artifacts and dependency directories.
- Unrelated UI redesigns or broad refactors.

## 12. Notes for Claude Code
- This is still Loop 3 continuation. Move to Loop 4 only after this PR is reviewed, fixed, and handed back.
- The repository uses Next.js 16.2.9; read `node_modules/next/dist/docs/` before changing Next.js-specific APIs.
- PR flow is required. Do not push directly to `main`.
- Tests are intentionally strict about no `skip`/`only`/weakened checks.
- CodeRabbit OSS is now the default PR review automation. Cursor Bugbot is backup only; this is a cost-control policy.
- Current high-level self-score after this pass:
  - Functional reliability: 99/100, limited by live sandbox/manual external-service verification.
  - Daily-use UX value: 98/100, limited by remaining live WordPress recovery verification and CodeRabbit PR review.
  - Non-commodity article quality: 98/100, limited by live generated-output review against real business inputs.
