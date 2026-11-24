# セッション引き継ぎ（2026-11-24）：相沢様の「投稿先」指摘と PR #59 の本番反映

- 作成: 2026-11-24 06:08 UTC（15:08 JST）。Claude Code のクラウドセッションで作成。
- 前のセッションは、この時点で作業を止めた。
  - 06:40 UTC に予約していた確認は削除した。
  - PR #58・#59 の通知の購読も解除した。新しいセッションで購読し直すこと。
- この資料は、新しいセッションが単独で作業を続けられるように書いている。前のセッションの作業メモ（コンテナ内の一時ファイル）は残っていない。必要なスクリプトは付録に載せた。

## 0. 最初にやること

1. 作業ブランチに切り替える（クローン先は通常 `/home/user/aio`）。

   ```bash
   cd /home/user/aio
   git remote set-branches --add origin claude/wordpress-post-error-near-button
   git fetch origin claude/wordpress-post-error-near-button main
   git checkout claude/wordpress-post-error-near-button
   git pull --ff-only
   ```

   - このクローンは取得するブランチが絞られている。新しいブランチは `git remote set-branches --add origin <branch>` を先に実行しないと追跡できない。
2. CLAUDE.md が定める必読ファイルを読む。`AGENTS.md`、`CLAUDE.md`、`AI_HANDOFF.md`、`README.md`、`package.json`、PR #59 の差分、CodeRabbit の指摘。
3. ユーザーへの返答は日本語で行う。

## 1. 経緯（要点）

- 11/24 相沢様の指摘の要点:
  - 手順書には「投稿先」で「コラム」を選ぶ（2回目からは自動で選ばれる）とある。しかしツールに投稿先の欄がない。
  - 投稿先を選ばずに下書き投稿したが、WordPress のコラムの下書きにも記事がない。
  - 別の場所に保存されたのか、処理が完了していないのかを知りたい。
- 原因:
  - ツールには投稿先を選ぶ機能がなく、常に標準の「投稿」（`/wp-json/wp/v2/posts`）へ送っていた。
  - 本番の投稿記録（`wordpress_posts`）は0件だった。読み取りのみで、所有者の承認済み。記録のうえでは、テスト投稿は完了していない。
  - WordPress 側は確認していないため、「投稿」に記事があるかは未確認（CodeRabbit の指摘）。WordPress は記事を作成した後にカテゴリー・タグなどを設定するため、その段階で 4xx が返ると、記事が残ったまま記録は0件になりうる。投稿し直す前に、「投稿」の下書きを確認してもらう。
  - 失敗の表示が画面上部にあり、投稿ボタンから遠いため気づきにくかった。
  - 失敗の原因そのものは不明。記録が残らず、Vercel のログも期限切れ。
- 対応:
  - PR #58: 投稿先（投稿タイプ）を選べるようにした。本番反映済み（11/24 13:48 JST）。
  - PR #59: 失敗表示をボタンの直下に移した。対応項目（`supports`）がないカスタム型を除外し、CodeRabbit の指摘3件にも対応した。**未マージ・未反映**。
- 詳しい記録と、相沢様への返信文の下書き（未送信）: `docs/aizawa-nov24-wordpress-destination.md`

## 2. 引き継ぎ時点の状態

- 本番: `dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN`（main `d41bd1f` = PR #58）。
  - 06:0x UTC に API で確認した。プロジェクトの本番も、正規ドメイン `aio-article-generator.vercel.app` も、このデプロイを指していた。
  - PR #59 を反映するときのロールバック先は、このデプロイ。
