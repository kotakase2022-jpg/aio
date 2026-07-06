# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 3 continuation
- Loop number inferred from: 直近handoffはLoop 3 continuationのCodexフェーズだった。今回も同一PR上で残課題を1件進めたため、Loop 3 continuationのCodex自律改善として継続し、次はClaude Codeレビューへ戻す。
- Phase: Autonomous Improvement / File Extraction Quality / Handoff
- Last updated: 2026-07-06 18:02 +09:00

## 1. Current Goal
今回の目的：

AIO記事生成アプリを、機能信頼性・PCブラウザ画面遷移・日常利用UX・非commodity品質の観点で100/100へ近づける。今回のCodexフェーズは、添付Office文書（DOCX/PPTX/XLSX）から抽出した一次情報・競合情報が、XMLのrun分割によって不自然な空白や改行を含む問題を改善し、記事生成インプットの具体性と自然さを高めること。

Goal全体は未完了。残指摘、sandbox契約テスト、実生成品質検証、ライブ連携確認は継続課題。

## 2. Current Branch / Commit / PR
- Branch: codex/persistent-quality-gate-operations
- Latest implementation commit: b0de858 `Preserve Office rich text extraction`
- Previous implementation commit: 5742d7e `Preserve author fallback block`
- Last known good commit: b0de858 `Preserve Office rich text extraction`
- Last known good verification: `npm.cmd run quality` 成功（§8）。
- PR: https://github.com/kotakase2022-jpg/aio/pull/1
- Current local status before final push: `AI_HANDOFF.md` のみ未コミット予定。`.claude/` は未追跡のまま触っていない。

## 3. What Was Done
今回完了したこと：

- 必読ファイル（`AGENTS.md`、`CLAUDE.md`、`AI_HANDOFF.md`、`README.md`、`package.json`）と直近状態を確認。
- `wordpress/post/route.ts` の承認ゲートを確認。現在の実装は `getDraft(body.draft.id)` で永続ドラフトを読み直し、保存済みstatusが `approved` でない場合に投稿を拒否していた。
- `tests/integration/wordpress-post-route.integration.test.ts` に、クライアントpayloadが `approved` でも永続ドラフトが `draft` なら拒否するテストが既に存在することを確認。よってこの既知メモは実装済み/テスト済みとして扱う。
- 次の改善対象として file extraction inline XML text joining を選択。
- `src/lib/server/file-extraction.ts` を修正：
  - DOCXは `w:p` 段落内の `w:t` runを連結し、段落間だけを分ける。
  - PPTXは `a:p` 段落内の `a:t` runを連結し、段落間だけを分ける。
  - XLSX inline rich textは同一セル内の `t` runを連結する。
  - XMLタグ正規表現のエスケープ処理を共通化し、タグ名の誤一致を抑制。
- `tests/unit/file-extraction.test.ts` に回帰テストを追加：
  - DOCX paragraph run分割が「当社の支援現場では、一人親方...」のように自然につながること。
  - PPTX run分割が競合LPの説明として自然につながること。
  - XLSX inline rich textがセル内で自然につながること。
- 実装修正を `b0de858 Preserve Office rich text extraction` としてコミット。

## 4. Files Changed
主な変更ファイル：

- `src/lib/server/file-extraction.ts`
- `tests/unit/file-extraction.test.ts`
- `AI_HANDOFF.md`

## 5. Current Status
現在の状態：

- 実装コミット `b0de858 Preserve Office rich text extraction` はローカル作成済み。
- `npm.cmd run quality` は成功済み。
- `.claude/` は未追跡だが、ユーザー明示がないため触っていない。
- CodeRabbit OSSが標準PRレビュー担当。今回の実装コミットはpush後にCodeRabbit再レビュー対象となる。
- Cursor Bugbotは任意/予備。今回未実行。

## 6. Known Issues
既知の問題：

- CodeRabbit/Codex-connector由来の未対応・要判断項目が残る：
  - 初回画像生成の部分復旧バナー/表示まわり。
  - 全スロット画像失敗時の再試行導線（`article-images.ts`）。
  - live env precedence/safety、test env cleanup。
  - `draft-html.ts` のFAQ編集回答が、本文に質問既出時に出力へ反映されない可能性（要仕様判断）。
- `wordpress/post/route.ts` の承認ゲート懸念は今回確認済み。永続ドラフトstatusを読み直す実装と統合テストが存在するため、現時点では残課題から外してよい。
- ライブOpenAI/Supabase/WordPress sandbox契約テストは未整備。
- 実生成記事の「AIっぽさ」低減は、ライブ入力・人間評価を含む追加検証が必要。
- `removeExistingAuthorProfileBlock` は既存仕様として、孤立見出し直後から次のsection/h1/h2までを除去する。孤立見出し直後に無関係本文がある特殊HTMLでは、その本文も除去される可能性がある。

