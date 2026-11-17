import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/server/auth-session";

const LOGIN_PATH = "/login";
// The retired access-code screen. Old bookmarks land on the login screen with their return path.
const RETIRED_LOGIN_PATH = "/demo-login";
const SESSION_API_PATH = "/api/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === RETIRED_LOGIN_PATH) {
    return NextResponse.redirect(new URL(`${LOGIN_PATH}${search}`, request.url));
  }

  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  ).catch(() => null);
  const isLoginRoute = pathname === LOGIN_PATH;

  if (session) {
    if (isLoginRoute) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (isLoginRoute || pathname === SESSION_API_PATH) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json(
      { ok: false, error: "認証が必要です。ログインしてください。" },
      { status: 401 },
    );
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
