# AI_HANDOFF

## 0. Current Loop Phase
- Current owner: Codex
- Next owner: Claude Code
- Loop: 9
- Loop number inferred from: 前回Current ownerがCodexでClaude Codeへの引継ぎ後、Claudeによる新ループ完了記録はない。相沢様対応PR #42の追加検証・本番反映としてLoop 9を継続。
- Phase: Development / Release verification
- Last updated: 2026-11-09 22:20 +09:00

## 1. Current Goal
ユーザーの最新指示により、厳格・敵対的検証、再現テスト、必要な修正、保護されたPR経由のmerge、本番Vercel反映までを実施する。
前回の「本番反映なし」制限は今回の明示承認で変更された。既存記事一括変更、本番WordPressへのテスト投稿、相沢様への送信は実施しない。

## 2. Current Branch / Commit / PR
- Branch: `codex/loop9-aizawa-content-integrity`
- Latest commit at start: `30e0ab35ef1646c506563bf02a6d9f83541c3a56`
- Last known good implementation before this follow-up: `0304a04`
- Baseline/main at start: `8c2a9b5a584ede25d94d2747550cc692db4d6f90`
- PR: https://github.com/kotakase2022-jpg/aio/pull/42
- CodeRabbit OSS review status: 初回7 inline + 1 outside-diff対応済み。返信中の追加fallback指摘も今回再現・修正済み。最新差分のレビューはpush後に確認する。
- Production at start: `dpl_HaGiMSgjDJ4ygs757JvsnNy7n5Pt`、runtime `742370e`
- Production URL: https://aio-article-generator.vercel.app/
- Release status: NOT YET DEPLOYED; final gate/review/CI and migration/gateway/app rollout pending.

## 3. What Was Done
- 必須文書、差分、PR、レビュー、現在のVercel本番コードを確認。相沢様の実ログ照合・8項目回答案は前回報告に保持。
- FAQの意味を変える記号・小数・符号を保持し、wrapped/複数段落FAQ、編集者のみが追加した質問、CTA、出典注記の保持を検証。
- 実リンクでないコメント/data-hrefの誤検出と、取得成功・失敗が混在するURLのfallback再混入を修正。
- 小数の根拠照合、限定条件の一般化、一覧ページ判別、1文字の置換文字、ブロック境界で数字が連結する問題を修正。
- OpenAI timeoutをレスポンス本文読取まで適用。ヘッダーのみ到着して本文が停止する回帰を修正。
- ドラフト本文・承認・画像保存を単一RPCトランザクションへ変更。画像失敗時の部分保存を防止。
- ジョブ更新をCAS化し、キャンセルが遅い完了応答に上書きされる競合を防止。不正入力を保存前に検証。
- 生成ログは最新canonical draftから復元。補助ログ同期の失敗は保存成功と区別して警告を表示。
- WordPress投稿前に永続予約を取得。重複送信防止、結果不明時の保留、投稿成功後の補助保存失敗時に投稿URLを保持。
- 画像再生成完了の条件付き保存、公開済み画像保持、local JSONの直列化・atomic rename・読取エラー伝播。
- 保存・承認・投稿・画像再作成中の編集/同時操作を抑止し、遅いログ復元応答を無効化。save/approveの遅延E2Eを追加。
- Next 16.4.5等へ互換更新。本番依存監査0件。E2Eをdev serverから隔離production build/serverへ変更。
- 本番read-only smokeを追加し、アプリデータのmutationを遮断。`output/`、env、local data、test artifactsをVercelアップロードから除外。

## 4. Files Changed
主な変更範囲：
- `src/lib/{draft-html,faq-quality,publication-quality,source-url}.ts`
- `src/lib/server/{content,openai,drafts,generation-jobs,draft-image-regeneration,wordpress,wordpress-posts,local-store,article-form-schema}.ts`
- save/approve/generate-article/generation-jobs API handlers
- `src/components/aio/article-generator-app.tsx`
- `supabase/functions/aio-store/index.ts`
- `supabase/migrations/20261109125814_atomic_draft_save.sql`
- unit/integration/contract/E2E/live tests, `tests/fixtures/sql/draft-atomicity.sql`
- `package.json`, lockfile, `playwright.config.ts`, `.gitignore`, `.vercelignore`
- `scripts/production-smoke.mjs`, `docs/testing.md`
- `docs/adversarial-verification-2026-11-09.md`, this handoff
AGENTS.md/CLAUDE.mdの運用ルールは現在のCodeRabbit標準・PR前提に適合するため変更不要。

## 5. Current Status
- 最終combined quality PASS。typecheck/lint/integrity/512 tests/contract 15/coverageすべて成功。
- production Chromium E2E 56/56、Next 16.4.5 build 19 routes PASS。
- 独立静的レビューで新たなblockerなし。ライブDBの証明とは区別する。
- 本番migration/gateway/appはまだ未反映。
- 実OpenAI文章・画像はPASS。WordPress実接続試験は専用sandbox不足で未実施。

