# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 9
- Loop number inferred from: 前回Codexからの引継ぎ後、Claude完了の新記録はない。相沢様11/11追加指摘へのフォローアップとしてLoop9を継続。旧作業はdocs/adversarial-verification-2026-11-09.mdとgit履歴に保持。
- Phase: Development / PR and release verification
- Last updated: 2026-11-13 11:38 +09:00

## 1. Current Goal
11/11付の4項目（構成追加、表/補足FAQ選択、制作過程文言、一次情報の限定条件）を局所改修し、protected PR/CI、本番反映、本番確認まで行う。ユーザーが今回の本番反映を明示承認。既存記事変更、顧客WordPress公開、追加課金/権限拡大は禁止。

## 2. Current Branch / Commit / PR
- Branch: `codex/aizawa-internal-source-metadata`
- Latest commit at start / baseline: `749301de18e847c6de777f21c11743ec28562ae5`
- Last known good production commit: `e150927d7e5ddc5c82b54d946a9b21db49e8c4c5`
- PR: https://github.com/kotakase2022-jpg/aio/pull/44
- CodeRabbit OSS review status: dc45267 reviewed, 7 findings fixed with reproduction tests; follow-up review is subject to OSS hourly allowance (no paid review requested).
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
- Local full quality PASS after review/case fixes: 583 tests, contract15, E2E59, build19 routes.
- Real OpenAI initial matrix PASS; subsequent rerun 7/8, case structure failed. Case prompt corrected without loosening evaluation; final matrix 8/8 PASS in 280.04s.
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
- Review status: CodeRabbit dc45267 completed (9m30s). GitHub既存Codex自動レビューの2指摘はCodeRabbitの表関連指摘と重複。
- Critical findings: no security/permission issue identified.
- Resolved findings: 7件すべて実装対応。否定構成指定、caption条件/出典保持、新FAQ型の本文必須、補足FAQを比較軸から除外、編集済みQ&A保持、表セル内段落の文脈維持、モデル固有注意の非公開表示保持。
- Deferred findings: none. Follow-up automatic review may be unavailable because the one included hourly review was consumed; no billing/plan change.
- False positives / not applicable: none. All 9 threads replied/resolved at a8a31b4. Incremental CodeRabbit status NEUTRAL due allowance, not a successful new review.

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
- Review fixes full `npm.cmd run quality`: PASS, 582 tests / contract15 / E2E59 / build19; coverage S/B/F/L87.63/79.38/92.80/88.30%.
- Review reproductions: table2 failed/23passed, editor-Q&A2 failed/25passed, remaining3 failed/65passed; all fixed. Additional targeted suites158/158 PASS.
- Live rerun271.32s:7/8 PASS, case-type generated a normal comparison with a short late example. Preserved failure in ignored .verification-files/nov11-case-before-fix.json. Strengthened case plan to follow one explicitly hypothetical scenario across the whole article; no structure-test relaxation. Added prompt regression (red then green). Full quality after this change:583 tests/E2E59/build19 PASS, coverage unchanged87.63/79.38/92.80/88.30%.
- PR second CI run43353618949 PASS at a8a31b4. Final case-only prompt commit requires its own CI before release.
- PR initial CI run43351995407: PASS (4m14s). `npm audit --omit=dev`: PASS, 0 vulnerabilities. Local production-build Chrome screenshot checked (1440x1000).
- Final prompt CI43354358059 PASS at1d59a44. Merge blocked by newly arrived review: converted table-cell paragraphs split scope. Also rechecked CodeRabbit follow-up about non-FAQ none losing unmatched editor Q&A. Both reproduced (2failed/30passed), then fixed (98/98 targeted). Test fixture had an invalid top-level sources field, caught by typecheck and removed; full quality restarted with585 tests. Release still waits for final CI.
- Production smoke/CI/review: pending, not counted as success.
- Latest full quality after final review fixes: PASS (585 tests, contract15, E2E59, build19). Coverage S/B/F/L87.65/79.34/92.82/88.31%. Final live matrix8/8PASS in280.04s; 30.21-39.43s/article. No model instruction changes after that run, only covered HTML preservation fixes.
- PR44 CI43355420330 PASS (4m15s), merged as dd5707dd1f07d80afec1ff331017642e53ca2421. Follow-up CodeRabbit comment arrived at merge: supplemental none + matching leftover faqItems still drops body answer. Reproduced1failed/32passed; retain unmanaged Q&A entirely when none. Separate follow-up PR required before production. No production release yet.
- PR45 CI43356154031 PASS, merged c56a5f9. Full quality586/contract15/E2E59/build19 PASS. Final renderer replay of8 live artifacts9/9PASS. c56a5f9 promoted12:08 JST to dpl_CytsVri8oEtVPRW8qC1oUZ6pAs6q, read-only production smoke PASS.
- Production disposable generation completed but smoke correctly FAILED on missing source link manual-text. Model invented a non-URL source placeholder and acquisition-only note. Own job454104b7-aacb-4d21-bb69-e502370c038d / draft62f62b95-057a-4f6a-9a5b-b523a6069e8e remain for exact-ID cleanup. Marker AIO-RELEASE-SMOKE-08c3240b-9b01-40c6-a6ca-ad75ab7f0106. No customer data changed. Added red/green regression1failed/39passed then139 related PASS; move invalid source metadata and this exact acquisition-only paragraph to private warnings, retain real citations/ordinary prose. Follow-up PR/full quality pending; do not report all production checks passed yet.

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
