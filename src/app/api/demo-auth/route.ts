import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "aio_demo_auth";
const AUTH_COOKIE_VALUE = "demo-access-granted";
const DEFAULT_ACCESS_CODE = "202607";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const expectedCode = (process.env.DEMO_ACCESS_CODE || DEFAULT_ACCESS_CODE).trim();

  if (code !== expectedCode) {
    return NextResponse.json(
      { ok: false, error: "アクセスコードが違います。" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: AUTH_COOKIE_VALUE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