## 6. Known Issues
- 公開前チェックはヒューリスティックであり、事実の真偽・高度な意味重複を保証しない。
- 再作成は現在フォームと追加指示からの全文生成。手編集本文を保持する部分修正ではない。
- Client updatedAtは厳密なセッション横断revision tokenではない。完全な多人数同時編集制御は未実装。
- WordPress不明結果では予約を保持する。管理者が実投稿を確認してから照合する。exactly-once保証ではない。
- local fallbackのlockはprocess内のみ。本番VercelはSupabase必須。
- JS描画/ログイン必須/画像のみの参照ページは手動補足が必要。
- 開発依存typescript-eslint/minimatch系moderate 8件が残る。npm audit fix --forceの破壊的downgradeは未実施。
- 共通デモコードは既存仕様。ユーザー別データ分離を提供する認証ではない。

## 7. CodeRabbit Review
- Review status: 既存PRの初回レビューと追加返信を確認。最新差分はcommit/push後に再確認。
- Critical findings: 初回なし。
- Resolved findings: 初回8件は0304a04。追加の同一URL成功/失敗混在fallback指摘はrenderer/UI共通の最終filterとunit/E2Eで解消。
- Deferred findings: 最新レビュー待ち。
- False positives / not applicable: 一律docstring coverage警告は既存コメント方針と合わず機能検証とは分離。過去Codex GitHub reviewは使用上限で失敗、標準レビューはCodeRabbit。

## 8. Optional Bugbot Findings
- Status: Not run
- Optional Bugbot: Not run
- Findings: なし
- Actions taken: CodeRabbitと独立ローカルレビューを使用。

## 9. Verification Results
- 修正前の回帰失敗を確認：URL3、OpenAI本文停止1、workflow8、FAQ拡張、WP5xx1、UI遅延save/approve2、local破損store1など。
- 中間full quality PASS: 510 tests、contract15、E2E54、build19 routes。
- 最終full quality: PASS。512 tests、contract15、coverage S/B/F/L 87.17/77.66/92.56/87.90%、Chromium E2E56/56、Next 16.4.5 build19 routes。
- `npm run test:live:openai`: PASS、3種類の読者/構成を含む1契約、147.96秒。
- `npm run test:live:openai:image`: PASS、メモリ内PNG1枚、57.28秒、保存なし。
- `npm run test:live:supabase`: 初期2/2 PASS。新RPCの恒久適用後に拡張3件を再実行する。
- live PostgreSQL: BEGIN + migration + SQL fixture + ROLLBACK PASS。atomic rollback/CAS/role権限を確認。仮関数と行が残らないことも確認。
- `npm audit --omit=dev`: PASS、0 vulnerabilities。full auditはdev moderate8件。
- `test:live:readiness`: WordPressのみ未設定でFAIL。実WordPress成功とは報告しない。
- `git diff --check`: PASS。
- Windows sandboxのSSR cache rename EPERMはテスト実行前の環境障害。同一検査を許可済みローカル環境で再実行し成功。
- 復元E2EのlocalStorage即時判定は非同期処理を待たないテスト不備だったため同じ期待値のexpect.pollへ変更。テスト削除/skip/緩和なし。

## 10. Next Recommended Action
1. 最終quality、PR required CI、CodeRabbitレビューを確認し保護PR経由でmerge。
2. additive RPC migration → gateway → mainのVercel stageの順で反映。
3. guarded Supabase disposable testsとcleanupを確認。
4. stageのread-only smoke成功後にpromoteし、canonical URLで再確認。
5. 本番deployment/commit/CI番号と検証結果でこの文書を更新する。

## 11. Suggested Review Scope for Claude Code
- transactional saveの権限/rollback/画像所有関係。
- cancellation CAS、canonical draft restore、補助保存失敗と主処理成功の区別。
- WordPress予約・不明結果・既存履歴との互換性、管理者照合。
- FAQの正本と編集保持、URL候補fallback、数値/条件の保守的評価。
- 実API検証とmock検証の境界、本番smokeでmutationが起きないこと。

## 12. Risk Notes
- 専用WordPress sandboxを用意して実media/post/delete contractを実行するまでは実サービス結合は未証明。
- 公開前の数値/対象/期間/条件/例外/出典、医療・金融内容は人が確認する。
- rollout時は旧WordPress投稿workerが完了してから更新する。旧バージョンは予約方式を使わない。
- 新アプリはRPCがないと保存が失敗するためmigration/gatewayを先に反映する。

## 13. Do Not Touch
- env/keys/passwords/tokensを表示・commitしない。
- ユーザー所有untracked `output/`を削除・stage・アップロードしない。
- 本番既存記事の更新・WordPress公開・顧客宛送信は行わない。
- main直接push/force/branch protection迂回は禁止。
- 認証/SSRF/容量/timeout/HTML sanitization/RLSを弱めない。

## 14. Notes for Claude Code
- 詳細は `docs/adversarial-verification-2026-11-09.md` と相沢様回答案 `docs/aizawa-content-integrity-review.md`。
- Windowsではnpm.cmd/npx.cmd。
- 前回handoffの「本番反映なし」「456 tests」は過去記録。今回の承認・結果と混同しない。
- 完全無欠や全入力での成功は保証しない。再現可能な検証範囲と未検証範囲を区別する。
