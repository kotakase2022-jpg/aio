# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 9
- Loop number inferred from: 前回Codex引継ぎ後にClaude完了の新記録はなく、相沢様11/11追加指摘への対応としてLoop9を継続。
- Phase: Handoff / production verified
- Last updated: 2026-11-13 13:52 +09:00

## 1. Current Goal
11/11付の構成追加、表/補足FAQ選択、制作過程文言、一次情報の限定条件を局所改修し、protected PR/CI、本番反映、本番確認まで実施。今回の本番反映と合成入力による確認はユーザー承認済み。顧客WordPress公開、既存記事の一括変更、追加課金/権限拡大は禁止。

## 2. Current Branch / Commit / PR
- Branch: `codex/aizawa-nov11-release-record` (documentation-only)
- Latest runtime commit / last known verified production: `324b880ab2bfc7fbab9c2352319352764b447814`
- Baseline main: `749301de18e847c6de777f21c11743ec28562ae5`; baseline runtime: `e150927d7e5ddc5c82b54d946a9b21db49e8c4c5`.
- Runtime PRs: https://github.com/kotakase2022-jpg/aio/pull/44 through /48, all merged after required CI without bypass/direct main push.
- Production: https://aio-article-generator.vercel.app/
- Final release: **2026-11-13 13:05:31 JST**, `dpl_9aoGSRfatAYc1MqScMyPTgPecVAU`, https://aio-article-generator-rh8577ut7-sl2026.vercel.app , READY. Canonical alias/releaseCommit verified after promotion.
- Team/project: `sl2026` / `aio-article-generator` / `prj_rIIxUXcj7bOgZMaKxUgHad353Dpf`.
- Original rollback: `dpl_ByP6QrgAv4ehCXL7ECP54PwfK5mS`, https://aio-article-generator-2ovfy85ge-sl2026.vercel.app . No DB migration/schema rollback needed.
- Documentation-only commits after this runtime SHA do not require redeployment.

## 3. What Was Done
- Added comparison/problem-solution structures, structure brief, independent auto/on/none table/supplemental FAQ modes. Resolve structure before compaction and persist the resolved plan.
- Main Q&A remains editor-owned. Supplemental FAQ is separate; preserve matching/unmatched body answers when none. Legacy drafts retain compatibility.
- Shared preview/copy/export/WordPress renderer honors none, preserves table content/caption/links as prose, and is idempotent.
- Optional absence is not penalized. Structure checks have positive/negative cases. Case generation follows one explicitly hypothetical scenario across the whole article.
- Workflow wording and scoped quantities are checked across body/table rows/answers/summaries/takeaways; private warnings remain visible to editors.
- Invalid generated source identifiers move to private warnings. Only exact content-free manual-text acquisition phrases may be removed; descriptive/mixed factual notes remain and are flagged, not silently deleted.
- Fixed production false missing-link alarms for manual/file evidence; real missing/broken links and numeric evidence checks remain enforced.
- Fixed existing save400 after DB restoration without competitor research: DB null becomes undefined; legacy null is accepted as absence at the input boundary, while string/array/boolean are still rejected.
- Added synthetic Delta/live matrix, unit/integration/E2E regressions and gated production verification.

## 4. Files Changed
- `src/lib/article-presentation.ts`, article/FAQ/publication quality, draft HTML/schema, edit/regeneration guidance.
- Server article generation/form/AI schemas, `drafts.ts`, types/aio, article-generator-app.tsx.
- Unit presentation/generation/publication tests; integration draft/Supabase/WordPress tests; E2E workflow.
- `tests/fixtures/delta-nov11.ts`, `tests/live/article-options.live.test.ts`, production smoke scripts.
- `docs/aizawa-nov11-followup.md`, `docs/testing.md`, this file.
- AGENTS.md/CLAUDE.md operating rules remain appropriate; no unnecessary edits.

## 5. Current Status
- Final local quality and required CI PASS; all runtime PRs merged and production deployed.
- Final production read-only smoke PASS. The second real generated article subsequently passed edit/save/reload/preview/copy/export after deterministic fixes: publication issues0, save warnings0, browser errors0.
- No real WordPress post. Existing five-table fingerprints match baseline, excluding only our two synthetic articles.
- **Cleanup pending:** Supabase deletion confirmation did not complete (earlier expired, final attempt aborted). Read-only query confirmed both own jobs/drafts remain. Do not bypass confirmation using another credential/tool.

## 6. Known Issues
- Semantic correctness, complex conditions/paraphrases, and financial/medical truth require human source review regardless of score.
- Production example still has editorial warnings (word count above target, repetition; test marker affects a meta keyword check). Zero publication issues does not mean perfect editorial quality. No score was inflated.
- Recreate remains full generation from current inputs, not hand-edited text preservation. Save first.
- No live WordPress post or new live image generation this task; outbound HTML tested in integration, existing image flows in E2E.
- Existing limits: shared demo auth is not per-user isolation; no full collaborative editing; ambiguous WordPress outcomes require reconciliation.
- GitHub reports one moderate development-dependency advisory; production-only audit returned0 this turn. Older Actions runtime warnings remain. No unrelated dependency/CI refactor.
- Final Vercel error-log scan found no entries; monitoring/drains/long-term behavior were not audited.

