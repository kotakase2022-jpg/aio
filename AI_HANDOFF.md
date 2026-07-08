# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: The previous handoff kept Loop 3 continuation for the long-running reliability and 100/100 improvement objective. This pass resumed that same Codex phase after the OpenAI quota was restored.
- Phase: Live OpenAI Verification / Generated Article Quality Fix / Handoff
- Last updated: 2026-07-08 12:24 +09:00

## 1. Current Goal

Current objective:

- Move the AIO article generator closer to 100/100 for functional reliability, PC browser flows, daily-use UX, and non-commodity generated article quality.
- This Codex pass focused on the live OpenAI failure after quota recovery. The real OpenAI live test now passes on the current working tree.
- The pass also fixed concrete causes found by the live test: model self-score scale drift, missing managed body structure, missing visible source URLs, and quality-scoring false positives around FAQ/source helper blocks.
- Overall goal is still not complete. Supabase write/delete live tests remain blocked because the configured project was previously verified as production-labeled, and a disposable non-production Supabase sandbox has not been provided.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest implementation commit: `6a4d7f0 Stabilize live OpenAI article quality`
- Latest implementation commit before this pass: `712cdc4 Detect English conclusion boilerplate`
- Last known good checked commit: `6a4d7f0`
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- CodeRabbit OSS review status: Passed on PR #1 at head `6a4d7f0`.
- GitHub Actions status: `Typecheck, lint, tests, E2E, build` passed on PR #1 at head `6a4d7f0` in 3m39s.

## 3. What Was Done

Completed in this Codex pass:

- Re-read required workflow files and current handoff state.
- Confirmed the user restored OpenAI quota and reran live OpenAI verification.
- Fixed OpenAI live generated-article quality failures by:
  - Prompting the model to return `aio_score_self_evaluation.score` on a 0-100 scale, not a 0-10 scale.
  - Normalizing self-evaluation scores such as `8.6` to `86`.
  - Keeping deterministic local quality checks as the final score cap.
  - Asking the model to include list and FAQ content inside `body_html` itself.
  - Adding managed fallback blocks for missing key takeaways and FAQ content when the model omits them from `body_html`.
  - Adding a managed source block when known source URLs are missing from generated body HTML.
  - Restricting generated source-link fallbacks to safe `http:` and `https:` URLs.
  - Treating managed FAQ/source/author helper headings as auxiliary during quality scoring.
  - Splitting HTML block boundaries and English punctuation during sentence-length checks so table/list text is not falsely treated as one long sentence.
- Strengthened unit coverage for the above behaviors.
- Updated live OpenAI sandbox fixtures to a more realistic 2,000-character article scale and richer first-party/source context.
- Re-ran the real OpenAI live sandbox test twice after quota recovery; the final run passed on the current code.
- Re-ran the full local quality gate; it passed.

## 4. Files Changed

Main files changed in this pass:

- `src/lib/article-quality.ts`
- `src/lib/server/article-generation.ts`
- `tests/live/openai.live.test.ts`
- `tests/unit/article-generation.test.ts`
- `tests/unit/article-quality.test.ts`
- `AI_HANDOFF.md`

## 5. Current Status

- Local implementation state is green:
  - focused article-generation/article-quality unit tests pass
  - lint passes
  - typecheck passes
  - test integrity passes
  - full `npm.cmd run test` passes
  - full `npm.cmd run quality` passes
  - live OpenAI sandbox test passes
- Supabase live write/delete testing remains intentionally not run against the current production-labeled project.
- The current implementation commit is pushed and green on PR #1.
- If a later handoff-only commit follows this file update, re-check PR #1 at that newer head. Runtime code changed last in `6a4d7f0`.

## 6. Known Issues

- Supabase `test:live:supabase` is still blocked until a disposable non-production project is configured with the app schema and explicit live-write flags.
- WordPress live posting was not run in this pass.
- Real generated article quality still needs human review on representative customer inputs even though the live sandbox contract now passes.
- The live OpenAI test incurs provider cost and takes roughly 3 minutes for the current fixture set.
- Do not mark the active 100/100 goal complete yet.

## 7. CodeRabbit Review

CodeRabbit OSS review status:

- Review status: CodeRabbit passed on PR #1 at head `6a4d7f0`.
- Critical findings: none known for this pass.
- Resolved findings: none in this pass.
- Deferred findings: none in this pass.
- False positives / not applicable: none.
- Next step: if this handoff update is committed as a status-only commit, re-check PR #1 on the new head.

## 8. Optional Bugbot Findings

Cursor Bugbot optional review:

- Status: Not run.
- Findings: none.
- Actions taken: none.
- Reason: Cursor Bugbot is optional/backup only. This pass did not alter auth, credentials, destructive DB writes, payment, or production deployment behavior.

## 9. Verification Results