## 7. CodeRabbit / Bugbot Findings
CodeRabbit OSSの指摘と対応状況：

- Standard reviewer: CodeRabbit OSS。
- Resolved/advanced in this Codex phase: file extraction inline XML text joining を改善し、Office文書からの一次情報・競合情報抽出が不自然なrun分割を含みにくくなった。
- Pending review: 実装コミットpush後、CodeRabbit再レビューで新規指摘がないか確認が必要。
- Deferred findings: §6の残指摘。
- False positives: 今回なし。

Cursor Bugbot:

- Optional/backup only。
- 今回未実行。

## 8. Verification Results
実行した確認コマンドと結果：

```bash
npx.cmd vitest run tests/unit/file-extraction.test.ts
npx.cmd vitest run tests/integration/document-fixtures.integration.test.ts
npx.cmd vitest run tests/integration/extract-file-route.integration.test.ts
npm.cmd run typecheck
npm.cmd run lint
npx.cmd vitest run tests/unit/file-extraction.test.ts tests/integration/document-fixtures.integration.test.ts tests/integration/extract-file-route.integration.test.ts
npm.cmd run quality
git commit -m "Preserve Office rich text extraction"
```

結果：

- `tests/unit/file-extraction.test.ts`: 成功（10 tests）
- `tests/integration/document-fixtures.integration.test.ts`: 成功（4 tests）
- `tests/integration/extract-file-route.integration.test.ts`: 成功（6 tests）
- `npm.cmd run typecheck`: 成功
- `npm.cmd run lint`: 成功
- 関連3テスト同時実行: 成功（3 files / 20 tests）
- `npm.cmd run quality`: 成功
  - `npm run test`: 36 files / 244 tests passed
  - `npm run test:contract`: 3 files / 11 tests passed
  - `npm run test:e2e`: 47 passed
  - coverage: statements 85.24% / branches 71.46% / functions 91.21% / lines 85.62%
  - Next.js 16.2.9 production build passed
- 実装コミット時pre-commit: 成功（`npm run lint`、`npm run test:integrity`）

未実行：

- push後のCodeRabbit再レビュー確認。push後にClaude Code側で確認推奨。

## 9. Next Recommended Action
次にClaude Codeが最初にやるべきこと：

1. `b0de858 Preserve Office rich text extraction` とこのhandoff更新コミットをレビューする。
2. PR #1でCodeRabbit OSSの再レビュー結果を確認し、新規指摘がないか確認する。
3. 重大な新規指摘がなければ、次の高優先度課題を1つ選んで最小差分で対応する。
   - 初回画像生成の部分復旧バナー/表示。
   - 全スロット画像失敗時の再試行導線（`article-images.ts`）。
   - FAQ編集回答レンダリング方針の仕様確認とテスト追加。
   - live env precedence/safety、test env cleanup。
4. 変更後は `npm.cmd run quality` を実行し、結果をこのファイルに記録する。

## 10. Suggested Review Scope for Claude Code
Claude Codeに重点レビューしてほしい範囲：

- `src/lib/server/file-extraction.ts`
  - `extractDocxText`
  - `extractPptxText`
  - `extractWorksheetText`
  - `extractXmlParagraphText`
  - `extractInlineXmlText`
  - `escapeXmlTagForRegex`
- `tests/unit/file-extraction.test.ts`
  - 新規DOCX/PPTX/XLSX rich text run結合テスト。
- `tests/integration/wordpress-post-route.integration.test.ts`
  - WordPress承認ゲート懸念を残課題から外してよいかの確認。

## 11. Do Not Touch
触らない方がよい領域：

- `.env*`、OpenAI/Supabase/WordPress/Vercel credentials、production data。
- `.claude/` 配下（ユーザー明示時を除く）。
- 品質ゲート、test integrity check、CodeRabbit運用ドキュメントを弱める変更。
- 無関係なUI刷新、画面遷移変更、大規模リファクタリング。
- 本番deploy、本番DB/API書き込み、`git push --force`、`git reset --hard`。

## 12. Notes for Claude Code
Claude Codeへの補足：

- 今回の改善は、ユーザーが過去に問題視した「PDF/添付ファイルが判読困難になる」系の品質に近い領域。Office文書のrun分割による不自然な抽出は、一次情報カードや競合ファイルからの記事品質に直接影響する。
- PDF OCRやスキャンPDFの読取性能そのものは今回対象外。今回対象はDOCX/PPTX/XLSXのXML rich text run分割。
- Windowsでは `npm.cmd` / `npx.cmd` を使うのが安全。PowerShellの `git ignore Permission denied` warning はこの環境ではharmless。
- CodeRabbitを標準レビュー、Cursor Bugbotを任意/予備として扱う運用を維持すること。
- ループ番号は Loop 3 continuation を継続中。PRレビューと残指摘が一区切りしたら、次ループでLoop 4へ進める判断をする。