- PR #59: https://github.com/kotakase2022-jpg/aio/pull/59 （ブランチ `claude/wordpress-post-error-near-button`）
  - コミット:
    - `81fb147`: 失敗表示をボタン直下へ移した。
    - `8b93cfc`: `supports` がないカスタム型を除外した（PR #58 への CodeRabbit の再指摘）。
    - `06e283b`: PR #59 への CodeRabbit の指摘3件に対応した。
    - その後に、この引き継ぎ資料のコミット（ドキュメントのみ）。
  - CI:
    - `06e283b` では success で、マージ可能（clean）だった。
    - 引き継ぎ資料のコミットで CI が再実行されるため、結果を確認すること。
  - CodeRabbit:
    - `8b93cfc` のレビューで3件の指摘があった。いずれも `06e283b` で修正し、3スレッドとも返信して解決済み。
    - アプリの2件には、CodeRabbit が「Addressed in commit 06e283b」と付けた。
    - **`06e283b` 以降の差分のレビューは、レート制限のため未実施**。05:54 UTC の時点で「次の枠は43分後」と表示されていたので、06:37 UTC 頃に戻る見込み。
  - ローカルの検証は、前のセッションが `06e283b` で実行した。結果はすべて PASS。
    - typecheck、lint、test:integrity（65ファイル）
    - test: 59ファイル／647件
    - coverage（S/B/F/L）: 88.41 / 80.48 / 93.03 / 89.08%
    - contract: 15件
    - E2E: Chromium PC で 89/89
    - build: E2E の webServer の中で実行
    - 新しい E2E 3件は、修正前のコードで失敗することを確認済み。
- ユーザーの承認:
  - PR #59 は「CodeRabbitを待ってから反映」。CodeRabbit の確認が済めば、squash merge から本番反映まで進めてよい。
  - CodeRabbit の指摘への対応は、この承認の範囲に含まれる。それ以外の新しい変更を本番に出す場合は、改めてユーザーに確認する。
- 相沢様へのメッセージは送らない。返信文は下書きのままにする。送付は所有者が行う。

## 3. 次にやること

### 3.1 準備

- PR #59 の通知を購読する（`subscribe_pr_activity`、owner `kotakase2022-jpg`、repo `aio`、PR 59）。
- 状態を確認する。

  ```bash
  gh api repos/kotakase2022-jpg/aio/pulls/59 --jq '{state, mergeable, mergeable_state, head: .head.sha[0:7]}'
  gh api repos/kotakase2022-jpg/aio/commits/$(git rev-parse HEAD)/check-runs --jq '.check_runs[] | {name, status, conclusion}'
  ```

### 3.2 CodeRabbit の再レビュー

1. 06:37 UTC 以降に、PR #59 へ `@coderabbitai review` を投稿する。それより前なら、`send_later` で 06:40 UTC 以降に予約する。

   ```bash
   gh api -X POST repos/kotakase2022-jpg/aio/issues/59/comments -f body='@coderabbitai review'
   ```

2. 結果を確認する。数分かかる。

   ```bash
   gh api "repos/kotakase2022-jpg/aio/pulls/59/reviews?per_page=100" --jq '.[] | {id, user: .user.login, state, submitted_at, commit: .commit_id[0:7]}'
   gh api repos/kotakase2022-jpg/aio/pulls/59/ccr/review_threads
   ```

3. 妥当な指摘があれば、次の順で対応する。
   1. 修正して、テストを追加する。修正前のコードでテストが失敗することも確かめる。
   2. 品質ゲートを通して push する。
   3. スレッドに返信して解決する。

   GitHub GraphQL は使えないため、スレッドの操作は次の CCR 用ルートで行う。

   ```bash
   # 返信
   gh api -X POST repos/kotakase2022-jpg/aio/pulls/59/comments/<comment_id>/replies -F body=@reply.md
   # 解決
   gh api -X POST repos/kotakase2022-jpg/aio/pulls/59/ccr/comments/<comment_id>/resolve
   ```

4. 指摘が妥当でない場合は、理由をスレッドに書いて解決する。レート制限でレビューされない場合は、30分後に再試行する。

### 3.3 マージ（squash）

```bash
gh api -X PUT repos/kotakase2022-jpg/aio/pulls/59/merge -f merge_method=squash \
  -f commit_title='fix: WordPress投稿の失敗をボタン直下に表示し、投稿結果を記事ごとに扱う（相沢様11/24） (#59)' \
  -F commit_message=@merge-59.txt
```

