# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: The previous handoff kept `Loop: 3 continuation`, the active 100/100 objective is still not fully proven by live sandbox tests or human article-quality review, and this pass continued with one focused improvement to make theme-candidate generation use the new first-party information input.
- Phase: Autonomous Improvement / Primary Info Theme Candidate Input / Handoff
- Last updated: 2026-07-08 02:48 +09:00

## 1. Current Goal

Improve the AIO article generator toward the active 100/100 goal:

- all major functions and PC-browser flows work without bugs or confusing recovery states
- the app feels strong enough for daily article-production work
- generated articles feel specific, source-aware, and editorial rather than commodity AI content

This Codex pass addressed a concrete article-quality gap: the UI already had an `AIOのための一次情報` textarea and article generation used that value, but the `AIで候補出力` flow under `テーマ・キーワード` did not send that first-party information to `/api/theme-candidates`. Theme and keyword suggestions could therefore remain more generic than the later article generation.

The theme-candidate API now accepts and compacts `primaryInfo`, the client sends it from the form, and tests prove both the server prompt/input and the PC-browser retry/apply flow include it. This should help the user generate more original theme angles before drafting.

The overall goal is not complete. Live sandbox contract tests for OpenAI/Supabase/WordPress, human review of real generated article quality, and remaining low-priority CodeRabbit deferred cleanup are still open.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest implementation commit: `9670708 Use primary info for theme candidates`
- Previous implementation commit: `f1a8e0d Preserve h3 sections after author block replacement`
- Previous pushed handoff commit: `ea2bfe3 Refresh final h3 author section handoff status`
- Last known good local verification: `npm.cmd run quality` passed after `9670708`.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- PR status before this implementation pass: CodeRabbit SUCCESS, GitHub Actions `Typecheck, lint, tests, E2E, build` SUCCESS, mergeState CLEAN at head `ea2bfe3`.
- PR status after this handoff commit/push: re-check required after pushing the handoff commit.

## 3. What Was Done

- Read required workflow files, current handoff, branch status, recent commits, PR status, and the relevant local Next.js Route Handler docs before editing.
- Confirmed PR #1 was green before this pass.
- Updated `/api/theme-candidates` to accept optional `primaryInfo`.
- Added OpenAI instructions that treat provided first-party information as a high-priority source for original angles, field observations, caveats, reader pain points, and differentiation ideas while avoiding verbatim copying.
- Added `primaryInfo` to the compacted AI payload with truncation.
- Updated the article generator UI request so `generateThemeCandidates()` sends the current `primaryInfo` textarea value.
- Strengthened integration coverage to verify `primaryInfo` is compacted/truncated and the prompt mentions first-party/original-angle handling.
- Strengthened PC Chromium E2E coverage to verify the theme-candidate retry/apply flow sends the textarea value to `/api/theme-candidates`.
- Cursor Bugbot was not run; CodeRabbit OSS remains the standard review path.

## 4. Files Changed

- `src/app/api/theme-candidates/route.ts`
- `src/components/aio/article-generator-app.tsx`
- `tests/integration/ai-routes.integration.test.ts`
- `tests/e2e/aio-workflow.spec.ts`
- `AI_HANDOFF.md`

## 5. Current Status

- Implementation commit `9670708` exists locally and passed the full local quality gate.
- This handoff document records the state before the final handoff commit/push.
- PR #1 was green at `ea2bfe3` before this implementation pass.
- After pushing the implementation and handoff commits, Claude Code should confirm CodeRabbit OSS and GitHub Actions are green on the latest PR head.

## 6. Known Issues

- Remaining low-priority CodeRabbit deferred / cleanup items:
  - Some duplication/commonization opportunities remain.
  - Broader nested/irregular HTML section-removal regression coverage can still be expanded.
  - markdownlint/document formatting items remain.
  - Some env restore helper expansion opportunities remain.
- `test:live:*` was not run because sandbox credentials are required.
- Human review of real generated article quality is still needed.
- The active 100/100 goal is not complete.

