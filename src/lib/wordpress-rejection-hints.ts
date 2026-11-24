// Shared by the server and the tests (no server-only imports here).

// November 24 (Aizawa): the site's server refused every request from the tool with 403, and the
// screen said only 「WordPressカテゴリーの検索に失敗しました。」. For the refusals a user can fix,
// the error detail now says what usually causes them and what to do.

export const WORDPRESS_UNAUTHORIZED_HINT =
  "WordPressにログインできませんでした（HTTP 401）。ユーザー名とApplication Passwordを確認し、入力し直して「保存」を押してください。通常のログインパスワードは使えません（Application Passwordは、WordPressの「ユーザー」→「プロフィール」で発行できます）。";

// A 403 carrying a WordPress REST error code: WordPress itself refused, usually for the user's role.
export const WORDPRESS_FORBIDDEN_BY_WORDPRESS_HINT =
  "WordPressが操作を拒否しました（HTTP 403）。接続したユーザーに、この操作の権限がない可能性があります。「編集者」以上の権限を持つユーザーでApplication Passwordを発行し、「保存」し直してください。";

// A 403 without one was refused before WordPress, by the server's security settings. Japanese hosts
// often restrict the REST API from overseas, and the tool's server is overseas.
export const WORDPRESS_FORBIDDEN_BY_SERVER_HINT =
  "WordPressのサーバーが、AIOツールからの接続を拒否しました（HTTP 403）。AIOツールのサーバーは海外にあるため、サーバーの海外からのアクセス制限で止められている可能性があります。レンタルサーバーの管理画面で、「国外アクセス制限」「海外アクセス制限」などのREST APIの項目を確認してください。WAFやセキュリティプラグインで止められている場合もあります。";

// The hint for a refused WordPress request, or undefined when the status has none.
export function wordpressRejectionHint(status: number, wordpressErrorCode?: string) {
  if (status === 401) return WORDPRESS_UNAUTHORIZED_HINT;
  if (status !== 403) return undefined;
  return wordpressErrorCode?.startsWith("rest_")
    ? WORDPRESS_FORBIDDEN_BY_WORDPRESS_HINT
    : WORDPRESS_FORBIDDEN_BY_SERVER_HINT;
}
