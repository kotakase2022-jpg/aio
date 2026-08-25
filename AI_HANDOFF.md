# AI_HANDOFF

## 0. Current Loop Phase

- Current owner: Codex
- Next owner: Claude Code
- Loop: 5
- Loop number inferred from: The preceding handoff already identified Loop 5, and no intervening Claude Code handoff was recorded. This is the final production handoff for the same strict audit loop.
- Phase: Handoff
- Last updated: 2026-08-25 17:32 +09:00

## 1. Current Goal

今回の目的：

- 機械的な品質ゲートと実環境確認を通して、AIO記事生成アプリを保護PR経由で `main` に統合する。
- Vercel本番へ反映し、PCブラウザ、認証、生成ログ復元、API防御、ランタイムログを再検証する。
- 実際の本番ログで見つかった旧データ互換問題を、一次情報の意味を推測・改変せず修正する。

## 2. Current Branch / Commit / PR

- Branch: `codex/loop5-final-production-handoff`（この文書だけを更新する保護PR用ブランチ）
- Latest production code commit: `2c0bfb29441bd1563fc0e8c11c270de4d0f25d5b`
- Last known good commit: `2c0bfb29441bd1563fc0e8c11c270de4d0f25d5b`
- Main implementation PR: https://github.com/kotakase2022-jpg/aio/pull/13 (`MERGED`)
- Production compatibility PR: https://github.com/kotakase2022-jpg/aio/pull/14 (`MERGED`)
- CodeRabbit OSS review status: PR #14 first review completed with no actionable CodeRabbit comments. Follow-up reviews were rate-limited, while required status remained successful; two additional Codex findings were fixed and resolved.
- Production URL: https://aio-article-generator.vercel.app
- Production deployment: `dpl_HMuuLnsKpqLwwGzUC8b5y5jCSgWM`
- Unique deployment URL: https://aio-article-generator-4dfi68ivl-sl2026.vercel.app
- Vercel inspector: https://vercel.com/sl2026/aio-article-generator/HMuuLnsKpqLwwGzUC8b5y5jCSgWM

## 3. What Was Done

今回完了したこと：

- PR #13で生成ログ/アクティブジョブから、参照・競合・添付メタデータ・テーマ・一次情報・CTA・執筆者・画像トーン・画像枚数・文字数・競合調査を復元するようにした。
- 復元はログを開いた時と初回再開pollだけに限定し、生成中の編集を通常pollが上書きしないようにした。
- Strict Mode二重poll、古い競合調査/テーマ候補/添付抽出/画像アップロード/ログGET応答、生成中の別ログ閲覧、出力のない失敗ログに対する競合状態を防止した。
- Supabaseの公開済みmigration `002`を保持し、追加hardeningを`003`として分離した。全migrationでgateway tokenのDMLを禁止する契約テストを追加した。
- GitHubリポジトリを公開し、secret scanning、push protection、vulnerability alerts、automated security fixesを有効化した。
- `main`をPR必須、strict required check必須、conversation resolution必須、admin bypass/force push/delete禁止にした。
- PR #13をマージし、本番デプロイ `dpl_GqMRaksQQLxYn3ADDxQqhC2GzyNa` で初回検証した。
- 本番の完了済み旧ログでは一次情報本文が保存されていても、後から必須化された `primaryInfoTypes` がなく、再作成ボタンが無効になることを発見した。
- PR #14で旧ログを開くと正確な本文を復元し、一次情報カードへ移動して「種類が保存されていない」旨を日本語表示するようにした。
- 分類の自動推測や互換専用分類は行わず、既存の具体分類をユーザーが明示選択するまで再作成を禁止する。選択後は直ちに再作成可能になる。
- PR #14を保護条件下でマージし、`main`の `2c0bfb2` をVercel本番へデプロイした。
- 本番PCブラウザで8件の生成ログ取得、旧ログ本文/参照/一次情報復元、案内表示、選択前ロック、明示選択後の有効化を確認した。再生成・保存・DB更新は実行していない。

## 4. Files Changed

主な変更ファイル：

