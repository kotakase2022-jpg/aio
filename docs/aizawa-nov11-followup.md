# 2026-11-11 追加指摘への対応・本番確認

## 対象とリリース

- 仕様原本: https://docs.google.com/document/d/1NC89E-GACcn-ttHLPK3hjCTPhcFn0gCof4rRvn3N8wE/edit
- 本番URL: https://aio-article-generator.vercel.app/
- 最終反映: **2026-11-13 13:05:31 JST**、commit `324b880ab2bfc7fbab9c2352319352764b447814`。
- Deployment: `dpl_9aoGSRfatAYc1MqScMyPTgPecVAU`、https://aio-article-generator-rh8577ut7-sl2026.vercel.app 、READY。canonical aliasも同じcommitと確認。
- PR: [#44](https://github.com/kotakase2022-jpg/aio/pull/44)、[#45](https://github.com/kotakase2022-jpg/aio/pull/45)、[#46](https://github.com/kotakase2022-jpg/aio/pull/46)、[#47](https://github.com/kotakase2022-jpg/aio/pull/47)、[#48](https://github.com/kotakase2022-jpg/aio/pull/48)。必須CI後に通常merge、mainからstage/promote。保護迂回なし。
- 着手main `749301de18e847c6de777f21c11743ec28562ae5`、着手時本番 `e150927d7e5ddc5c82b54d946a9b21db49e8c4c5`。
- ロールバック先: https://aio-article-generator-2ovfy85ge-sl2026.vercel.app (`dpl_ByP6QrgAv4ehCXL7ECP54PwfK5mS`)。DB migrationなし。
- 認証/RLS/SSRF/画像生成基盤は変更せず、既存記事の一括変更・顧客WordPress投稿・課金/権限拡大は行っていない。
- 検証入力は依頼文の「デルタのファクタリング相談では希望日の5営業日前」を使った合成fixture。実顧客ログや商用条件の正しさの証明ではない。

## 改修仕様

|項目|実装・検証|
|---|---|
|記事構成|比較型・課題解決型と構成方針欄を追加。明示選択が最優先、自動では構成方針→再作成指示→テーマ。短縮前に構成を確定し保存。FAQ型は本文Q&A、ケース型は同じ仮想事例を全記事で追う。|
|表|自動/あり/なし。自動は情報量・比較可能性で判断。なしは生成指示と共通rendererで対応し、表の内容・条件・caption・リンクを文章として保持。|
|末尾補足FAQ|自動/あり/なし。本文Q&Aとは独立し、本文の編集済み回答を優先。なしでは末尾を出さず、本文Q&Aは構成や古いFAQ配列との一致にかかわらず保持。|
|評価|不要な表/FAQの欠如で減点しない。比較軸、課題解決の5段階、本文Q&Aを構成別に確認。保存した構成計画と最終HTMLを利用。|
|内部メモ|指定3例などを公開文面に書かない生成指示と公開前チェック。根拠不足/短縮の注意は編集者用に保持。内部文言と事実が混在する段落は丸ごと削除しない。|
|適用条件|会社・サービスの条件を本文ブロック、表の行、FAQ回答、要約・要点で照合。「約」「目安」や別段落の条件だけでは合格にしない。意味を保証できないため人の原文確認を画面で明示。|
|保存互換|新項目は任意、旧記事の動作を保持。新生成にcontent_policy_version:2とresolved_article_structureを保存。競合調査未設定のDB nullは未設定値へ正規化。migration不要。|

公開HTMLはプレビュー・コピー・ダウンロード・WordPress送信で共通処理を使用。再組立てによるFAQ増殖がなく、表なしでも情報を失わないことを検証。

## 今回の検証結果

|検査|結果|
|---|---|
|`npm run quality`|11/13 12:58-13:00 JST最終実行PASS。型/Lint/不正回避61files、55files/598 tests、contract15、coverage、E2E59、build19 routes。|
|Coverage|statements87.75%、branches79.44%、functions92.85%、lines88.40%。|
|PC E2E|Chromium59/59 PASS。生成・再作成・編集・保存復元・全画面プレビュー・各モード・失敗復旧・既存画像/ファイル動作。外部APIはmock、ライブ結果と区別。|
|実OpenAI|最終構成matrix8/8 PASS、gpt-5.5、画像0、DB/WP書込なし。280.04秒、1件30.21-39.43秒。|
|成果物再評価|8実生成成果物＋本番失敗例＋保存schemaを最終コードで12/12 PASS。追加ライブ呼出ではない。|
|最終runtime CI|PR48 run43362566563 PASS3m49s。PR47 run43361636735 PASS3m28s。他runtime PRも必須CI成功後merge。|
|本番読取smoke|最終版PASS。ログイン、新UI、必須入力、生成ログ、未認証API401。ログイン以外のmutationを遮断。|
|本番保存・出力|合成記事を実生成約82秒。修正後に同じ記事を編集保存200/warnings0、再読込、モード復元、HTML一致までPASS。13:05:35-13:06:01 JST。|
|公開前/ブラウザ|成功した本番継続確認で公開前問題0、console/page/network error0。編集品質の注意は別に残り、高スコアを合格条件にしていない。|
|本番ログ|最終deploymentのerrorレベル/15分検索は該当なし。長期監視/drainsは未監査。|
|WordPress|実投稿なし。結合テストで送信HTMLと各モードを検証。|

### 実生成matrix

|入力|表|補足FAQ|最終構成matrixの結果|
|---|---|---|---|
|デルタ・比較型|あり|あり|表あり、補足3問|
|デルタ・比較型|なし|なし|表なし、補足0問|
|デルタ・比較型|自動|自動|表あり、補足0問|
|デルタ・FAQ型|なし|なし|本文質問4見出し、補足0問|
|デルタ・課題解決型|自動|自動|問題→原因→対処→判断→行動、補足0問|
|デルタ・ケース型|あり|自動|仮想ケース中心、表あり、補足0問|
|デルタ・教科書型|自動|あり|体系的説明、表あり、補足3問|
|BtoC・FAQ型|なし|なし|本文質問4見出し、補足0問|

初回8/8（307.31秒）、再実行7/8（271.32秒）ではケース型が通常比較記事に短い例を追加しただけになった。失敗を保存し、同じ仮想ケースを全記事で追う指示へ改修。最終matrixは11:43-11:48 JSTの8/8（280.04秒）。その後に出典メタデータ、公開前チェック、保存の局所修正が入ったため、8件が最終コードで再生成されたとは記載しない。最終コードで成果物を再評価し、出典指示変更後には別途本番実生成を確認した。

## 発見・修正した不具合

1. 初期再現14 failed/1 passed。構成/任意要素/公開前チェックの実装で解消。
2. FAQ組立て順の回答欠落（1 failed/22 passed）、長文末尾の構成喪失（1 failed/37 passed）を修正。
3. レビューで表caption/セル内段落の条件喪失、本文Q&A欠落、補足FAQによる構成判定の誤合格などを再現修正。表2 failed/23 passed、編集Q&A2 failed/25 passed、その他3 failed/65 passed。追加の表文章化/非FAQ型Q&A欠落2 failed/30 passed、補足なし＋同じ質問が古い配列に残る条件1 failed/32 passedも修正。
4. 初回本番c56a5f9（12:08）ではモデルがmanual-textをURLとし取得メモを生成。strict smokeを失敗とし、非URLメタデータを編集者用注意へ分離。再現1 failed/39 passed。レビューで混在事実の削除リスク（2 failed/40 passed）も修正。最終的には**内容のない固定句のみ除去**し、記述的メモ/条件を含む文は保持して警告。
5. e1f88d1（12:43）では本文/sourcesは正常だが、手入力資料の内部IDを画面が必須URL扱い。再現2 failed/27 passed。HTTP出典だけを要求し、実URL欠落/壊れたリンクの検知は維持（PR47）。
6. af2b0c4（12:56）ではその誤警告解消後の保存が400。DBからのcompetitorResearch:nullをoptional-object schemaが拒否。実成果物と結合2 failed/18 passedで再現。読込/入力境界で未設定へ正規化し、不正な文字列/配列/booleanは拒否（PR48）。
7. 最終324b880（13:05）で同じ生成済み記事の編集保存・再読込・コピー・ダウンロードを完走。追加生成で良い結果だけを選び直したものではない。

旧期待「FAQは本文禁止/必ず複数」は今回の本文Q&A/任意補足仕様へ変更。FAQ不足E2Eは「あり」明示でエラー検証を維持。追加テストの取得メモ全文除去期待は事実を失う誤仕様だったため「保持＋警告」へ訂正しPR46に理由を記録。テスト削除/skip/coverage閾値緩和なし。

テスト準備の誤り（localStorage自動復元の想定、エラー集計関数呼出漏れ、fixtureの存在しないプロパティ）は修正して全検査を再実行。Windows cache rename EPERMは実行前sandbox制限で、許可済みローカル再実行が成功。

## データ保全

最終保存後、今回の2件だけを除外した5テーブルの件数・全行fingerprintが開始前と一致。秘密値や顧客本文は出力していない。

|テーブル|既存行数|fingerprint|
|---|---:|---|
|article_inputs|29|379331e28ff23e21e7c632bb0419fa28|
|article_drafts|26|1a9dbf1f1a7ead9b22f3c6488efc235a|
|article_images|47|5426c49a4892f96552248716d1bf2a77|
|wordpress_posts|0|d41d8cd98f00b204e9800998ecf8427e|
|wordpress_connections|2|9de4ff8d11d15869f2cc958c4b43934e|

**検証記事2件と対応ログは未削除。** Supabase削除確認が完了しなかったため迂回せず残した。両方とも下書き・画像0・WordPress未投稿。対象ID/markerはAI_HANDOFF.md、成果物/manifestはignored `.verification-files/AIO-RELEASE-SMOKE-*/`。後で削除する場合はID・marker・未投稿状態を照合し、確認を完了してから実施する。既存記事を一括削除しない。

## レビュー・残課題

- CodeRabbitはPR44/46で実レビューし、受領した実質的指摘は対応済み。PR47/48はOSS上限でNEUTRAL、新規レビュー未実施。既存GitHub Codex自動レビューはPR47/48指摘なし。Bugbot未実行、課金枠拡張なし。
- 数値/条件の意味を完全には証明できない。会社/サービスの言い換え、離れた前提、複雑な例外は人の原文照合が必要。
- 本番例の文字数超過・表現反復は編集品質の注意として残る。公開前問題0を「完全品質」「公開して安全」と同義にしない。
- WordPress実投稿、新規ライブ画像生成、長期監視は未実施。開発依存moderate advisory1件/旧Actions runtime警告は別タスクで確認。production依存auditは今回0件。
- 相沢様への送信は行っていない。再検証用のアプリは本番で利用可能。

## 操作手順

1. テーマでBtoB・構成・構成方針を指定。矛盾する場合は明示選択が優先。
2. 表と末尾補足FAQを選択。本文Q&Aを残して末尾だけ省く場合は「FAQ型＋補足FAQなし」。
3. 一次情報に会社・サービス・対象・期間・例外を同じ文脈で書く。
4. 本文だけでなく要約・要点・表・FAQも原文照合。編集者向け注意と公開前チェックを読み、必要箇所を読者向けに編集する。
5. 保存して生成ログから再読込し、プレビュー/HTML確認後に承認する。

再作成は現在の入力と追加指示による全文生成で、手編集の部分修正ではない。先に保存する。既存本文へ新設定を適用する場合は入力を確認して再作成する。保存済み入力を無断で一括変更しない。
