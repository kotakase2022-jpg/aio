# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 2
- Loop number inferred from: Previous `AI_HANDOFF.md` had Current owner: Claude Code, Next owner: Codex, Loop: 1, and explicitly instructed Codex to start the next development cycle as Loop 2. This handoff therefore records the completed Codex phase of Loop 2.
- Phase: Handoff
- Last updated: 2026-07-05 19:08 +09:00

## 1. Current Goal
今回の目的：

既存アプリを「機能・画面遷移の安定性」「業務利用価値」「AIっぽさを抑えた生成記事品質」の3指標で100点に近づける。今回は、Claude Codeが残したNext Recommended Actionに従い、丸写し検知しきい値（現状28文字）が短い固有語句の自然な引用を誤検知しないことを単体テストで固定した。

## 2. Current Branch / Commit
- Branch: codex/persistent-quality-gate-operations
- Latest commit: current HEAD after `Validate source digestion threshold`
- Last known good commit: current HEAD after `npm run quality`

## 3. What Was Done
今回完了したこと：

- Claude Codeの前回ハンドオフを確認し、Current owner: Claude Code / Next owner: Codex / Loop: 1 から、今回はLoop 2のCodex再開と判断した。
- `tests/unit/article-quality.test.ts`に、短い入力由来フレーズを本文に残しても、周辺文脈が編集的に書き換えられていれば丸写し未達にしない境界テストを追加した。
- 追加テストでは、一次情報（LINE承認と帳票不在）、参照情報（給付基礎日額と補償開始日）、競合情報（料金表と導入期間）の短い固有語句が本文に残るケースで、`primary-info-digestion` / `reference-info-digestion` / `competitor-insight-digestion` がすべてpassedになることを確認した。
- `AI_HANDOFF.md`を指定テンプレートに合わせ、Loop 2のCodex作業結果として更新した。
- `AGENTS.md`と`CLAUDE.md`は読み直したが、運用ルール変更は不要と判断し変更していない。

## 4. Files Changed
主な変更ファイル：

- `tests/unit/article-quality.test.ts`
- `AI_HANDOFF.md`

## 5. Current Status
現在の状態：

- `npm run quality`が成功しており、typecheck、lint、test integrity、単体/結合、契約テスト、coverage、Playwright E2E、本番ビルドはすべて通過済み。
- Playwright E2Eは36件成功。
- 丸写し検知は、長文貼り付けを落とす単体テストと、短い固有語句の自然な再利用を許す単体テストの両側で検証済み。
- Claude Codeの前回レビューではコード修正不要と判断されており、今回も重大なビルド/型/Lint/テスト/実行時不整合は検出されなかった。

## 6. Known Issues
既知の問題：

- 外部OpenAI / Supabase / WordPressのライブ契約テストは、本番データ保護のためsandbox環境変数が揃わない限りfail-closedする。
- `npm run test:live:readiness`は、sandbox用の確認環境変数がない状態では成功しない想定。
- 本番DB・本番API・本番ユーザーデータをテストで変更しないこと。
- 実OpenAIのライブ生成記事に対する編集者目線の視覚確認はsandbox契約テスト環境が揃うまで未検証。
- 3指標すべて100点の完了条件は未達。次ループでも機能棚卸し、実ブラウザ確認、生成品質改善を継続する。

## 7. Bugbot Findings
Cursor Bugbotの指摘と対応状況：

- 未実行。今回のCodex作業中にBugbot指摘は提供されていない。利用可能なローカル/CLIツールからBugbotを直接実行できる状態も確認できていないため、次のPR/差分レビューでCursor Bugbotを実行することを推奨。

## 8. Verification Results
実行した確認コマンドと結果：

```bash
npx vitest run tests/unit/article-quality.test.ts
npm run quality
```

結果：

- `npx vitest run tests/unit/article-quality.test.ts`: 成功（1 file / 27 tests passed）
- `npm run quality`: 成功
- `npm run typecheck`: 成功（quality内）
- `npm run lint`: 成功（quality内）
- `npm run test:integrity`: 成功（37 files checked、quality内）
- `npm run test`: 成功（33 files / 143 tests passed、quality内）
- `npm run test:contract`: 成功（3 files / 9 tests passed、quality内）
- `npm run test:coverage`: 成功（statements 81.59%、branches 67.06%、functions 88.57%、lines 82.09%、quality内）
- `npm run test:e2e`: 成功（36 passed、quality内）
- `npm run build`: 成功（Next.js 16.2.9 production build passed、quality内）

## 9. Next Recommended Action
次にClaude Codeが最初にやるべきこと：

- 今回追加した「短い固有語句は許す」境界テストが、実務上の引用・固有名詞再利用として自然かレビューする。
- `includesLongVerbatimClause`の28文字しきい値について、長文丸写しの見逃しと短文引用の誤検知のバランスが適切か確認する。
- Bugbotレビューを実行できる環境なら、Loop 2差分に対してCursor Bugbotを実行し、指摘があれば優先度順に対応する。
- 次の改善候補は、実ブラウザでの視覚確認、OpenAI sandboxでのライブ生成品質確認、または生成品質チェックの実務サンプル拡充。

## 10. Suggested Review Scope for Claude Code
Claude Codeに重点レビューしてほしい範囲：

- `tests/unit/article-quality.test.ts`の追加テストが、丸写し検知を過度に緩めるものではなく、短い固有語句の自然な再利用だけを許す内容になっているか。
- `primary-info-digestion` / `reference-info-digestion` / `competitor-insight-digestion`のpassed期待が、既存の長文丸写し検知テストと矛盾していないか。
- 今回のテスト追加により、今後しきい値や正規化ロジックを変更した際に意図した回帰検知ができるか。

## 11. Do Not Touch
触らない方がよい領域：

- `.env`、`.env.local`、`.env.production`など秘密情報を含むファイル
- 本番Supabase、WordPress、OpenAIアカウントや本番データ
- ユーザーが明示していない既存UI刷新
- 品質ゲートを弱める変更
- 生成済みビルド成果物や依存パッケージ本体

## 12. Notes for Claude Code
Claude Codeへの補足：

- このプロジェクトはNext.js 16系のため、Next.js関連の実装前には`node_modules/next/dist/docs/`の該当ガイドを読むこと。
- main直pushではなくPR経由、GitHub Actionsの`quality-gate`通過、Vercel本番デプロイはmainから、という運用を維持すること。
- テストを削除・skip・緩和して通すことは禁止。
- 丸写し検知は`src/lib/article-quality.ts`の`includesLongVerbatimClause`に集約されている。source側/target側の正規化（`normalizeComparableText`）を変える場合は、両方が同じ正規化を通ることを崩さないよう注意。
- 前回Claude Codeが`AI_HANDOFF.md`のみを未コミット更新していたため、今回のCodexコミットにはそのハンドオフ更新をLoop 2用に再整理した内容も含まれる。