- `.env.example`
- `README.md`
- `AI_HANDOFF.md`
- `src/components/aio/article-generator-app.tsx`
- `src/lib/primary-information.ts`
- `supabase/migrations/003_harden_aio_schema.sql`
- `tests/contract/supabase-migrations.contract.test.ts`
- `tests/e2e/aio-workflow.spec.ts`
- `tests/unit/primary-information.test.ts`

## 5. Current Status

現在の状態：

- `main`の本番コード: `2c0bfb29441bd1563fc0e8c11c270de4d0f25d5b`
- PR #13 / #14: `MERGED`
- Vercel production: `READY`
- Canonical alias: https://aio-article-generator.vercel.app
- Local `npm.cmd run quality`: PASS（最終レビュー修正後に再実行）
- Hosted required CI: PASS
- Production HTTP/auth/header checks: PASS
- Production PC-browser read-only regression: PASS
- Production browser console warning/error: 0
- Vercel error logs / 5xx logs after smoke: 0
- 既存の未追跡 `output/` と `.claude/` は変更・stageしていない。

## 6. Known Issues

既知の問題：

- WordPressのlive post/media/deleteは `UNVERIFIED`。破壊可能な本番WordPressでは実行せず、使い捨てsandbox credentialsと7個の安全フラグがないため送信していない。
- Supabase Security Advisorのleaked-password protection WARNは残る。本アプリはSupabase password Authを使っていないため、認証方式を変更する場合に再評価する。
- Supabase Performance Advisorのunused-index/Auth connection noticesは情報レベル。監査中に本番indexは削除していない。
- OpenAIの遅延・文面・画像は確率的。live contractは成功したが、将来の外部API状態までは保証できない。
- 旧ログで一次情報分類が未保存の場合、再作成前に分類を1つ明示選択する必要がある。これは誤った意味づけを避ける意図した挙動。

## 7. CodeRabbit Review

CodeRabbit OSSの指摘と対応状況：

- Review status: PR #13は初回レビュー5件を全対応。PR #14は初回レビューでactionable commentsなし、follow-upはrate limit、required statusはSUCCESS。
- Critical findings: なし。
- Resolved findings: PR #13の5件と、追加自動レビューの競合状態/安全性指摘をすべて対応。PR #14の追加Codexレビュー2件も回答・修正・resolve済み。
- Deferred findings: なし。
- False positives / not applicable: CodeRabbitのdocstring coverage warningはTypeScript/Next.jsの既存品質ゲートにない補助指標であり、説明目的で不要なコメントを追加しない。PR description warningはテンプレート準拠へ修正した。

## 8. Optional Bugbot Findings

Cursor Bugbotの任意確認：

- Status: Run automatically on PR #13 and the first PR #14 revision.
- Findings: PR #13で生成中に別ログを開ける競合を1件検出。PR #14では指摘なし。
- Actions taken: PR #13の指摘はhandler guard、全ログボタン無効化、PC E2E追加で対応済み。PR #14では対応不要。

## 9. Verification Results

実行した確認コマンドと結果：

```bash
npm.cmd audit --audit-level=low
npm.cmd run quality
npx.cmd vitest run tests/unit/primary-information.test.ts
npx.cmd playwright test tests/e2e/aio-workflow.spec.ts --grep "generation logs show previous output"
npm.cmd run test:live:openai
npm.cmd run test:live:supabase
npm.cmd run test:live:readiness
git diff --check
npx.cmd vercel inspect https://aio-article-generator-4dfi68ivl-sl2026.vercel.app --scope sl2026
curl.exe -sSI https://aio-article-generator.vercel.app/
curl.exe -sS -D - https://aio-article-generator.vercel.app/api/generation-logs -o NUL
npx.cmd vercel logs dpl_HMuuLnsKpqLwwGzUC8b5y5jCSgWM --level error --since 15m --limit 100 --scope sl2026
npx.cmd vercel logs dpl_HMuuLnsKpqLwwGzUC8b5y5jCSgWM --status-code 5xx --since 15m --limit 100 --scope sl2026
```

結果：