- `merge-59.txt` には変更の要点を日本語で書く。過去の例は `git log -1 d41bd1f`。末尾には会話で指定された帰属行を付ける。

### 3.4 本番反映（Vercel REST API。PR #58 と同じ手順）

- Vercel CLI は、保存済みのトークンでは動かない（ユーザー情報の取得で 404 になる）。そのため REST API を使う。
- 付録Aのスクリプトを一時ディレクトリに保存して使う。トークンは環境「aio」のネットワークシークレットからプロキシが差し込むため、スクリプトには入れない。

1. main を最新にして、マージ後のコミットをクリーンな状態で checkout する。

   ```bash
   git checkout main && git pull --ff-only
   git status --short   # 何も出ないこと
   ```

2. 送るファイルを確認する: `python3 <保存先>/vercel_release.py plan`
   - 期待値は 209件。前回の本番は 208件で、この引き継ぎ資料が1件増える。
   - `added` は `docs/session-handoff-2026-11-24.md` の1件。
   - `removed` は空になる。
   - `changed` は次の6件。
     - `AI_HANDOFF.md`
     - `docs/aizawa-nov24-wordpress-destination.md`
     - `src/components/aio/article-generator-app.tsx`
     - `src/lib/server/wordpress.ts`
     - `tests/e2e/aio-workflow.spec.ts`
     - `tests/integration/wordpress-post-destination.integration.test.ts`
   - CodeRabbit の指摘に対応した場合は、そのファイルも増える。
   - 想定外の差分があれば、そこで止める。
3. ステージする: `python3 <保存先>/vercel_release.py stage`
   - 本番向けのビルドを作るが、ドメインはまだ割り当てない（`autoAssignCustomDomains: false`）。
   - 出力の `id` を控える。`rollbackTarget` が `dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN` であることを確認する。
4. ビルドを確認する: `python3 <保存先>/vercel_release.py status <id>`
   - `readyState` が `READY` になるまで待つ。前景の `sleep` は使えないため、バックグラウンドのループか Monitor で待つ。
   - `Compiled successfully` が出ていること。
   - `/api/wordpress/post-types` を含む全APIルートがあること。
   - エラーがないこと。
5. 本番へ切り替える: `python3 <保存先>/vercel_release.py promote <id>`
   - 終了コードが0以外なら、切り替えに失敗している。出力の `status` と `error` を確認し、そこで止める。
6. 切り替わったか確認する: `python3 <保存先>/vercel_release.py alias`
   - `aliasDeployment` と `projectProduction` が、どちらも新しい `id` であること。
7. ログインしなくてもできる確認を行う（付録B）: `NODE_USE_ENV_PROXY=1 node <保存先>/post-release-noauth.mjs`
   - 期待値: `loginPage` 200、`loginFormRendered` true、未認証の3つの API がすべて 401、`oldDefaultCode` 401。
   - スクリプトは状態コードだけを出す。アクセスコードの値は出さない。
8. 問題があれば、すぐにロールバックする: `python3 <保存先>/vercel_release.py promote dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN`
   - 終了コードが0であることを確かめる（0以外なら、戻せていない）。
   - 続けて `python3 <保存先>/vercel_release.py alias` を実行し、`aliasDeployment` と `projectProduction` が、どちらも `dpl_DXXsKdhtS74DFyfaLftBeLuhuNQN` に戻ったことを確認する（CodeRabbit の指摘）。

- ログイン後の画面確認は、このセッションからはできない。アクセスコードは 11/17 に所有者が変更しており、値はセッションに渡されていない。チャットでコードを尋ねないこと。

### 3.5 反映結果の記録

