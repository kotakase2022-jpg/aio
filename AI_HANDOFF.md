# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: The previous handoff used `Loop: 3 continuation`; the active 100/100 objective still lacks live sandbox proof and human article-quality review, so this remains a narrow continuation rather than a new loop.
- Phase: Autonomous Improvement / Exact English Title Signal Matching / Handoff
- Last updated: 2026-07-08 07:09 +09:00

## 1. Current Goal

Improve the AIO article generator toward the active 100/100 goal:

- all major functions and PC-browser flows work without bugs or confusing recovery states
- the app feels strong enough for daily article-production work
- generated articles feel specific, source-aware, accessible, and editorial rather than commodity AI content

This Codex pass strengthened title-quality checks. Commodity article output can look input-aware when title matching only catches accidental English substrings. The previous pass expanded generic SEO title detection. This pass makes English title input-signal matching token-aware, so a primary-information term such as `form` is not counted just because a candidate title contains `platform`.

The overall goal is not complete. Live sandbox contract tests for OpenAI/Supabase/WordPress, live WordPress recovery verification, and human review of real generated article quality are still open.

## 2. Current Branch / Commit / PR

- Branch: `codex/persistent-quality-gate-operations`
- Latest implementation commit: `894c666 Require exact English title signal matches`
- Previous pushed status head: `45642d1 Record title template PR checks`
- Last known good local verification: `npm.cmd run quality` passed after `894c666`.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- PR status before this implementation pass at head `45642d1`: CodeRabbit SUCCESS, GitHub Actions `Typecheck, lint, tests, E2E, build` SUCCESS in 3m33s.
- PR status after this handoff/docs update: needs re-check after push.
- CodeRabbit OSS review status: CodeRabbit is installed and responding on PR #1. Old duplicate comments about image recovery / parallel image regeneration still appear in PR review history, but current status check was SUCCESS before this pass; current code and E2E coverage had already addressed those areas in previous Loop 3 work.

## 3. What Was Done

- Read the required workflow files, current handoff, README, package scripts, branch state, recent commits, PR status, and title-quality implementation/tests before editing.
- Confirmed PR #1 was green before this pass at head `45642d1`.
- Inspected `src/lib/title-quality.ts` and `tests/unit/title-quality.test.ts`.
- Changed English title input-signal matching from substring matching to token-boundary matching.
- Added a unit regression test proving `form` in primary information is not treated as reflected when it only appears inside `platform` in title candidates.
- Ran focused tests and the full local `npm.cmd run quality` gate successfully.
- Updated `docs/quality-audit.md` with the latest local evidence and title-quality coverage status.
- Cursor Bugbot was not run; CodeRabbit OSS remains the standard review path, and this pass did not touch auth, DB, credentials, production writes, or other high-risk areas that would justify optional Bugbot use.

## 4. Files Changed

- `src/lib/title-quality.ts`
- `tests/unit/title-quality.test.ts`
- `docs/quality-audit.md`
- `AI_HANDOFF.md`

## 5. Current Status

- Implementation commit `894c666` exists locally and passed the focused title-quality tests plus the full local quality gate.
- This handoff/docs update records the implementation commit and local quality gate.
- The branch is ahead of origin after `894c666` before this handoff/docs update.
- Hosted CodeRabbit and GitHub Actions need to be re-checked after this handoff/docs update is committed and pushed.

## 6. Known Issues

- Remaining low-priority deferred / cleanup items:
  - markdownlint/document formatting items remain
  - broader malformed generated HTML coverage can still be expanded if future review finds real examples outside managed FAQ/source/author blocks
- `test:live:*` was not run because sandbox credentials are required.
- Human review of real generated article quality is still needed.
- The active 100/100 goal is not complete.

## 7. CodeRabbit Review

- Review status before this pass: PR #1 open; CodeRabbit SUCCESS and GitHub Actions SUCCESS at head `45642d1`.
- Current pass:
  - Tightens existing title input-signal matching for English terms.
  - Adds regression coverage without adding a new quality-check ID or UI surface.
- Critical findings:
  - No known open Critical findings at the time of this handoff.
- Resolved / strengthened findings:
  - Strengthened the anti-commodity title-quality layer so accidental English substrings do not make generic title candidates look input-aware.
- Deferred findings:
  - See `Known Issues`.
- False positives / not applicable:
  - Older duplicate CodeRabbit comments about image recovery and image regeneration parallelism remain in PR review history, but the latest status check before this pass was SUCCESS and previous Loop 3 work added `Promise.allSettled`, visible partial-recovery behavior, and E2E coverage.

## 8. Optional Bugbot Findings

- Status: Not run
- Findings: None
- Actions taken: None
- Reason: Cursor Bugbot is optional/backup only. This pass is a narrow title-quality matching/test change, with CodeRabbit OSS as the standard review path.

## 9. Verification Results

Commands run in this pass:

```bash
gh pr checks 1 --repo kotakase2022-jpg/aio
npx.cmd vitest run tests/unit/title-quality.test.ts
git diff --check
npm.cmd run quality
git commit -m "Require exact English title signal matches"
```

Results:

- `gh pr checks 1 --repo kotakase2022-jpg/aio`: passed before this pass at head `45642d1`.
  - CodeRabbit: pass.
  - GitHub Actions `Typecheck, lint, tests, E2E, build`: pass in 3m33s.
- `npx.cmd vitest run tests/unit/title-quality.test.ts`: initially failed because the new fixture still contained a valid `review` theme term, then passed after narrowing the fixture; final result 1 file / 7 tests.
- `git diff --check`: passed.
- `npm.cmd run quality`: passed.
  - `npm run typecheck`: passed.
  - `npm run lint`: passed.
  - `npm run test:integrity`: passed, 46 files.
  - `npm run test`: passed, 42 files / 318 tests.
  - `npm run test:contract`: passed, 3 files / 13 tests.
  - `npm run test:coverage`: passed, statements 88.22%, branches 76.19%, functions 92.14%, lines 88.66%.
  - `npm run test:e2e`: passed, 48 PC Chromium tests.
  - `npm run build`: passed, Next.js 16.2.9 production build.
- Commit pre-commit hook for `894c666`: passed, `npm run lint` and `npm run test:integrity`.

Not run:

- `npm.cmd run test:live:*` because sandbox credentials and explicit non-production confirmation are required.
- Hosted PR checks after this handoff/docs update; re-check after push.

## 10. Next Recommended Action

Next Claude Code should:

1. Confirm this handoff/docs update has been pushed to PR #1.
2. Confirm CodeRabbit OSS and GitHub Actions are green on the latest PR head.
3. Review the updated English title signal matching and make sure it does not block legitimate acronyms or hyphenated tokens:
   - `src/lib/title-quality.ts`
   - `tests/unit/title-quality.test.ts`
4. If checks stay green and no major CodeRabbit comments appear, decide whether the next pass should be live/sandbox readiness or another small regression test around generated-output quality.
5. Run `npm.cmd run quality` after any code changes and record the result here.

## 11. Suggested Review Scope for Claude Code

- Whether token-boundary English matching should treat slash-separated or colon-separated title phrases differently.
- Whether additional commodity patterns should be added only after reviewing real generated OpenAI output, rather than expanding heuristics speculatively.

## 12. Risk Notes

- This change affects quality scoring only through the existing `title-input-signal` check; it does not alter OpenAI calls, persistence, auth, WordPress posting, or production data.
- It could make some generated drafts score lower when title candidates previously relied on accidental English substrings rather than real input terms. That is intentional, but Claude Code should sanity-check the matching against real sample drafts when available.
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
