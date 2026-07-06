# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: 直近handoffはLoop 3 continuationのCodexフェーズだった。今回も同一PR上で残課題を1件進めたため、Loop 3 continuationのCodex自律改善として継続し、次はClaude Codeレビューへ戻す。
- Phase: Autonomous Improvement / Article Quality / Handoff
- Last updated: 2026-07-06 18:22 +09:00

## 1. Current Goal
今回の目的：

AIO記事生成アプリを、機能信頼性・PCブラウザ画面遷移・日常利用UX・非commodity品質の観点で100/100へ近づける。今回のCodexフェーズは、AI生成記事が冒頭で「近年」「本記事では」「重要です」型の汎用導入に寄りすぎるケースを品質診断で検出し、再生成・編集ガイダンスへつなげること。

Goal全体は未完了。残指摘、sandbox契約テストの実環境実行、実生成品質検証、ライブ連携確認は継続課題。

## 2. Current Branch / Commit / PR
- Branch: codex/persistent-quality-gate-operations
- Latest implementation commit: 3728dcc `Flag generic opening phrase density`
- Previous implementation commit: 5ff08f0 `Tighten live sandbox host readiness`
- Last known good commit: 3728dcc `Flag generic opening phrase density`
- Last known good verification: `npm.cmd run quality` 成功（§9）。
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- CodeRabbit OSS review status: PR #1 はopen。今回の実装コミットpush後にCodeRabbit再レビュー対象。
- Current local status before final push: `AI_HANDOFF.md` のみ未コミット予定。`.claude/` は未追跡のまま触っていない。

## 3. What Was Done
今回完了したこと：

- 必読ファイル（`AGENTS.md`、`CLAUDE.md`、`AI_HANDOFF.md`、`README.md`、`package.json`）と添付リクエストを確認。
- 直近PR #1がopenであること、ブランチが `codex/persistent-quality-gate-operations` であることを確認。
- 既存の `evaluateArticleQuality` は本文全体の汎用表現数とテンプレ冒頭フレームを検出していたが、冒頭420字に汎用表現が集中するケースを個別に評価していなかった。
- `src/lib/article-quality.ts` に `generic-opening-density` チェックを追加。
  - 冒頭420字内の汎用表現が2件以上ならfail。
  - スコアにも軽い追加ペナルティを反映。
- `src/lib/quality-regeneration-action.ts` に、冒頭汎用句を一次情報・参照情報・現場条件へ置き換える再生成指示を追加。
- `src/components/aio/article-generator-app.tsx` に、編集画面の具体的な修正ガイダンスを追加。
- `tests/unit/article-quality.test.ts` に、本文後半は具体的でも冒頭だけ汎用導入に寄るケースの回帰テストを追加。
- `tests/unit/quality-regeneration-action-coverage.test.ts` と `tests/unit/quality-edit-guidance.test.ts` に、新チェックIDのアクション/編集ガイダンス網羅テストを追加。
- 実装修正を `3728dcc Flag generic opening phrase density` としてコミット。

## 4. Files Changed
主な変更ファイル：

- `src/lib/article-quality.ts`
- `src/lib/quality-regeneration-action.ts`
- `src/components/aio/article-generator-app.tsx`
- `tests/unit/article-quality.test.ts`
- `tests/unit/quality-regeneration-action-coverage.test.ts`
- `tests/unit/quality-edit-guidance.test.ts`
- `AI_HANDOFF.md`

## 5. Current Status
現在の状態：

- 実装コミット `3728dcc Flag generic opening phrase density` はローカル作成済み。
- `npm.cmd run quality` は成功済み。
- `.claude/` は未追跡だが、ユーザー明示がないため触っていない。
- CodeRabbit OSSが標準PRレビュー担当。今回の実装コミットはpush後にCodeRabbit再レビュー対象となる。
- Cursor Bugbotは任意/予備。今回未実行。

## 6. Known Issues
既知の問題：

- CodeRabbit/Codex-connector由来の未対応・要判断項目が残る：
  - 初回画像生成の部分復旧バナー/表示まわり（既存E2Eあり。CodeRabbitの最新再確認待ち）。
  - 全スロット画像失敗時の再試行導線（既存E2Eあり。CodeRabbitの最新再確認待ち）。
  - test env cleanupの全面整理（live readinessの安全強化は実施済み。全テストのenv restore共通化は未実施）。
  - `draft-html.ts` のFAQ編集回答が本文に質問既出時に出力へ反映されない可能性（既存テストあり。CodeRabbitの最新再確認待ち）。
- `wordpress/post/route.ts` の承認ゲート懸念は確認済み。永続ドラフトstatusを読み直す実装と統合テストが存在するため、現時点では残課題から外してよい。
- `removeExistingAuthorProfileBlock` の孤立見出し直後本文欠落リスクは修正済み。完全author section除去の境界は引き続きClaude Codeでレビュー推奨。
- ライブOpenAI/Supabase/WordPress sandbox契約テストは、実環境では未実行。
- 実生成記事の「AIっぽさ」低減は、ライブ入力・人間評価を含む追加検証が必要。

## 7. CodeRabbit Review
CodeRabbit OSSの指摘と対応状況：

- Review status: PR #1はopen。今回のコミットpush後に再レビュー確認が必要。
- Critical findings: 今回ローカルで確認できる新規重大指摘なし。
- Resolved findings: 今回はCodeRabbit指摘への直接対応ではなく、非commodity品質の自律改善として冒頭汎用表現密度チェックを追加。
- Deferred findings: §6の残指摘。
- False positives / not applicable: 今回なし。

## 8. Optional Bugbot Findings
Cursor Bugbotの任意確認：

