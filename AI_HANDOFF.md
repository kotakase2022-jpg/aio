# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 9
- Loop number inferred from: 前回Codexからの引継ぎ後、Claude完了の新記録はない。相沢様11/11追加指摘へのフォローアップとしてLoop9を継続。旧作業はdocs/adversarial-verification-2026-11-09.mdとgit履歴に保持。
- Phase: Development / PR and release verification
- Last updated: 2026-11-13 11:23 +09:00

## 1. Current Goal
11/11付の4項目（構成追加、表/補足FAQ選択、制作過程文言、一次情報の限定条件）を局所改修し、protected PR/CI、本番反映、本番確認まで行う。ユーザーが今回の本番反映を明示承認。既存記事変更、顧客WordPress公開、追加課金/権限拡大は禁止。

## 2. Current Branch / Commit / PR
- Branch: `codex/aizawa-nov11-article-options`
- Latest commit at start / baseline: `749301de18e847c6de777f21c11743ec28562ae5`
- Last known good production commit: `e150927d7e5ddc5c82b54d946a9b21db49e8c4c5`
- PR: not created yet; implementation and local quality complete
- CodeRabbit OSS review status: pending new PR
- Production URL: https://aio-article-generator.vercel.app/
- Current production / rollback: `dpl_ByP6QrgAv4ehCXL7ECP54PwfK5mS`, https://aio-article-generator-2ovfy85ge-sl2026.vercel.app (READY confirmed this turn)
- Intended team/project: `sl2026` / `aio-article-generator` / `prj_rIIxUXcj7bOgZMaKxUgHad353Dpf`
- No Supabase migration or gateway change is required.

## 3. What Was Done
- Required documents, source specification, current branch/history and actual production deployment checked fresh.
- Added comparison/problem-solution structures, dedicated structure brief, independent auto/on/none table and supplemental FAQ modes.
- Resolved structure before long-input compaction; persisted the resolved plan for evaluation after restoration/regeneration.
- Main FAQ body is editor-owned Q&A; supplemental FAQ is separate. Main answer wins over duplicate supplemental question; old saved drafts keep legacy behavior.
- Shared final renderer honors none across preview/copy/export/WordPress, preserves table content/links as prose and is idempotent.
- Optional tables/FAQ are not penalized; structure checks have positive and negative cases.
- Private generation warnings and publication checks cover workflow wording and scoped quantities across paragraphs/table rows/answers/summaries/takeaways.
- Synthetic Delta fixture, regression tests, three E2E mode flows, real OpenAI eight-case matrix, separately gated one-disposable-article production smoke added.

## 4. Files Changed
- `src/lib/article-presentation.ts` (new shared plan/format helper)
- types/aio, server/article-form-schema, ai-schemas, article-generation
- draft-html, article-quality, faq-quality, publication-quality, quality-edit-guidance, quality-regeneration-action
- article-generator-app.tsx
- unit/article-presentation, article-generation; integration/drafts, wordpress; E2E/aio-workflow
- fixtures/delta-nov11.ts, live/article-options.live.test.ts
- scripts/production-smoke.mjs, production-article-smoke.mjs
- docs/aizawa-nov11-followup.md, docs/testing.md, this file
- AGENTS.md/CLAUDE.md already match current operating rules; no unnecessary edits.

## 5. Current Status
- Local full quality PASS for final implementation: 575 tests, contract15, E2E59, build19 routes.
- Real OpenAI eight-case matrix PASS; not evidence about all customer inputs.
- Production release and disposable smoke pending. Do not report them completed yet.
- No production writes so far; read-only row counts/fingerprints in the follow-up report.

