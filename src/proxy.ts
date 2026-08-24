import { NextResponse, type NextRequest } from "next/server";
import {
  DEMO_AUTH_COOKIE_NAME,
  verifyDemoSessionToken,
} from "@/lib/demo-session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = await verifyDemoSessionToken(
    request.cookies.get(DEMO_AUTH_COOKIE_NAME)?.value,
  ).catch(() => false);
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
