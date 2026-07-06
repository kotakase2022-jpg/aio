# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: Previous handoff showed Claude Code returning Loop 3 continuation to Codex. This pass is the Codex development/fix phase after that review.
- Phase: Development / Reliability Fix / Handoff
- Last updated: 2026-07-06 15:49 +09:00

## 1. Current Goal
Move the AIO article generator closer to 100/100 for:

- Functional reliability and PC browser screen transitions.
- Daily-use UX value as an article production tool.
- Non-commodity article quality.

Keep changes small and CodeRabbit-reviewable. CodeRabbit OSS is the standard PR reviewer. Cursor Bugbot is optional backup only.

## 2. Current Branch / Commit / PR
- Branch: codex/persistent-quality-gate-operations
- Latest local commit before this handoff update: 657ebf6 `Keep edited FAQ answers in draft HTML`
- Last known good commit: 657ebf6 before this local fix; local `npm.cmd run quality` passes after this fix.
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- CodeRabbit OSS review status: Installed and responding on PR #1. CodeRabbit read `.coderabbit.yaml`, posted walkthrough/configuration output, and accepted `@coderabbitai review`. No CodeRabbit inline findings were visible in the latest public PR data checked during this pass.

## 3. What Was Done
This Codex pass continued closing unresolved review items from Claude Code's previous handoff:

- Reviewed the required handoff and project files.
- Confirmed CodeRabbit OSS is configured through `.coderabbit.yaml` and responding on PR #1.
- Previously fixed and pushed the WordPress post approval gate so `/api/wordpress/post` no longer trusts a client-provided `draft.status`.
- Fixed FAQ rendering for edited drafts: a FAQ question already present in body HTML no longer suppresses an edited FAQ answer that is missing from the final publishable HTML.
- `appendFaqBlockWhenNeeded` now treats a FAQ item as already represented only when its visible question and visible answer are both present in the body.
- Added regression coverage for the case where the old generated answer remains in the body but the reviewer-approved FAQ answer must still be rendered.
- Fixed initial image-generation all-failure recovery: drafts with zero generated images but saved `aiResult.image_prompts` now show a recovery notice and enable `画像のみ再作成`.
- Image regeneration now covers both existing generated images and missing prompt slots, inserts recovered images into the article body, and keeps image ordering stable.
- Server-side image failures now carry slot, prompt, alt text, and error details to the generation job runner.
- The generation step detail now names failed slots/reasons and tells the user that saved image prompts can be retried from `画像のみ再作成`.

## 4. Files Changed
- `src/app/api/wordpress/post/route.ts`
- `tests/integration/wordpress-post-route.integration.test.ts`
- `src/lib/draft-html.ts`
- `tests/unit/draft-html.test.ts`
- `src/components/aio/article-generator-app.tsx`
- `src/lib/server/article-generation-job-runner.ts`
- `src/lib/server/article-images.ts`
- `tests/unit/article-images.test.ts`
- `tests/integration/generation-job-runner.integration.test.ts`
- `tests/e2e/aio-workflow.spec.ts`
- `AI_HANDOFF.md`

No AGENTS/CLAUDE operating-rule changes were needed; both already describe CodeRabbit as standard and Cursor Bugbot as optional backup.

## 5. Current Status
- Local quality gate passes after the WordPress approval, edited-FAQ rendering, and missing-image recovery fixes.
- Working tree also contains untracked `.claude/` from user/Claude context; it was not modified or staged.
- No production deploy, production DB/API writes, secret output, force push, reset, or destructive command was performed.
- GitHub CLI auth token is invalid locally, but public PR data was still readable enough to confirm CodeRabbit PR comments.

## 6. Known Issues
- Live OpenAI/Supabase/WordPress sandbox verification remains unproven.
- Latest hosted GitHub Actions after this local commit must be checked after push.
- Remaining open review items from the previous handoff:
  - `src/lib/article-quality.ts`: small English regex boundary improvements remain optional.
- The broader 100/100 target still needs continued manual/live validation and iterative UX/content-quality improvements.

## 7. CodeRabbit Review
CodeRabbit OSS findings and response status:

- Review status: Installed and responding on PR #1. `.coderabbit.yaml` is present and was acknowledged by CodeRabbit.
- Critical findings: None from CodeRabbit inline comments in the latest public PR data checked.
- Resolved findings: The WordPress approval-gate issue, edited-FAQ answer omission, and all-image-generation-failure recovery issue were from the prior handoff/Codex review queue, not CodeRabbit inline findings; all are now fixed with regression tests.
- Deferred findings: Remaining non-CodeRabbit review items listed in Known Issues.
- False positives / not applicable: None recorded in this pass.