- 小さなドキュメントPRを作り、CI が通ったらマージする。
  - `docs/aizawa-nov24-wordpress-destination.md` の「検証」に、PR #59 の本番反映を追記する。
    - 時刻（JST）、デプロイID、配信ファイル数
    - ビルドログの確認結果、ドメインの割り当て
    - ログイン不要の確認の結果、ロールバック先
    - CodeRabbit の再レビューの結果
  - 同じ文書の「相沢様への返信文」の前書き（「PR #59 の本番反映後に送付する」）を、送付できる状態だとわかる書き方に改める。
  - `AI_HANDOFF.md` の §0、§2、§5、§7、§9、§10 を更新する。この引き継ぎ資料は完了と追記するか、要点を `AI_HANDOFF.md` に移す。
- 過去の確認結果を、今回の結果として転記しないこと。

### 3.6 ユーザーへの報告

- 短く報告する。
- 残っている所有者側の作業（§6）を伝える。
- 返信文の在りか（`docs/aizawa-nov24-wordpress-destination.md` の「相沢様への返信文（下書き・未送信）」）を伝える。

## 4. 守ること（ユーザーの指示）

原文:

- 「既存の未コミット差分は、ユーザーまたはCodexの作業として保護してください。強制リセット、差分破棄、無断のブランチ切替・強制プッシュは行わないでください。」
- 「APIキー・認証情報・記事本文などの機密情報を、回答やログへ不要に出力しない。」
- 「既存データの一括書換え・削除や、バックアップからの本番復元は、影響を説明して確認を得てから実施してください。」
- 「件数確認のために有料AI生成を大量実行したり、本番に大量のダミー記事を作成したりしないでください。」
- 「WordPressへの実投稿は、許可されたテスト先・下書き等の範囲でのみ実施してください。顧客の公開サイトへ勝手にテスト記事を公開しないでください。」
- 「本番反映は、既存の権限・承認済み手順が確認できる範囲で進める。不明な承認、追加費用、破壊的変更が必要なら、その操作の前で止めて具体的に確認する。」
- 「過去のテスト件数や過去の確認結果を、今回実施した結果として転記しないでください。未検証事項を「問題なし」「完了」と表現しないでください。また、相沢様へのメッセージ送信は行わず、下書きまでにしてください。」

これまでの作業でわかった注意点:

- アクセスコードやトークンの値は表示しない。新しいアクセスコードをチャットで尋ねない。
- 公開リポジトリに、本番のアクセスコードの状態や個人のアカウント名を書かない。
- 本番DBを直接クエリするのは、明示の承認がある範囲だけにする。範囲外のクエリは、自動の安全判定で止められる。
- ある場面の承認は、別の場面に引き継がれない。新しい変更を本番に出す前には確認する。
- ユーザーは PowerShell での操作を望んでいない（「そちらですべてやってくれませんか？すべて承認します」）。セッション内でできることは、セッション内で行う。

## 5. 環境メモ

- クラウド環境: 「**aio**」で開始すること。
  - Vercel と Supabase の管理用トークンは、この環境のネットワークシークレットとして保存されている。
  - ダミーの `Authorization: Bearer ...` を付けると、プロキシが本物に差し替える。値を扱う必要はない。
  - 許可ホストには `aio-article-generator.vercel.app` と `npdyfhqugniuxfxpgngh.supabase.co` が含まれる。
- Node 24: `export PATH=/opt/node24/bin:$PATH`
- 品質ゲート（CLAUDE.md）: `npm run lint`、`npm run typecheck`、`npm run test`、`npm run test:integrity`、`npm run test:coverage`、`npm run test:contract`、`npm run build`。
  - pre-commit フックは lint と test:integrity を実行する。
- E2E:
  - コンテナの Chromium を使うローカル設定 `.verification-files/playwright.local.config.ts` は git で無視されているため、新しいコンテナにはない。付録Cの内容で作り直す。
  - 実行コマンド: `npx playwright test -c .verification-files/playwright.local.config.ts --trace off`（一部だけなら `--project=chromium-pc -g "<名前>"`）。
  - webServer は `npm run build && npm run start` で起動するため、E2E の実行がビルドの確認も兼ねる。
