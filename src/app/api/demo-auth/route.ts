import { NextResponse } from "next/server";
import {
  createDemoSessionToken,
  DEMO_AUTH_COOKIE_NAME,
  DEMO_SESSION_MAX_AGE_SECONDS,
} from "@/lib/demo-session";

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

  let sessionToken: string;
  try {
    sessionToken = await createDemoSessionToken();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "認証設定に不備があります。管理者に連絡してください。",
      },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DEMO_AUTH_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DEMO_AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
