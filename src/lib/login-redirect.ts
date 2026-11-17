const BASE = "http://return-path.invalid";

/**
 * Where to go after logging in: a path on this site only. Resolving against a base also rejects the
 * forms browsers read as another host, such as `//host`, `/\host` or a path with an embedded tab.
 */
export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  try {
    const url = new URL(value, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
