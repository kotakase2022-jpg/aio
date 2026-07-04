import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { saveDraft } from "@/lib/server/drafts";
import { errorJson, okJson } from "@/lib/server/http";
import type { ArticleDraft } from "@/types/aio";

export const runtime = "nodejs";

const schema = z.object({ draft: z.record(z.string(), z.unknown()) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const draft = body.draft as ArticleDraft;
    const cleanDraft: ArticleDraft = {
      ...draft,
      editedBodyHtml: sanitizeHtml(draft.editedBodyHtml, {
        allowedTags: [
          "h1",
          "h2",
          "h3",
          "p",
          "a",
          "ul",
          "ol",
          "li",
          "strong",
          "em",
          "blockquote",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "figure",
          "figcaption",
          "img",
          "br",
          "hr",
          "section",
          "div",
        ],
        allowedAttributes: {
          a: ["href", "title", "target", "rel"],
          img: ["src", "alt", "title"],
          figure: ["data-image-slot", "data-image-id"],
          div: ["class"],
          section: ["class"],
        },
        allowedSchemes: ["http", "https", "data"],
      }),
      updatedAt: new Date().toISOString(),
    };
    const result = await saveDraft(cleanDraft);
    return okJson(result);
  } catch (error) {
    return errorJson(error);
  }
}
