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
            <section class="market-share-analysis"><p>Market share analysis article evidence should stay.</p></section>
            <section class="revenue-share"><p>Revenue share article evidence should stay.</p></section>
            <section class="newsletter-strategy"><p>Newsletter strategy article evidence should stay.</p></section>
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
    expect(text).toContain("Market share analysis article evidence should stay.");
    expect(text).toContain("Revenue share article evidence should stay.");
    expect(text).toContain("Newsletter strategy article evidence should stay.");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("Accept all cookies");
    expect(text).not.toContain("Home / Blog");
    expect(text).not.toContain("Share this article");
    expect(text).not.toContain("Follow us on social media");
    expect(text).not.toContain("Subscribe now");
    expect(text).not.toContain("Join our newsletter");
    expect(text).not.toContain("Decorative hidden label");
  });

  test("keeps XLSX rich text shared string indexes aligned", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      </Types>`,
    );
    zip.file(
      "xl/sharedStrings.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">
        <si><r><t>First </t></r><r><t>rich</t></r></si>
        <si><t>Second plain</t></si>
        <si><r><t>Third </t></r><r><t>rich value</t></r></si>
      </sst>`,
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="s"><v>0</v></c>
            <c r="A2" t="s"><v>1</v></c>
            <c r="A3" t="s"><v>2</v></c>
          </row>
        </sheetData>
      </worksheet>`,
    );
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const text = await extractAttachmentText({
      buffer,
      filename: "reference.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(text).toBe("First rich Second plain Third rich value");
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

  test("joins DOCX text runs inside the same paragraph without artificial line breaks", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `
        <w:document>
          <w:body>
            <w:p>
              <w:r><w:t>当社の支援現場では、</w:t></w:r>
              <w:r><w:t>一人親方の事務作業は</w:t></w:r>
              <w:r><w:t>LINE連絡と帳票不在が重なりやすい。</w:t></w:r>
            </w:p>
            <w:p>
              <w:r><w:t>承認者と締切を先に決めると手戻りが減る。</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `,
    );
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const text = await extractAttachmentText({
      buffer,
      filename: "field-notes.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(text).toContain(
      "当社の支援現場では、一人親方の事務作業はLINE連絡と帳票不在が重なりやすい。",
    );
    expect(text).toContain("承認者と締切を先に決めると手戻りが減る。");
    expect(text).not.toContain("当社の支援現場では、 一人親方");
  });

  test("joins PPTX and inline XLSX rich-text runs inside a single text object", async () => {
    const pptx = new JSZip();
    pptx.file(
      "ppt/slides/slide1.xml",
      `
        <p:sld>
          <p:cSld>
            <p:spTree>
              <p:sp>
                <p:txBody>
                  <a:p>
                    <a:r><a:t>競合LPは</a:t></a:r>
                    <a:r><a:t>価格訴求が強いが、</a:t></a:r>
                    <a:r><a:t>導入後の運用説明が薄い。</a:t></a:r>
                  </a:p>
                </p:txBody>
              </p:sp>
            </p:spTree>
          </p:cSld>
        </p:sld>
      `,
    );
    const pptxBuffer = Buffer.from(await pptx.generateAsync({ type: "uint8array" }));

    const pptxText = await extractAttachmentText({
      buffer: pptxBuffer,
      filename: "competitor.pptx",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    expect(pptxText).toContain("競合LPは価格訴求が強いが、導入後の運用説明が薄い。");
    expect(pptxText).not.toContain("競合LPは 価格訴求");

    const xlsx = new JSZip();
    xlsx.file(
      "xl/worksheets/sheet1.xml",
      `
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1">
              <c r="A1" t="inlineStr">
                <is>
                  <r><t>初回相談では</t></r>
                  <r><t>請求書と発注書の所在確認から始める。</t></r>
                </is>
              </c>
            </row>
          </sheetData>
        </worksheet>
      `,
    );
    const xlsxBuffer = Buffer.from(await xlsx.generateAsync({ type: "uint8array" }));

    const xlsxText = await extractAttachmentText({
      buffer: xlsxBuffer,
      filename: "field-notes.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(xlsxText).toContain("初回相談では請求書と発注書の所在確認から始める。");
    expect(xlsxText).not.toContain("初回相談では 請求書");
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

  test("rejects highly compressed Office XML before expanding it", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<w:document><w:body><w:p><w:r><w:t>${"A".repeat(8 * 1024 * 1024 + 1)}</w:t></w:r></w:p></w:body></w:document>`,
    );
    const buffer = Buffer.from(
      await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
    );

    await expect(
      extractAttachmentText({
        buffer,
        filename: "compressed.docx",
      }),
    ).rejects.toMatchObject({
      status: 413,
      message: "Officeファイルの展開後サイズが大きすぎます。",
    });
  });

  test("enforces the actual streamed Office XML size when zip headers under-report it", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<w:document><w:body><w:p><w:r><w:t>${"B".repeat(8 * 1024 * 1024 + 1)}</w:t></w:r></w:p></w:body></w:document>`,
    );
    const generated = Buffer.from(
      await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
    );
    const forged = underReportZipUncompressedSizes(generated, 128);

    await expect(
      extractAttachmentText({
        buffer: forged,
        filename: "forged-size.docx",
      }),
    ).rejects.toMatchObject({
      status: 413,
      message: "Officeファイルの展開後サイズが大きすぎます。",
    });
  });
});

function underReportZipUncompressedSizes(buffer: Buffer, declaredSize: number) {
  const forged = Buffer.from(buffer);
  for (let offset = 0; offset <= forged.length - 28; offset += 1) {
    const signature = forged.readUInt32LE(offset);
    if (signature === 0x04034b50) {
      forged.writeUInt32LE(declaredSize, offset + 22);
    } else if (signature === 0x02014b50) {
      forged.writeUInt32LE(declaredSize, offset + 24);
    }
  }
  return forged;
}