## 7. CodeRabbit Review

- Review status before this pass: PR #1 open; CodeRabbit SUCCESS and GitHub Actions SUCCESS at head `ea2bfe3`.
- Current pass:
  - Makes theme and keyword AI candidate generation use the first-party information input that was already part of article generation.
- Critical findings:
  - No known open Critical findings at the time of this handoff.
- Resolved / strengthened findings:
  - Added integration and E2E coverage for the new `primaryInfo` theme-candidate path.
- Deferred findings:
  - See `Known Issues`.
- False positives / not applicable:
  - No new false positives identified in this pass.

## 8. Optional Bugbot Findings

- Status: Not run
- Findings: None
- Actions taken: None
- Reason: Cursor Bugbot is optional/backup only. This pass is a narrow prompt/input propagation and regression-test improvement, with CodeRabbit OSS as the standard review path.

## 9. Verification Results

Commands run in this pass:

```bash
npm.cmd run lint
npm.cmd run typecheck
npx.cmd vitest run tests/integration/ai-routes.integration.test.ts
git diff --check
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --grep "theme candidate failure can be retried and then applied"
npm.cmd run quality
git commit -m "Use primary info for theme candidates"
```

Results:

- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npx.cmd vitest run tests/integration/ai-routes.integration.test.ts`: passed, 1 file / 2 tests.
- `git diff --check`: passed.
- `npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --grep "theme candidate failure can be retried and then applied"`: passed, 1 Chromium PC test.
- `npm.cmd run quality`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 43 files.
  - `npm run test`: passed, 39 files / 285 tests.
  - `npm run test:contract`: passed, 3 files / 12 tests.
  - `npm run test:coverage`: passed, statements 87.49%, branches 75.14%, functions 91.63%, lines 87.94%.
  - `npm run test:e2e`: passed, 48 PC Chromium tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- Commit pre-commit hook: passed, `npm run lint` and `npm run test:integrity`.

Not yet recorded in this handoff:

- Final handoff commit hash.
- Push result for this implementation/handoff pair.
- Post-push CodeRabbit OSS and GitHub Actions result for the latest head.

Not run:

- `npm.cmd run test:live:*` because sandbox credentials are required.

## 10. Next Recommended Action

Next Claude Code should:

1. Confirm the latest PR #1 head after this handoff is pushed.
2. Confirm CodeRabbit OSS and GitHub Actions are green on the latest head.
3. Review the narrow `primaryInfo` propagation path:
   - `src/components/aio/article-generator-app.tsx`
   - `src/app/api/theme-candidates/route.ts`
   - `tests/integration/ai-routes.integration.test.ts`
   - `tests/e2e/aio-workflow.spec.ts`
4. Check whether the theme-candidate prompt language is strong enough to reduce commodity content without overfitting or copying the user's first-party text verbatim.
5. If checks stay green and no major review comments appear, continue with another small high-value deferred item or a live/sandbox article-quality proof step.
6. Run `npm.cmd run quality` after any code changes and record the result here.

## 11. Suggested Review Scope for Claude Code

- `/api/theme-candidates` schema and compact payload behavior for `primaryInfo`.
- The OpenAI instruction wording around first-party information:
  - high-priority source
  - original angles
  - field observations
  - no verbatim copying
- E2E assertion that the PC browser form sends `primaryInfo` during the retry/apply flow.
- Whether additional tests are needed for empty `primaryInfo` or very long Japanese input.

## 12. Risk Notes

- This change is intentionally narrow and does not alter DB persistence, OpenAI model wrappers, image generation, WordPress calls, auth, or screen layout.
- It affects AI input quality. The behavior is mocked in automated tests, so real article-quality benefit still requires human review with real OpenAI output.
- The API truncates `primaryInfo` to 1200 characters for theme-candidate generation. This is intended to keep the request compact, but Claude Code may consider whether the limit is appropriate for longer first-party notes.
- Live external-service proof is still missing.

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
