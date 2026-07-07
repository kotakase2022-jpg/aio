# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: The previous handoff kept `Loop: 3 continuation`, the active 100/100 objective remains unproven by live sandbox tests and human article-quality review, and this pass continued with one focused reliability/UX improvement.
- Phase: Autonomous Improvement / Image Generation Reliability / Handoff
- Last updated: 2026-07-08 02:08 +09:00

## 1. Current Goal

Improve the AIO article generator toward the active 100/100 goal:

- all major functions and PC-browser flows work without bugs or confusing recovery states
- the app feels strong enough for daily article-production work
- generated articles feel specific, source-aware, and editorial rather than commodity AI content

This Codex pass made generated image creation more resilient. Even though article generation already normalizes image prompts, `createArticleImagesForDraft` could still return fewer generated images if it ever received an article object with missing `image_prompts`. The image helper now fills missing requested slots (`featured`, `inline-1`, `inline-2`) with article-specific fallback prompts before calling the Image API. This reduces the chance of missing article images when upstream AI output is incomplete or future callers provide partially normalized article data.

The overall goal is not complete. Live sandbox contract tests for OpenAI/Supabase/WordPress, human review of real generated article quality, and remaining low-priority CodeRabbit Deferred cleanup are still open.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest implementation commit: `3d1d14d Fill missing article image prompts before generation`
- Previous implementation commit: `94eaf48 Preserve article sections during author block replacement`
- Latest pushed handoff before this status refresh: `9b7e00c Update handoff after image prompt fallback fix`
- Previous handoff commit: `ed3d50c Refresh final author preservation handoff status`
- Last known good local verification: `npm.cmd run quality` passed after `3d1d14d`.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- PR status before this implementation pass: CodeRabbit SUCCESS, GitHub Actions `Typecheck, lint, tests, E2E, build` SUCCESS, mergeState CLEAN at head `ed3d50c`.
- PR status after implementation/handoff push: CodeRabbit SUCCESS, GitHub Actions `Typecheck, lint, tests, E2E, build` SUCCESS, mergeState CLEAN at head `9b7e00c`.
- Note: this final status refresh is documentation-only. If pushed as a newer commit after `9b7e00c`, re-check PR #1 once more.

## 3. What Was Done

- Read required workflow files, current handoff, branch status, recent commits, and PR status before editing.
- Confirmed PR #1 was green before this pass.
- Inspected image generation helpers, article generation image prompt normalization, existing image tests, and fixtures.
- Updated `src/lib/server/article-images.ts`:
  - Added server-side prompt normalization inside `createArticleImagesForDraft`.
  - Requested generated slots are now filled in canonical order: `featured`, `inline-1`, `inline-2`.
  - Missing prompts get article-specific fallback prompts using the title, corresponding heading, and key takeaway.
  - Existing slot-specific prompts are preserved when present.
- Updated `tests/unit/article-images.test.ts`:
  - Added `beforeEach(vi.clearAllMocks)` to remove inter-test mock call coupling.
  - Added a regression test proving that `imageCount: 3` with zero upstream prompts still generates `featured`, `inline-1`, and `inline-2`.
  - Asserted fallback prompts include article-specific anchors rather than generic image text.
- Ran focused and full verification successfully.
- Cursor Bugbot was not run; CodeRabbit OSS remains the standard review path.

## 4. Files Changed

- `src/lib/server/article-images.ts`
- `tests/unit/article-images.test.ts`
- `AI_HANDOFF.md`

## 5. Current Status

- Implementation commit `3d1d14d` is pushed.
- Handoff commit `9b7e00c` is pushed.
- Local full quality gate is green after the implementation commit.
- PR #1 was green at head `9b7e00c`; re-check if this final status refresh is committed/pushed as a newer head.

## 6. Known Issues

- Remaining low-priority CodeRabbit Deferred / cleanup items:
  - Some duplication/commonization opportunities remain.
  - Test design improvements remain around direct React component imports and broader section-removal regression coverage.
  - markdownlint/document formatting items remain.
  - Some env restore helper expansion opportunities remain.
- FAQ generic-question detection may still be slightly strict for definition-style FAQs. This is currently aligned with the editorial policy that definitions belong in the body and FAQ should focus on practical decisions, but real generated data should be monitored.
- `test:live:*` was not run because sandbox credentials are required.
- Human review of real generated article quality is still needed.
- The active 100/100 goal is not complete.

## 7. CodeRabbit Review

- Review status before this pass: PR #1 open; CodeRabbit SUCCESS and GitHub Actions SUCCESS at head `ed3d50c`.
- Current pass:
  - Strengthens image-generation reliability when upstream image prompts are incomplete.
