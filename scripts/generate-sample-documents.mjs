import { deflateRawSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(__dirname, "..", "samples");
mkdirSync(samplesDir, { recursive: true });

function wrapLines(text, maxChars) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(title, bodyText) {
  const lines = wrapLines(bodyText, 92);
  const contentParts = [`BT`, `/F1 16 Tf`, `50 740 Td`, `(${escapePdfText(title)}) Tj`, `/F1 11 Tf`, `0 -30 Td`];
  for (const line of lines) {
    contentParts.push(`(${escapePdfText(line)}) Tj`, `0 -16 Td`);
  }
  contentParts.push(`ET`);
  const stream = contentParts.join("\n");
  const streamBytes = Buffer.from(stream, "latin1");

  const objects = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const parts = [];
  parts.push(Buffer.from("%PDF-1.4\n", "latin1"));
  const offsets = [0];
  let cursor = parts[0].length;

  for (let i = 0; i < objects.length; i++) {
    const objBuf = Buffer.from(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`, "latin1");
    offsets.push(cursor);
    parts.push(objBuf);
    cursor += objBuf.length;
  }

  offsets.push(cursor);
  const streamObj = Buffer.concat([
    Buffer.from(`5 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`, "latin1"),
    streamBytes,
    Buffer.from("\nendstream\nendobj\n", "latin1"),
  ]);
  parts.push(streamObj);
  cursor += streamObj.length;

  const xrefOffset = cursor;
  const xrefLines = ["xref", `0 6`, "0000000000 65535 f "];
  for (let i = 1; i <= 5; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const xref = Buffer.from(xrefLines.join("\n") + "\n", "latin1");
  parts.push(xref);

  const trailer = Buffer.from(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    "latin1",
  );
  parts.push(trailer);

  return Buffer.concat(parts);
}

const pdfBuffer = buildPdf(
  "Acme Robotics - Expense Reimbursement Policy",
  `Effective Date: January 1, 2026\n\nAll employees may submit expense reports for business-related purchases through the Finance portal within 30 days of the purchase date. Reports submitted after 30 days require director approval before reimbursement.\n\nApproved categories include client travel, conference registration, team meals up to $40 per person, and software subscriptions under $200 per year that are not already covered by IT.\n\nReceipts are required for any single expense over $25. Expenses without a receipt will be reimbursed only with written manager approval, and are capped at $50 per incident.\n\nReimbursements are processed on the 15th and last business day of each month. Employees using a personal card for travel will be reimbursed at the standard mileage rate of $0.67 per mile for any driving beyond their normal commute.\n\nAlcohol is reimbursable only when directly tied to a client dinner and does not exceed $60 per person. Personal entertainment, gym memberships, and home office furniture beyond the standard $500 stipend are not reimbursable under this policy.\n\nQuestions about a specific expense should be directed to the Finance team before the purchase is made, not after submission.`,
);
writeFileSync(path.join(samplesDir, "expense-reimbursement-policy.pdf"), pdfBuffer);

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipEntry(name, content) {
  const nameBuf = Buffer.from(name, "utf-8");
  const compressed = deflateRawSync(content);
  const crc = crc32(content);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const local = Buffer.concat([localHeader, nameBuf, compressed]);

  return { name: nameBuf, crc, compressedSize: compressed.length, uncompressedSize: content.length, local };
}

function buildZip(files) {
  const entries = files.map(({ name, content }) => zipEntry(name, content));
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const localOffsets = [];

  for (const entry of entries) {
    localOffsets.push(offset);
    localParts.push(entry.local);
    offset += entry.local.length;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.compressedSize, 20);
    central.writeUInt32LE(entry.uncompressedSize, 24);
    central.writeUInt16LE(entry.name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffsets[i], 42);
    centralParts.push(Buffer.concat([central, entry.name]));
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirOffset = offset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildDocx(paragraphs) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  const bodyParagraphs = paragraphs
    .map((p) => {
      if (p.heading) {
        return `<w:p><w:pPr><w:b/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r></w:p>`;
      }
      return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r></w:p>`;
    })
    .join("\n");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParagraphs}
    <w:sectPr/>
  </w:body>
</w:document>`;

  return buildZip([
    { name: "[Content_Types].xml", content: Buffer.from(contentTypes, "utf-8") },
    { name: "_rels/.rels", content: Buffer.from(rootRels, "utf-8") },
    { name: "word/_rels/document.xml.rels", content: Buffer.from(documentRels, "utf-8") },
    { name: "word/document.xml", content: Buffer.from(documentXml, "utf-8") },
  ]);
}

const docxBuffer = buildDocx([
  { heading: true, text: "Acme Robotics - New Hire Onboarding Checklist" },
  { text: "Welcome to Acme Robotics. This checklist covers what new employees complete during their first two weeks." },
  { heading: true, text: "Week 1: Setup" },
  { text: "Day 1: IT provisions your laptop, email account, and Slack access before you arrive. Your manager will send a welcome message with your onboarding buddy's name." },
  { text: "Day 2: Complete mandatory compliance training in the HR portal, including workplace safety and data handling policies. This must be finished within your first five business days." },
  { text: "Day 3-5: Meet with your onboarding buddy daily. Set up your development environment following the engineering wiki's getting-started guide. Attend the new hire orientation session held every Wednesday at 10 AM." },
  { heading: true, text: "Week 2: Ramp-up" },
  { text: "Shadow at least two team meetings outside your immediate team to understand how departments coordinate. Schedule one-on-one introductions with your skip-level manager and three cross-functional partners." },
  { text: "By the end of week two, you should have submitted your first small pull request or completed equivalent hands-on task assigned by your manager, and set your 30-60-90 day goals together." },
  { heading: true, text: "Benefits Enrollment" },
  { text: "Health insurance, dental, and vision enrollment must be completed within 30 days of your start date through the benefits portal, or you will need to wait until the next open enrollment period. 401(k) enrollment has no deadline and can be updated at any time." },
  { heading: true, text: "Questions" },
  { text: "Direct onboarding questions to your assigned buddy first. For benefits or payroll questions, contact People Operations directly." },
]);
writeFileSync(path.join(samplesDir, "new-hire-onboarding-checklist.docx"), docxBuffer);

console.log("Sample documents generated in /samples");
