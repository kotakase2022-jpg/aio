import { z } from "zod";
import { ApiError, errorJson, okJson } from "@/lib/server/http";
import { saveWordpressConnection } from "@/lib/server/wordpress";

export const runtime = "nodejs";

const schema = z.object({
  siteUrl: z.string().url(),
  username: z.string().min(1),
  applicationPassword: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(
        "WordPress接続情報を確認してください。",
        400,
        wordpressValidationMessage(parsed.error),
      );
    }

    const connection = await saveWordpressConnection(parsed.data);
    return okJson({ connection });
  } catch (error) {
    return errorJson(error);
  }
}

function wordpressValidationMessage(error: z.ZodError) {
  const messages = error.issues.map((issue) => {
    const field = issue.path.join(".");
    if (field === "siteUrl") {
      return "WordPressサイトURLを正しいURL形式で入力してください。";
    }
    if (field === "username") {
      return "WordPressユーザー名を入力してください。";
    }
    if (field === "applicationPassword") {
      return "Application Passwordを入力してください。";
    }
    return issue.message;
  });

  return Array.from(new Set(messages)).join(" ");
}
