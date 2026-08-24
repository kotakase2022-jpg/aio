import sanitizeHtml from "sanitize-html";

export function sanitizeArticleHtml(html: string) {
  return sanitizeHtml(typeof html === "string" ? html : "", {
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
      "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      figure: ["data-image-slot", "data-image-id"],
      div: ["class"],
      section: ["class", "aria-label"],
      span: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    allowProtocolRelative: false,
    parser: { decodeEntities: false },
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        "a",
        { rel: "noopener noreferrer", target: "_blank" },
        true,
      ),
      img: (_tagName, attributes) => {
        const src = attributes.src ?? "";
        if (
          src.toLowerCase().startsWith("data:") &&
          !/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(src)
        ) {
          const safeAttributes = { ...attributes };
          delete safeAttributes.src;
          return { tagName: "img", attribs: safeAttributes };
        }
        return { tagName: "img", attribs: attributes };
      },
    },
  });
}