- test:integrity の癖: テスト本文の中のコメントにアポストロフィ（`'`）があると、括弧の対応づけが崩れる。その結果「does not appear to contain an assertion」と誤検出される。コメントでは `article's` などを避ける。
- 外部ホストへの Node の `fetch` には `NODE_USE_ENV_PROXY=1` が必要。本番を Playwright で開くときは、次のように起動する。

  ```js
  chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY } })
  ```

- 前景の `sleep` は使えない。待つときは `run_in_background` のループか Monitor を使う。
- 作業を終えるときに、未コミットの変更があると停止フックに止められる。commit と push を済ませておく。
- Vercel プロジェクトは GitHub と連携していない。main へのマージだけでは本番は変わらず、反映は §3.4 の手順で行う。

## 6. 所有者側の残作業（このセッションでは行わない）

- PR #59 の反映後に、ログインして WordPress に接続し、「投稿先」にコラムが出るかを確認する。
- コラムが出ない場合は、次の順で確かめる。
  - 「投稿先」欄のエラー表示
  - 接続ユーザーにコラムの編集権限があるか
  - サイト管理者に REST API 公開（`show_in_rest`）を依頼する必要があるか
- 相沢様の共有ファイル（Google Drive）で、テスト時のエラー内容を確認する。このセッションからは開けなかった。
- 返信文を送付する（PR #59 の反映後。`docs/aizawa-nov24-wordpress-destination.md`）。
- 自分たちのテスト記事3件を削除する（承認後。対象は `AI_HANDOFF.md` §12）。
- 不要になった Vercel トークンを失効させ、二要素認証を設定する。
- 別セッションの PR #54・#55 をレビューする（このセッションの作業ではない）。

## 付録A: `vercel_release.py`

前のセッションで、読み取りの部分（`plan`、`status`、`alias`）は 06:0x UTC に実際に動かして確認した。現在の本番に対して `plan` は 208件、`status` は READY と全APIルート、`alias` は一致を返した。

`stage` と `promote` の中身は、11/17 と 11/24 の本番反映で使ったものと同じ処理である。チーム ID とプロジェクト ID は公開リポジトリに書かず、実行時にチーム slug から取得する形にした。