- Status: Not run
- Findings: なし
- Actions taken: なし。コスト対策方針どおり、標準レビューはCodeRabbit OSSに寄せている。

## 9. Verification Results
実行した確認コマンドと結果：

```bash
npx.cmd vitest run tests/unit/article-quality.test.ts
npx.cmd vitest run tests/unit/quality-regeneration-action-coverage.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:integrity
npm.cmd run quality
npx.cmd vitest run tests/unit/quality-edit-guidance.test.ts tests/unit/article-quality.test.ts tests/unit/quality-regeneration-action-coverage.test.ts
npm.cmd run quality
git commit -m "Flag generic opening phrase density"
```

結果：

- `tests/unit/article-quality.test.ts`: 成功（67 tests）
- `tests/unit/quality-regeneration-action-coverage.test.ts`: 成功（7 tests）
- `npm.cmd run typecheck`: 成功
- `npm.cmd run lint`: 成功
- `npm.cmd run test:integrity`: 成功
- 1回目の `npm.cmd run quality`: 失敗
  - 原因：新規check ID `generic-opening-density` に対する `qualityCheckEditGuidance` が未接続で、`tests/unit/quality-edit-guidance.test.ts` がfallback検出。
  - 対応：`src/components/aio/article-generator-app.tsx` に編集ガイダンスを追加し、同テストにも期待値を追加。
- 対象再確認：
  - `npx.cmd vitest run tests/unit/quality-edit-guidance.test.ts tests/unit/article-quality.test.ts tests/unit/quality-regeneration-action-coverage.test.ts`: 成功（3 files / 76 tests）
- 2回目の `npm.cmd run quality`: 成功
  - `npm run test`: 36 files / 249 tests passed
  - `npm run test:contract`: 3 files / 11 tests passed
  - `npm run test:e2e`: 47 passed
  - coverage: statements 85.29% / branches 71.54% / functions 91.22% / lines 85.67%
  - Next.js 16.2.9 production build passed
- 実装コミット時pre-commit: 成功（`npm run lint`、`npm run test:integrity`）

未実行：

- 実sandbox環境での `npm.cmd run test:live:*`。credentialsとsandbox確認が必要なため未実行。
- push後のCodeRabbit再レビュー確認。push後にClaude Code側で確認推奨。

## 10. Next Recommended Action
次にClaude Codeが最初にやるべきこと：

1. `3728dcc Flag generic opening phrase density` とこのhandoff更新コミットをレビューする。
2. PR #1でCodeRabbit OSSの再レビュー結果を確認し、新規指摘がないか確認する。
3. `generic-opening-density` の閾値（冒頭420字内で汎用表現2件以上fail）が実運用で厳しすぎないか、実生成記事またはfixtureで確認する。
4. 重大な新規指摘がなければ、次の高優先度課題を1つ選んで最小差分で対応する。
   - 実生成記事の非commodity品質をlive/fixture入力で評価し、必要ならプロンプト・品質チェック・E2Eを補強。
   - test env cleanupを共通ヘルパーで整理するか判断。
   - 初回画像生成/全スロット失敗の復旧導線について、CodeRabbit最新コメントとの対応状況を確認。
   - FAQ編集回答レンダリングについて、既存テストで十分かCodeRabbitコメントと照合。
5. 変更後は `npm.cmd run quality` を実行し、結果をこのファイルに記録する。

## 11. Suggested Review Scope for Claude Code
Claude Codeに重点レビューしてほしい範囲：

- `src/lib/article-quality.ts`
  - `generic-opening-density` の閾値とスコアペナルティ。
  - 既存の `generic-opening-frame` / `generic-phrases` との重複が実運用で過剰にならないか。
- `src/lib/quality-regeneration-action.ts`
  - 再生成指示が、単なる言い換えではなく一次情報・現場条件へ誘導できているか。
- `src/components/aio/article-generator-app.tsx`
  - 編集画面ガイダンスがユーザーにとって具体的か。
- `tests/unit/article-quality.test.ts`
  - 新規fixtureが「後半は具体的だが冒頭だけ汎用」の狙いを表せているか。

## 12. Risk Notes
リスク・人間確認が必要な事項：

- `generic-opening-density` は文章品質を厳しくする変更。日本語記事では「結論として」は許容しつつ、「本記事では」「重要です」などが冒頭に重なるケースを落とす設計にしている。
- 実OpenAI生成結果で、品質診断が過剰に赤くならないかは、次フェーズで実生成または固定fixtureによる確認が望ましい。
- 今回も本番API、Supabase本番DB、WordPress本番環境には接続していない。

## 13. Do Not Touch
触らない方がよい領域：

- `.env*`、OpenAI/Supabase/WordPress/Vercel credentials、production data。
- `.claude/` 配下（ユーザー明示時を除く）。
- 品質ゲート、test integrity check、CodeRabbit運用ドキュメントを弱める変更。
- 無関係なUI刷新、画面遷移変更、大規模リファクタリング。
- 本番deploy、本番DB/API書き込み、`git push --force`、`git reset --hard`。

## 14. Notes for Claude Code
Claude Codeへの補足：

- `quality` は最終的に成功している。1回目の失敗は、実装漏れをテストが検出した正常な品質ゲート動作として記録している。
- `.claude/` は未追跡のまま残っている。今回も触っていない。
- Windowsでは `npm.cmd` / `npx.cmd` を使うのが安全。PowerShellの `git ignore Permission denied` warning はこの環境ではharmless。
- CodeRabbitを標準レビュー、Cursor Bugbotを任意/予備として扱う運用を維持すること。
- ループ番号は Loop 3 continuation を継続中。PRレビューと残指摘が一区切りしたら、次ループでLoop 4へ進める判断をする。
