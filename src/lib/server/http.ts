import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status = 400, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function okJson<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true, ...data }, init);
}

export function errorJson(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      { ok: false, error: error.message, detail: error.detail },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        ok: false,
        error: "入力内容が不正です。",
        detail: error.issues.map((issue) => issue.message).join(" / "),
      },
      { status: 400 },
    );
  }

  const message =
    process.env.NODE_ENV === "production"
      ? "サーバー処理中にエラーが発生しました。時間をおいて再実行してください。"
      : error instanceof Error
        ? error.message
        : "Unexpected error";
  return Response.json({ ok: false, error: message }, { status: 500 });
}