Commands run during this pass:

```bash
npx.cmd vitest run tests/unit/article-generation.test.ts tests/unit/article-quality.test.ts
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:integrity
npm.cmd run test
npm.cmd run build
git diff --check
npm.cmd run quality
$env:AIO_LIVE_CONTRACT_TESTS='1'; npm.cmd run test:live:openai
git commit -m "Stabilize live OpenAI article quality"
git push
gh pr checks 1 --repo kotakase2022-jpg/aio --watch --interval 15
```

Results:

- Focused Vitest command: passed, 2 files / 100 tests after final safety test addition.
- `npm.cmd run lint`: passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:integrity`: passed, 47 files.
- `npm.cmd run test`: passed, 43 files / 333 tests.
- `npm.cmd run build`: passed, Next.js 16.2.9 production build.
- `git diff --check`: passed.
- `npm.cmd run quality`: passed.
  - typecheck passed
  - lint passed
  - test integrity passed
  - unit/integration tests passed, 43 files / 333 tests
  - contract tests passed, 3 files / 13 tests
  - coverage passed: statements 88.4%, branches 76.48%, functions 92.37%, lines 88.83%
  - E2E passed, 49 Chromium PC tests
  - build passed
- Final live OpenAI command: passed.
  - Readiness: `openai: ready`
  - Live test: 1 file / 1 test passed
  - Duration: about 183 seconds
- Implementation commit `6a4d7f0`: created and pushed.
- Pre-commit hook for `6a4d7f0`: passed.
  - lint passed
  - test integrity passed
- Pre-push hook for `6a4d7f0`: passed.
  - lint passed
  - typecheck passed
  - test integrity passed
  - test passed, 43 files / 333 tests
  - contract tests passed, 3 files / 13 tests
- PR #1 checks at `6a4d7f0`: passed.
  - CodeRabbit passed.
  - GitHub Actions `Typecheck, lint, tests, E2E, build` passed in 3m39s.

Not run:

- `npm.cmd run test:live:supabase`: intentionally not run. The configured Supabase project was previously verified in Chrome as production-labeled, and the live readiness guard had failed closed.
- `npm.cmd run test:live:wordpress`: not requested in this pass.

## 10. Next Recommended Action

Next Claude Code should:

1. Review the generated article quality changes, especially:
   - managed FAQ/key-takeaway/source fallback HTML
   - source URL safety filtering
   - article-quality auxiliary heading filtering
   - sentence boundary handling for English and HTML block boundaries
2. Confirm the new live OpenAI fixture scale and assertions are appropriate for sandbox cost and runtime.
3. Re-check PR #1 only if this handoff status update is pushed as a new head after `6a4d7f0`.
4. Keep Supabase live write/delete tests blocked unless a non-production Supabase project is configured and explicitly confirmed.
5. If all checks remain green, move next toward human review of representative generated articles or a staging-only Supabase contract test setup.

## 11. Suggested Review Scope for Claude Code

- `src/lib/server/article-generation.ts`: verify fallback HTML remains safe and does not bypass sanitizer in unsafe ways.
- `src/lib/article-quality.ts`: verify auxiliary headings are not over-filtering legitimate question-style article sections.
- `tests/live/openai.live.test.ts`: verify the live sample count, 2,000-character target, and minimum AIO score remain cost-conscious but meaningful.
- `tests/unit/article-generation.test.ts` and `tests/unit/article-quality.test.ts`: verify the tests assert behavior rather than merely encoding implementation details.

## 12. Risk Notes

- The source fallback appends sanitized text and escaped attributes, and now only links `http:` / `https:` URLs.
- `isQuestionLikeAuxiliaryHeading` may filter genuine question-style H2/H3 headings from the thin-section check. This was intentional for FAQ-like generated headings, but Claude Code should review whether the heuristic is too broad.
- The OpenAI live test passed, but provider/model behavior can drift. Keep the deterministic local quality cap.
- Supabase production data must not be touched by live tests.

## 13. Do Not Touch

- `.env*`, OpenAI/Supabase/WordPress/Vercel credentials, and production data.
- `.claude/` unless the user explicitly asks.
- Quality gate, test integrity, and CodeRabbit operating docs should not be weakened.
- Avoid unrelated UI rewrites, screen-transition changes, broad refactors, production deploys, production DB/API writes, `git push --force`, or `git reset --hard`.

## 14. Notes for Claude Code

- Use `npm.cmd` / `npx.cmd` on Windows PowerShell.
- CodeRabbit OSS is the standard PR reviewer. Cursor Bugbot is optional/backup only.
- The current live OpenAI pass is the first successful live OpenAI proof after the provider quota recovery.
- Keep Loop 3 continuation unless you decide the next work should become a new Loop 4.
- Do not call `update_goal complete`; the 100/100 objective is not fully proven yet.
