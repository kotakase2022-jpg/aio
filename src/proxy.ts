import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "aio_demo_auth";
const AUTH_COOKIE_VALUE = "demo-access-granted";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = request.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
  const isLoginRoute = pathname === "/demo-login";
  const isAuthApi = pathname.startsWith("/api/demo-auth");

  if (isAuthenticated) {
    if (isLoginRoute) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (isLoginRoute || isAuthApi) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return Response.json(
      { ok: false, error: "認証が必要です。アクセスコードを入力してください。" },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/demo-login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
