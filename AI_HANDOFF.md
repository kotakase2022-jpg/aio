# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Phase: Autonomous quality improvement loop in progress
- Last updated: 2026-07-05 14:42 +09:00

## 1. Current Goal
現在の開発目的：

既存アプリを「機能・画面遷移の安定性」「業務利用価値」「AIっぽさを抑えた生成記事品質」の3指標で100点に近づける。今回は、生成記事がテンプレート文に見えるリスクを下げるため、定型的な文頭の反復検知と生成指示を強化した。

## 2. Current Branch / Commit
- Branch: codex/persistent-quality-gate-operations
- Latest commit: current HEAD after `Detect formulaic AI sentence openings`
- Last known good commit: current HEAD after `npm run quality`

## 3. What Was Done
今回完了したこと：

- `article-quality`に「定型的な文の入り方」チェックを追加した。
- 「結論として」「具体的には」「たとえば」などの文頭が過剰に反復する記事を検知し、改善指示へ出せるようにした。
- OpenAI記事生成プロンプトに、定型的な文頭の過用を避け、編集判断・現場例・条件・例外・比較から自然に段落を始める指示を追加した。
- 単体テストに、構造は整っていても「具体的には」が反復してテンプレート文に見える記事を落とすケースを追加した。

## 4. Files Changed
主な変更ファイル：

- `AGENTS.md`
- `CLAUDE.md`
- `AI_HANDOFF.md`
- `src/lib/article-quality.ts`
- `src/lib/server/article-generation.ts`
- `tests/unit/article-quality.test.ts`

## 5. Current Status
現在の状態：

- `npm run quality`が成功しており、型、Lint、テスト不正検知、単体/結合テスト、契約テスト、coverage、Playwright E2E、本番ビルドは通過済み。
- Playwright E2Eは35件成功し、PCブラウザの主要フロー、生成、編集、保存、承認、WordPress投稿、エラー復旧、コピー/HTML出力、ログ復元、アップロード失敗復旧を確認済み。
- 通常のローカル品質確認対象は整備済み。

## 6. Known Issues
既知の問題：

- 外部OpenAI / Supabase / WordPressのライブ契約テストは、本番データ保護のためsandbox環境変数が揃わない限りfail-closedする。
- `npm run test:live:readiness`は、sandbox用の確認環境変数がない状態では成功しない想定。
- 本番DB・本番API・本番ユーザーデータをテストで変更しないこと。
- 今回の生成品質改善は機械的評価とプロンプト強化であり、実OpenAIのライブ出力品質はsandbox契約テスト環境が揃うまで未検証。
- 3指標すべて100点の完了条件は未達。次ループでも機能棚卸し、実ブラウザ確認、生成品質改善を継続する。

## 7. Bugbot Findings
Cursor Bugbotの指摘：

- 未実行

## 8. Verification Results
実行した確認コマンドと結果：

```bash
npm run test -- tests/unit/article-quality.test.ts tests/unit/article-generation.test.ts
npm run quality
npm run lint
npm run typecheck
npm run test
npm run build
```

結果：

- `npm run test -- tests/unit/article-quality.test.ts tests/unit/article-generation.test.ts`: 成功（2 files / 37 tests passed）
- `npm run quality`: 成功
- `npm run typecheck`: 成功（quality内）
- `npm run lint`: 成功（quality内）
- `npm run test:integrity`: 成功（37 files checked）
- `npm run test`: 成功（33 files / 139 tests passed）
- `npm run test:contract`: 成功（3 files / 9 tests passed）
- `npm run test:coverage`: 成功（statements 81.51%、branches 66.76%、functions 88.4%、lines 82.02%）
- `npm run test:e2e`: 成功（35 passed）
- `npm run build`: 成功（Next.js 16.2.9 production build passed）

## 9. Next Recommended Action

次のAIが最初にやるべきこと：

- Claude Codeは、今回追加した`sentence-frame-variety`の閾値が既存の良質記事を過剰に落としていないかをレビューする。
- 次の改善候補は、実ブラウザでの視覚確認、OpenAI sandboxでのライブ生成品質確認、またはファイル抽出/WordPress media uploadの追加契約テスト。
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
- 今回は`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`を確認済み。
