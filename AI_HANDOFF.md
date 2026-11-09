# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 9
- Loop number inferred from: 作業ブランチが`codex/loop9-aizawa-content-integrity`であり、前回handoffはLoop 7の完了状態のまま更新されていなかった。今回の相沢様検証対応を独立したLoop 9として扱う。
- Phase: Handoff
- Last updated: 2026-11-09 21:24 +09:00

## 1. Current Goal

今回の目的：

- 相沢様の検証資料と保存済み実ログを照合し、FAQ重複、文字化け、根拠不明の数値、条件の一般化、制作過程文言、読者層・記事構成、再作成仕様を再現・切り分けする。
- 読者向け最終HTMLを基準に、不具合を防止または公開前に検出できるよう最小差分で改修する。
- fixture、単体・結合・契約・PC Chromium E2E、実OpenAI検証、CI、CodeRabbitレビューを通したPRをClaude Codeへ引き継ぐ。
- 今回は本番デプロイ、既存記事の一括更新、本番WordPress投稿、相沢様への送信を行わない。

## 2. Current Branch / Commit / PR

- Branch: `codex/loop9-aizawa-content-integrity`
- Current branch HEAD before final handoff commit: `79cc683e9807e21f5d57aab453fe841540eedd07`
- Latest implementation commit: `0304a04` (`fix: address content integrity review findings`)
- Initial implementation commit: `ba93f6d7860acbf800c35c42a4dd45e84c448ebe` (`fix: enforce article content integrity`)
- Last known good commit: `0304a04`
- Baseline commit: `8c2a9b5a584ede25d94d2747550cc692db4d6f90`
- PR: https://github.com/kotakase2022-jpg/aio/pull/42
- CodeRabbit OSS review status: initial review complete; 7 inline findings and 1 outside-diff finding were reproduced and fixed in `0304a04`; all 7 review threads resolved. Follow-up check was `NEUTRAL/skipping` because the free OSS hourly review allowance resets in 28 minutes.
- Required GitHub Actions: PASS, latest run `42615706910`, job `129154918511`, 4m35s
- Production URL: https://aio-article-generator.vercel.app/ (今回の差分は未反映)

## 3. What Was Done

今回完了したこと：

- `AGENTS.md`、`CLAUDE.md`、旧`AI_HANDOFF.md`、`README.md`、`package.json`、基準コミットとの差分、現在の本番実装との対応を確認した。
- 相沢様のGoogle Docを確認し、権限内の本番Supabase保存ログを読み取り専用で照合した。対象はデルタのケース型、FAQ型、教科書型の新規・再作成と、アニハの新規・再作成。
- アニハの楽天系URLとデルタのITmedia URLで、文字化けした取得結果が旧実装では`ok=true`としてAI根拠へ渡り得たことを確認した。
- 同一質問の回答表現が異なるFAQが本文と末尾に二重表示されること、固定のBtoB指示、採点目的の固定語、内部取得メモが公開HTMLへ混入し得ることを再現した。
- FAQ配列を公開用FAQの正本にし、本文内の旧FAQを除去して1回だけ描画する冪等な最終HTML組み立てへ変更した。同一質問では後の回答を編集者の確定回答として優先し、最初の表示順を保つ。
- URL取得をバイト列ベースに変更し、BOM、HTTP charset、HTML metaの優先順位を定義した。UTF-8、Shift_JIS/Windows-31J、EUC-JP、ISO-2022-JP、UTF-16系を扱う。
- nav、footer、header、aside等を本文抽出前に除外し、一覧、告知、本文不足、記事を分類した。通信成功`ok`と根拠利用可否`evidenceUsable`を分離し、文字化け疑いをAI根拠へ渡さないようにした。
- SSRF、リダイレクト、タイムアウト、レスポンス容量の既存制限は維持した。参照URLと競合URLは同じ取得処理を使う。
- 入力短縮処理で数値・期間・単位・条件・例外・出典境界を残しやすくし、省略時に検知できるマーカーを付けた。
- 生成指示からBtoB固定を外し、互換性のある任意項目`audienceType`と`articleStructure`を追加した。BtoC/BtoBと教科書型/FAQ型/ケース型ごとの生成計画・検証を実装した。
- FAQは`faq_items`だけに生成し、本文へFAQ章を重ねないようにした。入力にない数値、実績、条件を補完せず、仮想事例は仮定と明示するよう生成契約を強化した。
- 編集品質と公開前阻害要因を分離した。文字化け、FAQ重複、未裏付け数値、条件一般化、壊れたリンク、内部メモは高い編集品質点で相殺しない。
- 編集品質は正しい言い換えを語彙の完全一致だけで減点しないよう意味別名を導入し、`現場観察`や`競合記事では`を採点目的で強制しないようにした。
- 公開用出典を内部取得メモから分離し、実際のアンカー要素、URL正規化、重複排除を検証した。プレビュー、HTML出力、WordPressモック送信で同じ最終HTMLを使う。
- 再作成は従来どおり「現在のフォーム入力と追加指示による全文生成」であり、編集済み本文を引き継がないことを画面に明示した。現在の稿は完了まで保持し、旧稿はログから確認できる。
- 相沢様の8項目について現行仕様、原因、対応、検証、制約、操作上の工夫、人の確認事項、安定運用手順、未送信の回答案を`docs/aizawa-content-integrity-review.md`へ記録した。
- 修正前のfocused reproduction suiteで13件の失敗を確認し、実装修正後に全品質ゲートを成功させた。
- PR #42を作成し、required GitHub Actionsの成功を確認した。
- CodeRabbit初回レビューの8指摘をすべて実コードで確認した。修正前は追加reproductionが8 failed / 99 passedだった。
- FAQ後のCTA・出典注記保持、AI宣言済み取得不可URLの除外、ルート相対リンク、執筆者欄数値、全体`form`と記事内`header`、不正URLの失敗件数、BtoC画像再作成プロンプトを修正した。
- CodeRabbit対応後にfocused 107/107、対象E2E、full `npm run quality`を再実行し、全成功を確認した。