```python
#!/usr/bin/env python3
"""Release helper for aio-article-generator through the Vercel REST API.

Same as `vercel deploy --prod --skip-domain` followed by `vercel promote`. The Vercel CLI cannot be
used with the saved token (it fails reading the user). The session proxy replaces the placeholder
bearer token below with the token saved on the cloud environment "aio"; never put a real token here.

Run from the repository root, on a clean tree at the commit to release:
  python3 vercel_release.py plan             # upload list, compared with the current production deployment
  python3 vercel_release.py stage            # production build that no domain points to yet
  python3 vercel_release.py status DPL_ID    # readyState and a build-log summary
  python3 vercel_release.py promote DPL_ID   # point production and the canonical domain at it
  python3 vercel_release.py alias            # deployment behind the canonical domain
"""
import fnmatch, hashlib, json, os, subprocess, sys, urllib.error, urllib.request

API = "https://api.vercel.com"
TEAM_SLUG = "sl2026"
PROJECT = "aio-article-generator"
DOMAIN = "aio-article-generator.vercel.app"
AUTH = {"Authorization": "Bearer proxyinjectedtoken000000"}
ROOT = os.getcwd()
CLI_DEFAULT_IGNORES = [".hg", ".git", ".gitmodules", ".svn", ".cache", ".next", ".now", ".vercel", ".npmignore",
                       ".dockerignore", ".gitignore", ".*.swp", ".DS_Store", ".wafpicke-*", ".lock-wscript",
                       ".env.local", ".env.*.local", ".venv", "npm-debug.log", "config.gypi", "node_modules",
                       "__pycache__", "venv", "CVS"]


def call(method, path, body=None, headers=None):
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method, headers={**AUTH, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            return err.code, json.loads(raw or b"{}")
        except ValueError:
            return err.code, {"raw": raw[:200].decode("utf-8", "replace")}


def project():
    status, res = call("GET", f"/v9/projects/{PROJECT}?slug={TEAM_SLUG}")
    assert status == 200, (status, res.get("error"))
    return res["id"], res["accountId"], (res.get("targets") or {}).get("production", {}).get("id")


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def upload_list():
    patterns = [l.strip() for l in open(os.path.join(ROOT, ".vercelignore"), encoding="utf-8")
                if l.strip() and not l.startswith("#")]

    def ignored(path):
        parts = path.split("/")
        for pat in CLI_DEFAULT_IGNORES + patterns:
            p = pat.rstrip("/")
            if "/" in p.lstrip("/"):
                p = p.lstrip("/")
                if path == p or path.startswith(p + "/") or fnmatch.fnmatch(path, p):
                    return True
            elif any(fnmatch.fnmatch(part, p) for part in parts):
                return True
        return False

    tracked = git("ls-files", "-z").split("\0")
    files = {}
    for rel in sorted(f for f in tracked if f and not ignored(f)):
        content = open(os.path.join(ROOT, rel), "rb").read()
        files[rel] = (hashlib.sha1(content).hexdigest(), content, os.stat(os.path.join(ROOT, rel)).st_mode)
    return files


def deployed_sources(deployment_id, team_id):
    status, tree = call("GET", f"/v6/deployments/{deployment_id}/files?teamId={team_id}")
    assert status == 200, (status, tree)
    out = {}

    def walk(nodes, prefix):
        for node in nodes:
            path = f"{prefix}{node['name']}"
            if node.get("type") == "directory":
                walk(node.get("children") or [], path + "/")
            elif node.get("type") == "file":
                out[path] = node.get("uid")

    for top in tree:
        if top.get("name") == "src":
            walk(top.get("children") or [], "")
    return out


def plan():
    _, team_id, production_id = project()
    files = upload_list()
    before = deployed_sources(production_id, team_id)
    added = sorted(set(files) - set(before))
    removed = sorted(set(before) - set(files))
    changed = sorted(f for f in set(files) & set(before) if files[f][0] != before[f])
    print(json.dumps({"head": git("rev-parse", "--short", "HEAD"), "dirty": git("status", "--porcelain") != "",
                      "files": len(files), "production": production_id, "productionFiles": len(before),
                      "added": added, "removed": removed, "changed": changed}, ensure_ascii=False, indent=1))


def stage():
    project_id, team_id, production_id = project()
    if git("status", "--porcelain"):
        sys.exit("The working tree is not clean; release only a committed tree.")
    files = upload_list()
    body = {
        "name": PROJECT, "project": project_id, "target": "production", "autoAssignCustomDomains": False,
        "files": [{"file": rel, "sha": sha, "size": len(content), "mode": mode} for rel, (sha, content, mode) in files.items()],
        "gitMetadata": {"commitSha": git("rev-parse", "HEAD"), "commitRef": "HEAD",
                        "commitMessage": git("log", "-1", "--format=%s"), "commitAuthorName": git("log", "-1", "--format=%an"),
                        "dirty": False, "remoteUrl": "https://github.com/kotakase2022-jpg/aio"},
    }
    blobs = {sha: content for sha, content, _ in files.values()}
    query = f"?teamId={team_id}&skipAutoDetectionConfirmation=1"
    for _ in range(3):
        status, res = call("POST", "/v13/deployments" + query, body, {"Content-Type": "application/json"})
        missing = (res.get("error") or {}).get("missing") if status == 400 else None
        if not missing:
            break
        for sha in missing:
            up, out = call("POST", f"/v2/files?teamId={team_id}", blobs[sha],
                           {"Content-Type": "application/octet-stream", "x-vercel-digest": sha,
                            "Content-Length": str(len(blobs[sha]))})
            assert up == 200, (up, out)
        print(f"uploaded {len(missing)} new file(s)", flush=True)
    if status not in (200, 201):
        sys.exit(json.dumps({"status": status, "error": res.get("error")}))
    print(json.dumps({"id": res.get("id"), "readyState": res.get("readyState"), "target": res.get("target"),
                      "commit": body["gitMetadata"]["commitSha"][:7], "files": len(files),
                      "rollbackTarget": production_id}))


def status(deployment_id):
    _, team_id, _ = project()
    st, dep = call("GET", f"/v13/deployments/{deployment_id}?teamId={team_id}")
    assert st == 200, (st, dep.get("error"))
    st, events = call("GET", f"/v3/deployments/{deployment_id}/events?teamId={team_id}&builds=1&limit=-1")
    lines = [((e.get("payload") or {}).get("text") or e.get("text") or "") for e in (events if isinstance(events, list) else [])]
    keep = [l for l in lines if any(k in l for k in ("Compiled", "Generating static pages", "Error", "error", "/api/wordpress", "Build Completed", "Deployment completed"))]
    print(json.dumps({"id": deployment_id, "readyState": dep.get("readyState"), "target": dep.get("target"),
                      "aliasAssigned": dep.get("aliasAssigned"), "commit": ((dep.get("meta") or {}).get("githubCommitSha") or "")[:7],
                      "logLines": len(lines), "highlights": keep[-25:]}, ensure_ascii=False, indent=1))


def promote(deployment_id):
    project_id, team_id, production_id = project()
    st, res = call("POST", f"/v10/projects/{project_id}/promote/{deployment_id}?teamId={team_id}", {}, {"Content-Type": "application/json"})
    print(json.dumps({"status": st, "previousProduction": production_id, "error": (res or {}).get("error")}))
    if not 200 <= st < 300:
        sys.exit(1)


def alias():
    _, team_id, production_id = project()
    st, res = call("GET", f"/v4/aliases/{DOMAIN}?teamId={team_id}")
    print(json.dumps({"status": st, "domain": DOMAIN, "aliasDeployment": res.get("deploymentId"), "projectProduction": production_id}))


if __name__ == "__main__":
    command, *args = sys.argv[1:] or ["plan"]
    {"plan": plan, "stage": stage, "status": status, "promote": promote, "alias": alias}[command](*args)
```

