import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const outDir = path.join(process.cwd(), "tests", "fixtures", "files");

await mkdir(outDir, { recursive: true });

await Promise.all([
  writeFile(path.join(outDir, "sample.pdf"), createPdfFixture(), "binary"),
  writeFile(path.join(outDir, "sample.docx"), await createDocxFixture()),
  writeFile(path.join(outDir, "sample.pptx"), await createPptxFixture()),
  writeFile(path.join(outDir, "sample.xlsx"), await createXlsxFixture()),
]);

console.log(`Document fixtures written to ${outDir}`);

function createPdfFixture() {
  const text =
    "AIO PDF fixture content for extraction tests. The article source explains AI search optimization workflows and review steps.";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  ];
  const stream = `BT /F1 12 Tf 72 720 Td (${escapePdfLiteral(text)}) Tj ET`;
  objects.push(`5 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj`);

  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return output;
}

function escapePdfLiteral(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

async function createDocxFixture() {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>AIO DOCX fixture content for extraction tests.</w:t></w:r></w:p>
    <w:p><w:r><w:t>It contains a reference summary, target reader, and approval workflow notes.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createPptxFixture() {
  const zip = new JSZip();
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp><p:txBody><a:p><a:r><a:t>AIO PPTX fixture content for extraction tests.</a:t></a:r></a:p></p:txBody></p:sp>
      <p:sp><p:txBody><a:p><a:r><a:t>Slides describe competitor positioning and article structure.</a:t></a:r></a:p></p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createXlsxFixture() {
  const zip = new JSZip();
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>AIO XLSX fixture content for extraction tests.</t></si>
  <si><t>Keyword</t></si>
  <si><t>AI search optimization</t></si>
  <si><t>Intent</t></si>
  <si><t>Draft review and WordPress publishing</t></si>
</sst>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c></row>
    <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c></row>
  </sheetData>
</worksheet>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}
