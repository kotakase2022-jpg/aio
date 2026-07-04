## 変更内容の概要

-

## 影響範囲

-

## 追加・更新したテスト

-

## 実行したコマンド

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:integrity`
- [ ] `npm run test`
- [ ] `npm run test:coverage`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] `npm run quality`

## E2Eで確認した主要フロー

-

## 品質・安全確認

- [ ] `npm run quality` が成功している
- [ ] 既存テストを削除・skip・todo・only・コメントアウト・過度に緩和していない
- [ ] 失敗している機能をmockで成功扱いにしていない
- [ ] console error / pageerror / unhandled rejection / unexpected network error を放置していない
- [ ] 本番DB・本番API・本番ユーザーデータに影響しない
- [ ] CSV / PDF / 画像 / ファイルアップロード変更がある場合、fixtureを追加・更新している
- [ ] Supabaseのテーブル・RLS・保存処理変更がある場合、データ整合性テストを追加している

## 補足・リスク

-