## 4. Files Changed

主な変更ファイル：

- `src/lib/draft-html.ts`
- `src/lib/server/content.ts`
- `src/lib/server/article-generation.ts`
- `src/lib/server/article-generation-job-runner.ts`
- `src/lib/article-quality.ts`
- `src/lib/publication-quality.ts` (new)
- `src/lib/source-url.ts`
- `src/components/aio/article-generator-app.tsx`
- `src/types/aio.ts`
- `tests/fixtures/encoded-html.ts` (new)
- `tests/unit/publication-quality.test.ts` (new)
- `tests/unit/draft-html.test.ts`
- `tests/unit/content.test.ts`
- `tests/unit/article-quality.test.ts`
- `tests/unit/article-generation.test.ts`
- `tests/integration/generation-job-runner.integration.test.ts`
- `tests/integration/wordpress.integration.test.ts`
- `tests/e2e/aio-workflow.spec.ts`
- `tests/live/openai.live.test.ts`
- `docs/aizawa-content-integrity-review.md` (new)
- `AI_HANDOFF.md`

初回コミット`ba93f6d`には計29ファイル、`+2610/-334`の変更がある。CodeRabbit対応コミット`0304a04`は13ファイル、`+385/-86`。未追跡の`output/`はユーザー所有として変更・stageしていない。

## 5. Current Status

現在の状態：

- Focused pre-fix reproduction: expected FAIL、13 failed / 40 passed
- Local full `npm run quality`: PASS
- Test integrity: PASS、55 files
- Unit/integration: PASS、51 files / 456 tests
- Contract: PASS、4 files / 15 tests
- Coverage: PASS、statements 87.32%、branches 77.36%、functions 92.64%、lines 87.80%
- Chromium PC E2E: PASS、52/52
- Next.js 16.3.2 production build: PASS、19 routes
- Live OpenAI structured generation: PASS、1/1、143.77秒
- GitHub required CI: PASS、latest run `42615706910`
- PR #42: OPEN、CLEAN、MERGEABLE
- CodeRabbit initial review: PASS check with Moderate merge risk、7 inline + 1 outside-diff actionable finding。全件`0304a04`で対応済み。
- CodeRabbit follow-up check: `NEUTRAL/skipping`（無料OSS枠の時間制限）。新規指摘なし。初回7スレッドは全件解決済みで、outside-diff 1件もコード・E2E・PRコメントで対応を記録済み。
- Production deployment: NOT RUN（今回の明示スコープ外）
- Production Supabase inspection: read-only only。書き込み・削除なし。
- Production WordPress posting: NOT RUN