- npm audit: PASS、脆弱性0件。
- Test integrity: PASS、54 test files、skip/only/todo等の禁止パターンなし。
- Unit/integration: PASS、50 files / 414 tests。
- Contract: PASS、4 files / 15 tests。
- Coverage: PASS、statements 86.85%、branches 76.53%、functions 91.55%、lines 87.31%。
- Chromium PC E2E: PASS、51/51。
- Next.js 16.3.2 build: PASS、19 routes。
- Focused legacy-log unit: PASS、3/3。
- Focused legacy-log E2E: PASS、1/1。
- GitHub Actions final run: PASS、run `32826255079` / job `97734824952` / 4m03s。
- Live OpenAI contract: PASS、構造化記事生成1/1。
- Live Supabase disposable CRUD: PASS、2/2、marker row/storage objectを正確にcleanupしbaseline countsへ復帰。
- WordPress readiness: NOT READY、sandbox-only variables 7件が未設定。live requestなし。
- Production root: PASS、未認証で`307` to `/demo-login?next=%2F`。
- Production `/api/generation-logs`: PASS、未認証で`401`。
- CSP/HSTS/X-Frame-Options/nosniff/Permissions-Policy/Referrer-Policy: PASS。
- Production PC browser: PASS。旧ログ本文と一次情報を復元し、分類未保存案内、選択前disabled、`独自データ・調査結果`明示選択後enabledを確認。再作成ボタン自体は押していない。
- Browser console warning/error: 0。
- Vercel error logs / 5xx logs: 0件。

## 10. Next Recommended Action

次にClaude Codeが最初にやるべきこと：

1. `2c0bfb2`を起点に、PR #14の旧ログ分類確認フローを独立レビューする。
2. `restoreFormFromGenerationJob`が保存済み分類を保持し、欠損/不正分類を自動推測せず、ログオープン時だけ明示確認へ誘導することを確認する。
3. `npm.cmd run quality`を再実行し、差分がなければコード変更せずレビュー結果を記録する。
4. WordPress live契約テストが必要なら、必ず使い捨てsandboxと全安全フラグを先に用意し、本番WordPressは使わない。

## 11. Suggested Review Scope for Claude Code

Claude Codeに重点レビューしてほしい範囲：

- `src/components/aio/article-generator-app.tsx`: `applyGenerationJob`、`restoreFormFromGenerationJob`、生成要件判定。
- `src/lib/primary-information.ts`: 保存値のfilterが新規入力の選択肢/validationを変更しないこと。
- `tests/e2e/aio-workflow.spec.ts`: 旧ログの案内、選択前disabled、明示選択後enabled。
- `tests/unit/primary-information.test.ts`: valid/missing/invalid category metadata。

## 12. Risk Notes

リスク・人間確認が必要な事項：

- WordPress live契約のみ未検証。deterministic integration/E2E mocksは通過済み。
- demo codeは共有簡易認証であり、ユーザー別・tenant別認可ではない。
- 公開リポジトリなので、今後もsecret scanning/push protectionを維持し、credentialsを追跡しない。
- 本番ブラウザの最終smokeはread-onlyで、既存DB/Storage/WordPressデータを変更していない。

## 13. Do Not Touch

触らない方がよい領域：

- `.env.local`、API keys、Supabase/WordPress credentials、cookies、gateway tokens/hashesを表示・commitしない。
- 未追跡の `output/` と `.claude/` を削除・stage・変更しない。
- 認証、SSRF、upload validation、HTML sanitization、image rollback/concurrency、migration/test-integrity checksを弱めない。
- disposable sandboxと全確認フラグなしにWordPress live post/media/deleteを実行しない。
- `main`へ直接push、force push、branch protection bypassをしない。

## 14. Notes for Claude Code

Claude Codeへの補足：

- Windows PowerShellでは `npm.cmd` / `npx.cmd` を使用する。
- CodeRabbit OSSが標準レビュー。Cursor Bugbotは任意・予備。
- Vercel CLIは `--scope sl2026` が必要。
- Production: https://aio-article-generator.vercel.app
- Supabase project: `npdyfhqugniuxfxpgngh`。
- `AGENTS.md` / `CLAUDE.md`の運用指示は今回変更不要だった。