## 付録B: `post-release-noauth.mjs`（ログイン不要の確認）

PR #58 の反映後に使ったもの。古い既定コードはリポジトリ内の `src/app/api/demo-auth/route.ts` から読み、拒否されることだけを確かめる。値は出力しない。

```js
// Checks that need no sign-in: the login page, API protection (incl. the new route) and the old code.
import { readFile } from "node:fs/promises";
const base = "https://aio-article-generator.vercel.app";
const source = await readFile("/home/user/aio/src/app/api/demo-auth/route.ts", "utf8");
const oldCode = source.match(/DEFAULT_ACCESS_CODE = "([^"]+)"/)[1];
const page = await fetch(`${base}/demo-login`);
const html = await page.text();
const results = { loginPage: page.status, loginFormRendered: html.includes("demo-access-code") };
for (const [name, path, method] of [["logs", "/api/generation-logs", "GET"], ["postTypes", "/api/wordpress/post-types", "POST"], ["post", "/api/wordpress/post", "POST"]]) {
  const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
  results[`unauthenticated_${name}`] = res.status;
}
const login = await fetch(`${base}/api/demo-auth`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: oldCode }) });
results.oldDefaultCode = login.status;
console.log(JSON.stringify(results));
```

## 付録C: `.verification-files/playwright.local.config.ts`（git では無視される）

```ts
// Local-only override (ignored by git and Vercel): use the container's preinstalled Chromium
// because the project pins @playwright/test 1.61.1 (revision 1228) and the container ships 1243.
import base from "../playwright.config";
import path from "node:path";

const localConfig = {
  ...base,
  testDir: path.resolve(__dirname, "../tests/e2e"),
  outputDir: path.resolve(__dirname, "../test-results"),
  reporter: [["list"]] as [string][],
  use: {
    ...base.use,
    channel: undefined,
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
    trace: "off" as const,
    video: "off" as const,
  },
};

export default localConfig;
```