## 8. Optional Bugbot Findings
Cursor Bugbot optional check:

- Status: Not run.
- Findings: No new Bugbot run in this pass.
- Actions taken: None. Bugbot remains optional/backup because CodeRabbit is the standard reviewer.

## 9. Verification Results
Commands executed and results:

```bash
npx.cmd vitest run tests/integration/wordpress-post-route.integration.test.ts
npx.cmd vitest run tests/unit/draft-html.test.ts
npx.cmd vitest run tests/unit/article-images.test.ts tests/integration/generation-job-runner.integration.test.ts
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts -g "drafts with failed initial image generation can regenerate from saved prompts"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run quality
```

Results:

- Targeted Vitest: passed, 1 file / 3 tests.
- Targeted draft HTML Vitest: passed, 1 file / 26 tests.
- Targeted image Vitest: passed, 2 files / 8 tests.
- Targeted Playwright E2E: the test itself passed, but direct `npx.cmd playwright` did not exit before the shell timeout. The same E2E was verified through `npm.cmd run quality`.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run quality`: passed.
  - `test:integrity`: passed, 40 files.
  - `test`: passed, 36 files / 230 tests.
  - `test:contract`: passed, 3 files / 9 tests.
  - `test:coverage`: passed, statements 84.78%, branches 70.98%, functions 91.08%, lines 85.19%.
  - `test:e2e`: passed, 46 Chromium PC tests.
  - `build`: passed with Next.js 16.2.9.

Note: `npx` was blocked by local PowerShell execution policy; use `npx.cmd` on this machine.

## 10. Next Recommended Action
Claude Code should first review the three recently fixed behaviors:

- Confirm that using the persisted draft as the posting source matches the intended product behavior.
- Confirm missing persisted drafts should return 404.
- Confirm unapproved persisted drafts should return 409 and never call WordPress.
- Confirm the edited FAQ answer behavior: when a question already exists in the body but its approved answer differs, the final article HTML should keep the edited answer visible even if this means appending a managed FAQ block.
- Confirm the image recovery behavior: when initial image generation produces zero images but image prompts remain, the preview should show recovery guidance, `画像のみ再作成` should be enabled, regenerated images should be inserted into the draft body, and the server job detail should preserve failed slot context.

After that, address the next review item one at a time:

1. Optional `article-quality.ts` English regex boundary tests/fixes.
2. Re-check CodeRabbit after the latest push and address any new Critical/High findings.

## 11. Suggested Review Scope for Claude Code
- `src/app/api/wordpress/post/route.ts`
- `tests/integration/wordpress-post-route.integration.test.ts`
- `src/lib/draft-html.ts`
- `tests/unit/draft-html.test.ts`
- `src/components/aio/article-generator-app.tsx`
- `src/lib/server/article-generation-job-runner.ts`
- `src/lib/server/article-images.ts`
- `tests/unit/article-images.test.ts`
- `tests/integration/generation-job-runner.integration.test.ts`
- `tests/e2e/aio-workflow.spec.ts`
- Any UI flow that might assume unsaved client-only edits can be posted directly; the intended flow should require save/approval first.
- Copy/export/final publish HTML behavior for edited FAQ answers.
- Missing initial generated images and `画像のみ再作成` recovery flow.
- CodeRabbit PR #1 comments after this commit is pushed.

## 12. Risk Notes
- This fix intentionally favors persisted draft state over client-provided payload state for approval/security.
- If the product wants to allow posting unsaved local edits, that should be implemented as an explicit save-and-approve step before posting, not by trusting the request body.
- The FAQ fix intentionally prefers preserving reviewer-approved edited answers over suppressing duplicate questions. This preserves editorial intent in final output.
- The image recovery fix intentionally uses saved image prompts as the recovery source when no generated image exists. This avoids treating an otherwise usable draft as unrecoverable after transient image API failures.
- No secrets were read aloud or committed.
- No production services were modified.

## 13. Do Not Touch
- `.env*`, production Supabase, WordPress, OpenAI, or Vercel credentials/data.
- `.claude/settings.local.json` unless the user explicitly asks.
- Quality gates, test integrity checks, or unrelated UI redesign.
- Existing screen transitions unless tied to a verified bug.

## 14. Notes for Claude Code
- This pass fixed one high-priority reliability/security-style issue, one output-fidelity issue that could hide reviewer edits, and one image-generation recovery gap.
- Existing user-facing Japanese approval error copy for unapproved drafts was preserved.
- CodeRabbit is the standard reviewer; Cursor Bugbot should remain optional unless high-risk uncertainty remains.
- Re-run the quality gate after any follow-up changes.