- Critical findings:
  - No known open Critical findings at the time of this handoff.
- Resolved / strengthened findings:
  - `createArticleImagesForDraft` no longer silently returns fewer generated images solely because `article.image_prompts` is short or empty.
  - Unit tests now cover fallback image prompt creation and per-test mock isolation.
- Deferred findings:
  - See `Known Issues`.
- False positives / not applicable:
  - No new false positives identified in this pass.

## 8. Optional Bugbot Findings

- Status: Not run
- Findings: None
- Actions taken: None
- Reason: Cursor Bugbot is optional/backup only. This pass changed server-side image prompt fallback logic and unit tests, with full local quality passing and CodeRabbit OSS as the standard review path.

## 9. Verification Results

Commands run in this pass:

```bash
npx.cmd vitest run tests/unit/article-images.test.ts
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run quality
git commit -m "Fill missing article image prompts before generation"
git commit -m "Update handoff after image prompt fallback fix"
git push origin codex/persistent-quality-gate-operations
gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15
```

Results:

- `npx.cmd vitest run tests/unit/article-images.test.ts`: passed, 1 file / 5 tests.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run quality`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 43 files.
  - `npm run test`: passed, 39 files / 284 tests.
  - `npm run test:contract`: passed, 3 files / 12 tests.
  - `npm run test:coverage`: passed, statements 87.00%, branches 73.90%, functions 91.61%, lines 87.45%.
  - `npm run test:e2e`: passed, 48 PC Chromium tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- Commit pre-commit hook: passed, `npm run lint` and `npm run test:integrity`.
- `git push origin codex/persistent-quality-gate-operations`: passed. Pre-push ran `npm run lint`, `npm run typecheck`, `npm run test:integrity`, `npm run test`, and `npm run test:contract`; all passed.
- PR #1 at head `9b7e00c`: CodeRabbit SUCCESS, GitHub Actions `Typecheck, lint, tests, E2E, build` SUCCESS, mergeState CLEAN.

Not run:

- `npm.cmd run test:live:*` because sandbox credentials are required.
- Post-push CodeRabbit/GitHub Actions for this final documentation-only status refresh if it is pushed as a newer head.

## 10. Next Recommended Action

Next Claude Code should:

1. Review `3d1d14d Fill missing article image prompts before generation` and this handoff.
2. Confirm PR #1 checks after the latest push: CodeRabbit OSS and GitHub Actions should be green.
3. Review the image prompt fallback behavior in `src/lib/server/article-images.ts`, especially:
   - existing AI-provided slot prompts are preserved
   - missing requested slots are filled in canonical order
   - fallback prompts are article-specific enough to avoid generic AI image output
4. If checks stay green and no major review comments appear, continue with another small high-value Deferred item or a live/sandbox article-quality proof step.
5. Run `npm.cmd run quality` after any code changes and record the result here.

## 11. Suggested Review Scope for Claude Code

- `src/lib/server/article-images.ts`
  - `normalizePromptsForImageCreation`
  - `fallbackImagePrompt`
  - interaction with uploaded visual tone mode and `imageCount`
- `tests/unit/article-images.test.ts`
  - fallback prompt test
  - mock isolation with `beforeEach`

## 12. Risk Notes

- This change is intentionally narrow and does not alter API routes, DB persistence, OpenAI wrapper behavior, WordPress calls, auth, or UI layout.
- The fallback prompts are a safety net. Normal article generation should still provide richer prompts through `normalizeImagePrompts` in `src/lib/server/article-generation.ts`.
- If future UX requires fewer images when the model omits prompts intentionally, this fallback may be too eager. Current product requirement is that selected image count should drive generated image count, so filling missing prompts is aligned.
- Live external-service proof is still missing.

## 13. Do Not Touch

- `.env*`, OpenAI/Supabase/WordPress/Vercel credentials, production data.
- `.claude/` unless the user explicitly asks.
- Quality gate, test integrity, and CodeRabbit operating docs should not be weakened.
- Avoid unrelated UI rewrites, screen-transition changes, broad refactors, production deploys, production DB/API writes, `git push --force`, or `git reset --hard`.

## 14. Notes for Claude Code

- Use `npm.cmd` / `npx.cmd` on Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer. Cursor Bugbot is optional/backup only.
- Keep Loop 3 continuation unless you decide the remaining Deferred items are sufficiently closed and the next cycle should become Loop 4.
- Do not call `update_goal complete`; the 100/100 objective is not proven yet.