## 7. CodeRabbit Review
- PR44/46 received actual CodeRabbit reviews. Received substantive findings were fixed and threads resolved: negated structures, caption/row evidence, Q&A ownership, auxiliary FAQ exclusion, private warnings, matching Q&A retention, mixed/same-sentence fact preservation.
- PR47/48 reached the OSS allowance, status NEUTRAL: **no fresh CodeRabbit review**, not a successful review. Claude should independently review these small boundary fixes.
- No received substantive finding left unresolved; no false-positive dismissal claimed.
- Existing GitHub Codex auto review also ran; PR47/48 completed with no findings. This is separate from CodeRabbit.

## 8. Optional Bugbot Findings
- Status: Not run
- Optional Bugbot: Not run
- Findings/actions: none; no paid review/allowance expansion.

## 9. Verification Results
- `npm.cmd run quality`: **PASS 2026-11-13 12:58-13:00 JST**, after final runtime changes. Typecheck/lint/integrity61files, 55files/**598 tests**, contract15 rerun, coverage S/B/F/L **87.75/79.44/92.85/88.40%**, Chromium PC **59/59 E2E**, Next16.4.5 build19 routes.
- Null-research regression:2failed/18passed before fix,20/20 after. Manual provenance regression:2failed/27passed before fix,119 related tests after; three mode E2Es assert no false warning after restoration.
- Real OpenAI matrix: **8/8 PASS**, gpt-5.5,280.04s,30.21-39.43s/article, images0, no DB/WP writes. Earlier8/8 then7/8 case failure retained; prompt corrected without weakening criteria.
- Matrix preceded final source/null-boundary fixes. Final artifact replay/schema verification **12/12 PASS**, not additional live calls: `npx.cmd vitest run --config .verification-files/nov11-replay.config.ts`.
- Real production jobs completed in71s and82s. First strict smoke failed on source metadata; second failed on provenance false alarm, then save400. Failures retained, not counted as successes.
- Final same-article continuation: `AIO_SMOKE_WRITE_CONFIRM=resume-own-disposable-article node .verification-files/resume-production-article.mjs`, **13:05:35-13:06:01 JST PASS**, no new generation. Save200/warnings[], restored edits/modes, no table/supplemental FAQ, preview=clipboard=downloaded body HTML, browser errors0.
- `node scripts/production-smoke.mjs`: final PASS; auth/API401/login/logs/controls/required inputs, mutations blocked except login.
- Protected stage login200/logs401 before promotion; team/project/SHA verified. Final runtime CI **43362566563 PASS3m49s** (PR48), PR47 CI43361636735 PASS3m28s; previous runtime PR CI also passed.
- `git diff --check`: PASS. `npm audit --omit=dev`:0 earlier this turn, not an all-dependency guarantee. Final deployment error-level logs/15min: no entries.
- Reproduction history and changed old-expectation reasons: release report/PR history. No test deletion, skip or threshold relaxation.

## 10. Next Recommended Action
1. Read `docs/aizawa-nov11-followup.md`, review PR44-48, especially Q&A ownership, mixed notes, manual provenance and null roundtrip.
2. Do not redeploy/regenerate merely for documentation. The production runtime SHA above is verified.
3. After completed deletion confirmation, clean up only the two exact own pairs below after marker/status/no-image/no-WP checks. Otherwise leave intact.
4. Human review of actual Delta/PayStruct conditions remains necessary before customer publication. No message sent to Aizawa.

## 11. Suggested Review Scope for Claude Code
- FAQ canonicalization/edited answers, lossless table conversion, per-surface numeric scope and semantic limits.
- Keep factual mixed notes while flagging internal prose; do not broaden automatic deletion.
- Null optional research compatibility without relaxing malformed input validation.
- Exact-ID smoke/cleanup allowlists; distinguish real API calls from replay/mock tests.

## 12. Risk Notes
- Pending own records, Supabase `npdyfhqugniuxfxpgngh`:
  - marker `AIO-RELEASE-SMOKE-08c3240b-9b01-40c6-a6ca-ad75ab7f0106`; job `454104b7-aacb-4d21-bb69-e502370c038d`; draft `62f62b95-057a-4f6a-9a5b-b523a6069e8e` (first failed verification).
  - marker `AIO-RELEASE-SMOKE-ab7832f3-8e5a-4418-bda5-95c825bf61c0`; job `4f8e7082-32c6-4b94-8664-f9b904a86173`; draft `675536f8-b7dd-44b8-8ba7-6f8b5c211d72` (final successful edit/save/export).
- Both are unpublished, image0. Deletion was not executed; recheck before any future action.
- Input/draft/image/WP-post/WP-connection fingerprints excluding only these IDs matched baseline after final save. Exact counts/hashes in release report.
- No migration/gateway/RLS/auth/SSRF change. Original rollback retained.

## 13. Do Not Touch
- Secrets/env/token values; user-owned untracked `output/`; existing production articles; WP publication; customer messaging.
- No force push, protection bypass, weakened tests, silent evidence deletion, or cleanup-confirmation bypass.

## 14. Notes for Claude Code
- Previous release evidence: `docs/adversarial-verification-2026-11-09.md` and git history.
- Windows uses npm.cmd/npx.cmd. Ignored/deploy-excluded `.verification-files/` holds synthetic outputs, screenshots, manifests, replay/resume scripts. Do not upload sessions/env files.
- Final counts are current November13 runs, not historical counts.
