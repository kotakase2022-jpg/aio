# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Phase: Codex handoff preparation and repository state sync
- Last updated: 2026-07-05 14:38 +09:00

## 1. Current Goal
現在の開発目的：

CodexとClaude Codeが交互に開発・レビューできるように、運用指示ファイルを整備し、現在のリポジトリ状態と品質確認結果を正確に残す。

## 2. Current Branch / Commit
- Branch: codex/persistent-quality-gate-operations
- Latest commit: ddc0569 before this handoff-doc update
- Last known good commit: ddc0569

## 3. What Was Done
今回完了したこと：

- `AGENTS.md`をCodex向けの最上位指示として整備した。
- `CLAUDE.md`をClaude Code向けのレビュー・品質改善指示として整備した。
- `AI_HANDOFF.md`を新規作成し、現在の引き継ぎ状態を記録した。
- 直近のCodex作業では、FAQ行の追加・削除、FAQ具体性スコア、ライブ契約テスト環境の分離、編集済みFAQの最終本文反映、WordPress投稿前の画像URL解決を実装済み。

## 4. Files Changed
主な変更ファイル：

- `AGENTS.md`
- `CLAUDE.md`
- `AI_HANDOFF.md`

## 5. Current Status
現在の状態：

- 通常のローカル品質確認対象は整備済み。
- `package.json`には`lint`、`typecheck`、`test`、`test:coverage`、`test:e2e`、`build`、`quality`が定義済み。
- テスト設定は`vitest.config.ts`、`vitest.live.config.ts`、`playwright.config.ts`が存在する。
- Lint / TypeScript / build関連設定は`eslint.config.mjs`、`tsconfig.json`、`next.config.ts`、`postcss.config.mjs`が存在する。

## 6. Known Issues
既知の問題：

- 外部OpenAI / Supabase / WordPressのライブ契約テストは、本番データ保護のためsandbox環境変数が揃わない限りfail-closedする。
- `npm run test:live:readiness`は、sandbox用の確認環境変数がない状態では成功しない想定。
- 本番DB・本番API・本番ユーザーデータをテストで変更しないこと。

## 7. Bugbot Findings
Cursor Bugbotの指摘：

- 未実行

## 8. Verification Results
実行した確認コマンドと結果：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

結果：

- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run test`: 成功（33 files / 138 tests passed）
- `npm run build`: 成功（Next.js 16.2.9 production build passed）

## 9. Next Recommended Action

次のAIが最初にやるべきこと：

- Claude Codeは、この`AI_HANDOFF.md`、直近差分、Cursor Bugbot指摘の有無を確認する。
- コード変更を行う場合は、まず関連テストを確認し、変更後に`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`を実行する。
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
