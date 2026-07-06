import { describe, expect, test } from "vitest";
import JSZip from "jszip";
import { extractAttachmentText } from "@/lib/server/file-extraction";
import { ApiError } from "@/lib/server/http";

describe("extractAttachmentText", () => {
  test("extracts UTF-8 text and strips BOM", async () => {
    const text = await extractAttachmentText({
      buffer: Buffer.from("\uFEFFAIO reference text for extraction."),
      filename: "reference.txt",
      contentType: "text/plain",
    });

    expect(text).toBe("AIO reference text for extraction.");
  });

  test("keeps valid UTF-8 Japanese text as UTF-8", async () => {
    const text = await extractAttachmentText({
      buffer: Buffer.from(
        "AIO reference \u3042\u3044\u3046\u3048\u304a UTF-8 article field notes for extraction.",
      ),
      filename: "reference.txt",
      contentType: "text/plain",
    });

    expect(text).toContain("\u3042\u3044\u3046\u3048\u304a UTF-8 article field notes");
    expect(text).not.toContain("\u7e3a");
  });

  test("keeps mostly valid UTF-8 text when it contains one replacement marker", async () => {
    const text = await extractAttachmentText({
      buffer: Buffer.from(
        "AIO reference \u3042\u3044\u3046\u3048\u304a has one unknown \uFFFD marker in otherwise valid UTF-8 notes.",
      ),
      filename: "reference.txt",
      contentType: "text/plain",
    });

    expect(text).toContain("\u3042\u3044\u3046\u3048\u304a has one unknown \uFFFD marker");
    expect(text).not.toContain("\u7e3a");
  });

  test("extracts Shift_JIS text files without mojibake", async () => {
    const shiftJisJapanese = Buffer.from([
      0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4, 0x82, 0xa6, 0x82, 0xa8,
      0x20,
      0x82, 0xa0, 0x82, 0xa2, 0x82, 0xa4, 0x82, 0xa6, 0x82, 0xa8,
    ]);
    const buffer = Buffer.concat([
      Buffer.from("AIO reference "),
      shiftJisJapanese,
      Buffer.from(" field notes for extraction."),
    ]);

    const text = await extractAttachmentText({
      buffer,
      filename: "reference.txt",
      contentType: "text/plain",
    });

    expect(text).toContain("AIO reference あいうえお あいうえお field notes");
    expect(text).not.toContain("����");
  });

  test("extracts visible HTML metadata and body while ignoring scripts", async () => {
    const html = `
      <html>
        <head><title>AIO HTML</title><meta name="description" content="Reference description"></head>
        <body>
          <div class="cookie-consent">Accept all cookies</div>
          <nav class="breadcrumb">Home / Blog</nav>
          <main>
            <h1>Main heading</h1>
            <p>Useful article body text for AIO.</p>
            <section class="social-insurance"><p>Social insurance article evidence should stay.</p></section>
            <section class="subscription-pricing"><p>Subscription pricing article evidence should stay.</p></section>
            <div class="share-buttons">Share this article</div>
            <div class="social-links">Follow us on social media</div>
            <div class="subscribe-box">Subscribe now</div>
            <div class="newsletter-subscribe">Join our newsletter</div>
            <div aria-hidden="true">Decorative hidden label</div>
          </main>
          <script>secret()</script>
        </body>
      </html>
    `;

    const text = await extractAttachmentText({
      buffer: Buffer.from(html),
      filename: "reference.html",
      contentType: "text/html",
    });

    expect(text).toContain("AIO HTML");
    expect(text).toContain("Reference description");
    expect(text).toContain("Useful article body text for AIO.");
    expect(text).toContain("Social insurance article evidence should stay.");
    expect(text).toContain("Subscription pricing article evidence should stay.");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("Accept all cookies");
    expect(text).not.toContain("Home / Blog");
    expect(text).not.toContain("Share this article");
    expect(text).not.toContain("Follow us on social media");
    expect(text).not.toContain("Subscribe now");
    expect(text).not.toContain("Join our newsletter");
    expect(text).not.toContain("Decorative hidden label");
  });

  test("decodes mixed-case and numeric XML entities from Office documents", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `
        <w:document>
          <w:body>
            <w:p>
              <w:r>
                <w:t>AIO DOCX reference &AMP; decimal &#038; hex &#x26; quoted &QUOT;field&QUOT; apostrophe &#x27;case&#x27; smart &ldquo;quote&rdquo; dash &ndash; and &#x2014; angle &LT;signal&GT; spacing&nbsp;kept &#160;and &#xA0;normalized text.</w:t>
              </w:r>
            </w:p>
          </w:body>
        </w:document>
      `,
    );
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const text = await extractAttachmentText({
      buffer,
      filename: "reference.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(text).toContain(
      'AIO DOCX reference & decimal & hex & quoted "field" apostrophe \'case\' smart "quote" dash - and - angle <signal> spacing kept and normalized text.',
    );
  });

  test("rejects empty and unsupported files with ApiError", async () => {
    await expect(
      extractAttachmentText({
        buffer: Buffer.alloc(0),
        filename: "empty.txt",
      }),
    ).rejects.toMatchObject({ name: "ApiError", status: 400 });

    await expect(
      extractAttachmentText({
        buffer: Buffer.from("name,value\nAIO,1"),
        filename: "input.csv",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