## 6. Known Issues

既知の問題：

- FAQの意味が同じでも語彙が大きく異なる場合、完全な意味重複は機械判定できない。
- 数値・条件・根拠対応の公開前チェックは保守的なヒューリスティックであり、真偽そのものは一次資料と担当者の確認が必要。
- JavaScript実行後にのみ本文が現れるページ、画像のみ、ログイン必須ページは手動貼り付けまたはファイル添付が必要。
- AIが`sources`を空で返した旧ドラフトは、互換性維持のため利用可能な取得URLを出典候補として表示する場合がある。
- 既存保存ドラフトを一括移行していない。表示・保存・公開用HTMLの組み立て時に正規化する。
- OpenAI生成は確率的。同一入力でも文面差は残り、92点と78点の2回だけで新規生成優位とは判断できない。
- 再作成は編集済み本文を基にした部分修正ではない。必要な編集意図は追加指示へ書き、旧稿をログで保持する。
- GitHub push時にdefault branchの依存関係アラート92件（critical 10 / high 29 / moderate 41 / low 12）が表示された。今回の差分とは独立した既存リスクであり、別PRの依存監査が必要。
- GitHub上のCodex reviewはアカウント使用上限で実行失敗した。標準レビューはCodeRabbitであり、required CIには影響しない。

## 7. CodeRabbit Review

CodeRabbit OSSの指摘と対応状況：

- Review status: 初回レビュー完了。7 inline + 1 outside-diff findingを`0304a04`で対応し、全7 review threadsをresolvedにした。follow-up checkは無料OSS枠の時間制限で`NEUTRAL/skipping`。
- Critical findings: なし。
- Resolved findings: 旧FAQが後続CTAまで消す問題、取得不可URLがAI宣言ソースから公開出典へ戻る問題、執筆者欄数値の誤検出、ルート相対リンク誤判定、不正URL失敗件数欠落、全体`form`・記事内`header`過剰除去、本文不足案内テスト不足、画像再作成BtoB固定の8件。
- Deferred findings: なし。
- False positives / not applicable: Docstring coverage 0%警告。今回変更した70関数へ一律docstringを追加することは、説明不要な関数への冗長コメントを避けるリポジトリ方針に反する。required CIのlint、typecheck、test、coverage、E2E、buildは全成功しているため、非機能の補助警告として記録する。CodeRabbit sandboxのESLint install timeoutはGitHub Actionsとローカルlint成功で代替確認済み。

## 8. Optional Bugbot Findings

Cursor Bugbotの任意確認：

- Status: Not run
- Findings: なし。
- Actions taken: CodeRabbitを標準レビューとして使用しており、追加の高リスク指摘やユーザー指示がないため実行していない。

## 9. Verification Results

実行した確認コマンドと結果：

```bash
npx.cmd vitest run tests/unit/draft-html.test.ts tests/unit/content.test.ts tests/unit/article-quality.test.ts tests/unit/publication-quality.test.ts tests/unit/article-generation.test.ts
npx.cmd vitest run tests/unit/draft-html.test.ts tests/unit/publication-quality.test.ts tests/unit/content.test.ts tests/unit/article-generation.test.ts tests/integration/generation-job-runner.integration.test.ts
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --grep "bulk image regeneration preserves"
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run quality
npm.cmd run test:live:openai
git diff --check
gh pr checks 42 --watch --interval 10
```

結果：

- Focused reproduction before implementation: EXPECTED FAIL、13 failed / 40 passed。
- Focused tests after initial implementation: PASS。
- CodeRabbit reproduction before follow-up fixes: EXPECTED FAIL、8 failed / 99 passed。
- CodeRabbit reproduction after fixes: PASS、107/107。
- Focused BtoC image regeneration E2E: PASS、1/1。
- Typecheck / lint: PASS。
- Test integrity: PASS、55 files。
- Unit/integration: PASS、51 files / 456 tests。
- Contract: PASS、4 files / 15 tests。
- Coverage: PASS、statements 87.32%、branches 77.36%、functions 92.64%、lines 87.80%。
- Chromium PC E2E: PASS、52/52。
- Next.js build: PASS、19 routes。
- Live OpenAI: PASS、1/1。デルタ相当BtoB教科書型、デルタ相当BtoBケース型、アニハ相当BtoC FAQ型を1契約テスト内で検証。生産データ書き込みなし。
- GitHub Actions quality-gate: initial run `42611596371` PASS、follow-up run `42615706910` PASS（4m35s）。
- Git hooks: pre-commit / pre-pushともPASS。
- `git diff --check`: PASS。