## 6. Known Issues
- Semantic correctness, all paraphrases, complicated exceptions and medical/financial truth cannot be proved by heuristic checks. Human source review remains required.
- New workflow wording is flagged, not indiscriminately deleted from otherwise valid paragraphs/sources.
- Recreate remains full generation from current inputs, not preservation of hand-edited prose. Save first.
- No live WordPress sandbox; outbound HTML parity tested locally, no real WP post.
- Prior limitations remain: shared demo auth is not per-user isolation; multi-session revision handling is not full collaborative editing; WordPress unknown outcomes need manual reconciliation.
- User-owned untracked `output/` remains untouched.

## 7. CodeRabbit Review
- Review status: pending PR
- Critical findings: not yet reviewed for this change
- Resolved findings: none yet
- Deferred findings: none yet
- False positives / not applicable: none yet

## 8. Optional Bugbot Findings
- Status: Not run
- Optional Bugbot: Not run
- Findings: none
- Actions taken: standard CodeRabbit PR review will be used

## 9. Verification Results
- `npm.cmd run quality`: PASS 2026-11-13. typecheck/lint/integrity61files, 55files/575tests, contract15, coverage S/B/F/L87.54/79.25/92.78/88.27%, Chromium PC E2E59/59, Next16.4.5 build19 routes.
- `npx.cmd vitest run --config vitest.live.config.ts tests/live/article-options.live.test.ts`: 8/8 PASS, gpt-5.5, 307.31s total, ~33-48s/article, image0, no DB/WP writes. Comparison on/on, none/none, auto/auto; FAQ none/none; problem-solution auto/auto; case on/auto; textbook auto/on; BtoC FAQ none/none. Actual output in ignored `.verification-files/nov11-live/`.
- Initial reproductions:14failed/1passed then fixed. Generic-FAQ loss:1failed/22passed then fixed. Long-theme structure loss:1failed/37passed then fixed.
- Intermediate failures: new E2E assumed automatic completed-draft restoration (correct workflow opens the log), missing browser-error collector invocation, old mandatory-FAQ expectation. Corrected with reasons, preserving success/error assertions.
- Old prompt expectations updated for new FAQ-body/optional-supplement specification. No test deletion/skip/threshold relaxation.
- Windows sandbox EPERM on SSR cache rename before execution; permitted local rerun passed.
- `git diff --check`: PASS.
- Production smoke/CI/review: pending, not counted as success.

## 10. Next Recommended Action
1. Commit scoped diff, create PR, obtain CodeRabbit/required CI. No protection bypass or direct main push.
2. Merge, stage production with --prod --skip-domain, verify, promote same build.
3. Read-only production smoke then explicitly gated disposable article generate/edit/save/reload/copy/export. Compare existing DB fingerprints, cleanup only manifest IDs after marker verification.
4. Record actual release timestamp/SHA/deployment/screenshots/errors/cleanup in handoff/report.

## 11. Suggested Review Scope for Claude Code
- Main/supplemental FAQ ownership, canonicalization order, old draft compatibility.
- Mode consistency, table evidence/link preservation.
- Numeric scope per independent surface and noun-anchor matching limitations.
- Structure precedence before truncation / after regeneration instruction removal.
- Production smoke allowlist and marker+ID-scoped cleanup.

## 12. Risk Notes
- Eight real generations are synthetic examples, not commercial-term verification or a guarantee.
- High editorial score does not establish safe publication; human number/condition/source review required.
- Production disposable smoke is separate from default read-only smoke and requires opt-in; preserve manifest on failure for exact-ID recovery.
- No DB/RLS/auth/SSRF/timeout changes. Recorded previous READY deployment is rollback target; no DB rollback needed.

## 13. Do Not Touch
- Secrets/env/token values; user-owned output/; existing production drafts; WP publication; customer messaging.
- No force push, protection bypass, test weakening or silent evidence deletion.

## 14. Notes for Claude Code
- Detail: docs/aizawa-nov11-followup.md. Previous release: docs/adversarial-verification-2026-11-09.md.
- Windows uses npm.cmd/npx.cmd; .verification-files ignored/excluded from deploy.
- Current evidence is November13 runs. Previous 544-test count is historical, not this task.
