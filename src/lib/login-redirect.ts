const BASE = "http://return-path.invalid";

/**
 * Where to go after logging in: a path on this site only. Resolving against a base also rejects the
 * forms browsers read as another host, such as `//host`, `/\host` or a path with an embedded tab.
 * The result is safe to check again (the login form does), because it never starts with `//`.
 */
export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  try {
    const url = new URL(value, BASE);
    // Dot segments can leave a path that starts with `//` (`/.//host/x` becomes `//host/x`), which a
    // browser, or a second check, reads as another host.
    if (url.origin !== BASE || url.pathname.startsWith("//")) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