旧テストのうちFAQを2回表示する期待値と固定語を必須とする期待値は、今回の受入仕様と矛盾するため是正した。テストの削除、skip、判定緩和は行っていない。

## 10. Next Recommended Action

次にClaude Codeが最初にやるべきこと：

1. PR #42の初回CodeRabbit指摘、`0304a04`の修正、解決済みreview threadsを独立レビューする。
2. `src/lib/draft-html.ts`のFAQ正本化・冪等性・CTA保持と、`src/lib/server/content.ts`の文字コード優先順位・SSRF制約維持を確認する。
3. `src/lib/publication-quality.ts`の数値根拠・条件一般化・リンク検出に過不足がないかfixtureと合わせて確認する。
4. `src/lib/server/article-generation.ts`で読者層・構成・根拠条件が新規生成と再作成の両方へ渡ることを確認する。
5. `npm.cmd run quality`を再実行し、差分がなければレビュー結果をhandoffへ追記する。
6. CodeRabbit follow-upを再実行する場合は、PR表示上の無料OSS枠リセット後に行う。
7. 承認前にPRをmergeしたり、本番デプロイしたりしない。

## 11. Suggested Review Scope for Claude Code

Claude Codeに重点レビューしてほしい範囲：

- FAQ: 同一質問・異回答、編集回答の優先、保存復元、繰り返しHTML組み立て、本文の正当な非FAQ見出しを誤削除しないこと。
- URL: BOM/HTTP/meta矛盾時の優先順位、Windows-31J/EUC-JP、一覧・短文・ノイズ、文字化けを根拠へ戻さないこと。
- Publication gate: 未裏付け数値、`約`だけの数値、条件一般化、内部メモ、実リンク、出典重複を編集点と独立して扱うこと。
- Audience/structure: BtoC/BtoB、教科書/FAQ/ケースが生成計画と評価へ伝播し、旧保存データが`auto`で動くこと。
- Regeneration: 現在フォームと追加指示を使う全文生成で、編集本文を黙って引き継がないこと。
- Public HTML: preview/export/WordPress mockの一致と、source/internal noteの分離。

## 12. Risk Notes

リスク・人間確認が必要な事項：

- 公開前に数値、期間、単位、対象、条件、例外、出典を一次資料と照合する。
- 動物医療、金融、法令等の専門情報は担当者・有資格者が確認する。
- 文字化けまたは`evidenceUsable=false`のURLは根拠として使わず、原文を手動入力する。
- FAQの意味重複、仮想事例の実績誤認、本文の主張と出典の対応は人が最終確認する。
- 本番保存ログは調査時に読み取りのみで使用した。既存記事、Supabase本番データ、WordPressを変更していない。
- このPRは本番未反映。承認後に別工程でmerge/deploy/post-deploy smokeが必要。

## 13. Do Not Touch

触らない方がよい領域：

- `.env.local`、API keys、Supabase/WordPress credentials、cookies、tokens/hashesを表示・commitしない。
- 未追跡の`output/`を削除・stage・変更しない。
- 認証、SSRF、redirect/timeout/size limits、upload validation、HTML sanitizationを弱めない。
- 本番Supabaseへの書き込み、本番WordPress投稿、既存記事一括変更を承認なしで行わない。
- `main`への直接push、force push、branch protection bypass、PR #42の無断mergeを行わない。

## 14. Notes for Claude Code

Claude Codeへの補足：

- 詳細調査報告と相沢様への未送信回答案は`docs/aizawa-content-integrity-review.md`にある。
- Windows PowerShellでは`npm.cmd` / `npx.cmd`を使用する。
- CodeRabbit OSSが標準レビュー。Cursor Bugbotは任意・予備。
- `AGENTS.md` / `CLAUDE.md`の運用指示は今回変更不要。
- 本番Vercelコードは調査開始時に`742370e`相当、基準`8c2a9b5`との差分は文書のみで、対象runtimeに機能差はなかった。
- 保存ログ上の生成時自己評価と編集画面の品質点は別経路。比較時は入力・取得本文・モデル・プロンプト版・評価対象をそろえる。
