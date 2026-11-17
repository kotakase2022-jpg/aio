import { NextResponse } from "next/server";
import { readAuthUsers } from "@/lib/server/auth-users";
import {
  createSessionToken,
  RETIRED_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/server/auth-session";
import {
  EMAIL_MAX_LENGTH,
  normalizeEmail,
  rejectUnknownAccount,
  verifyPassword,
} from "@/lib/server/login-credentials";

export const runtime = "nodejs";

const CONFIGURATION_ERROR = "認証設定に不備があります。管理者に連絡してください。";
const MISSING_INPUT_ERROR = "メールアドレスとパスワードを入力してください。";
const INVALID_CREDENTIALS_ERROR = "メールアドレスまたはパスワードが違います。";

/** Log in with an email and password listed in AIO_AUTH_USERS. */
export async function POST(request: Request) {
  const accounts = readAuthUsers();
  if (!accounts.ok) {
    // Fail closed: without valid accounts nobody can log in. The reason names no account.
    console.error(`Login is unavailable: ${accounts.reason}`);
    return failure(CONFIGURATION_ERROR, 500);
  }

  const parsed: unknown = await request.json().catch(() => null);
  // Valid JSON need not be an object (`null`, a number, a string); all of those carry no input.
  const body: { email?: unknown; password?: unknown } =
    parsed !== null && typeof parsed === "object" ? parsed : {};
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  // New passwords never start or end with a space, so trimming only forgives a pasted one.
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (!email || !password) {
    return failure(MISSING_INPUT_ERROR, 400);
  }
  // No account has a longer email. The password length is checked by verifyPassword after
  // normalization, the same way the account script checks a new password.
  if (email.length > EMAIL_MAX_LENGTH) {
    return failure(INVALID_CREDENTIALS_ERROR, 401);
  }

  const account = accounts.users.get(email);
  const authenticated = account
    ? await verifyPassword(password, account.passwordHash)
    : await rejectUnknownAccount(password);
  if (!account || !authenticated) {
    return failure(INVALID_CREDENTIALS_ERROR, 401);
  }

  let sessionToken: string;
  try {
    sessionToken = await createSessionToken(account);
  } catch {
    return failure(CONFIGURATION_ERROR, 500);
  }

  const response = NextResponse.json({ ok: true });
  setCookie(response, SESSION_COOKIE_NAME, sessionToken, SESSION_MAX_AGE_SECONDS);
  setCookie(response, RETIRED_SESSION_COOKIE_NAME, "", 0);
  return response;
}

/** Log out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  setCookie(response, SESSION_COOKIE_NAME, "", 0);
  setCookie(response, RETIRED_SESSION_COOKIE_NAME, "", 0);
  return response;
}

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function setCookie(response: NextResponse, name: string, value: string, maxAge: number) {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}
