# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Phase: Autonomous UX and quality improvement loop in progress
- Last updated: 2026-07-05 15:19 +09:00

## 1. Current Goal
現在の開発目的：

既存アプリを「機能・画面遷移の安定性」「業務利用価値」「AIっぽさを抑えた生成記事品質」の3指標で100点に近づける。今回は、編集品質チェックの未達項目ごとに「どこをどう直すか」が画面上で分かる修正先ガイダンスを追加した。

## 2. Current Branch / Commit
- Branch: codex/persistent-quality-gate-operations
- Latest commit: current HEAD after `Guide quality check edits`
- Last known good commit: current HEAD after `npm run quality`

## 3. What Was Done
今回完了したこと：

- 編集品質チェックの未達カードに、`修正先: ...`の小さなガイダンスを表示するようにした。
- タイトル、FAQ件数、FAQ質問、FAQ回答、本文HTML、一次情報/参照情報/競合情報の編集消化など、チェックIDごとに具体的な修正先と編集方針を返す`qualityCheckEditGuidance`を追加した。
- E2Eで、未達チェックカードにタイトル/FAQ/本文HTMLの修正先ガイダンスが表示されることを確認した。

## 4. Files Changed
主な変更ファイル：

- `src/components/aio/article-generator-app.tsx`
- `tests/e2e/aio-workflow.spec.ts`
- `AI_HANDOFF.md`

## 5. Current Status
現在の状態：

- `npm run quality`が成功しており、型、Lint、テスト不正検知、単体/結合テスト、契約テスト、coverage、Playwright E2E、本番ビルドは通過済み。
- Playwright E2Eは35件成功し、PCブラウザの主要フロー、生成、編集、保存、承認、WordPress投稿、エラー復旧、コピー/HTML出力、ログ復元、アップロード失敗復旧を確認済み。
- 通常のローカル品質確認対象は整備済み。
- 今回のUX改善により、編集品質チェックの未達理由だけでなく、どの編集欄で何を直すべきかがプレビュー画面上で分かるようになった。

## 6. Known Issues
既知の問題：

- 外部OpenAI / Supabase / WordPressのライブ契約テストは、本番データ保護のためsandbox環境変数が揃わない限りfail-closedする。
- `npm run test:live:readiness`は、sandbox用の確認環境変数がない状態では成功しない想定。
- 本番DB・本番API・本番ユーザーデータをテストで変更しないこと。
- 品質チェックから編集欄へ移る主要5導線（タイトル・FAQ件数・FAQ質問・FAQ回答・本文HTML）はmock E2Eで検証済み。
- 未達品質チェックの修正先ガイダンス表示はmock E2Eで検証済み。
- 一次情報、参照情報、競合情報の丸写し検知は単体テストで検証済み。
- 実OpenAIのライブ生成記事に対する編集者目線の視覚確認はsandbox契約テスト環境が揃うまで未検証。
- 3指標すべて100点の完了条件は未達。次ループでも機能棚卸し、実ブラウザ確認、生成品質改善を継続する。

## 7. Bugbot Findings
Cursor Bugbotの指摘：

- 未実行

## 8. Verification Results
実行した確認コマンドと結果：

```bash
npm run lint
npm run typecheck
npx playwright test tests/e2e/aio-workflow.spec.ts -g "editing the title to a generic label updates the quality checklist"
npx vitest run tests/unit/article-quality.test.ts tests/unit/article-generation.test.ts
npm run quality
```

結果：

- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npx playwright test tests/e2e/aio-workflow.spec.ts -g "editing the title to a generic label updates the quality checklist"`: 成功（1 passed、修正先ガイダンス確認を含む）
- `npx vitest run tests/unit/article-quality.test.ts tests/unit/article-generation.test.ts`: 成功（2 files / 40 tests passed）
- `npm run quality`: 成功
- `npm run typecheck`: 成功（quality内）
- `npm run lint`: 成功（quality内）
- `npm run test:integrity`: 成功（37 files checked）
- `npm run test`: 成功（33 files / 142 tests passed）
- `npm run test:contract`: 成功（3 files / 9 tests passed）
- `npm run test:coverage`: 成功（statements 81.59%、branches 67.06%、functions 88.57%、lines 82.09%）
- `npm run test:e2e`: 成功（35 passed）
- `npm run build`: 成功（Next.js 16.2.9 production build passed）

## 9. Next Recommended Action

次のAIが最初にやるべきこと：

- Claude Codeは、品質チェック未達カードの修正先ガイダンス文言が実務ユーザーに分かりやすいか、過剰に長くないかをレビューする。
- 次の改善候補は、実ブラウザでの視覚確認、OpenAI sandboxでのライブ生成品質確認、または丸写し検知しきい値の実務データでの調整。
- 外部APIの残リスクを詰める場合は、productionではなくsandbox環境を用意し、`npm run test:live:readiness`が通る状態にしてからライブ契約テストを実行する。

## 10. Do Not Touch

触らない方がよい領域：

- `.env`、`.env.local`、`.env.production`など秘密情報を含むファイル
- 本番Supabase、WordPress、OpenAIアカウントや本番データ
- ユーザーが明示していない既存UI刷新
- 品質ゲートを弱める変更
- 生成済みビルド成果物や依存パッケージ本体

## 11. Notes for Next AI

次のAIへの補足：

- このプロジェクトはNext.js 16系のため、Next.js関連の実装前には`node_modules/next/dist/docs/`の該当ガイドを読むこと。
- main直pushではなくPR経由、GitHub Actionsの`quality-gate`通過、Vercel本番デプロイはmainから、という運用を維持すること。
- テストを削除・skip・緩和して通すことは禁止。
- 今回もTSX変更前に`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`を確認済み。
