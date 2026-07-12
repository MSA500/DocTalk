import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const BRAND_BG = [79, 70, 229, 255];
const BRAND_FG = [255, 255, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function createCanvas(width, height, fill = TRANSPARENT) {
  const data = Buffer.alloc(width * height * 4);
  const canvas = { width, height, data };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) setPixel(canvas, x, y, fill);
  }
  return canvas;
}

function setPixel(canvas, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const idx = (canvas.width * y + x) << 2;
  canvas.data[idx] = r;
  canvas.data[idx + 1] = g;
  canvas.data[idx + 2] = b;
  canvas.data[idx + 3] = a;
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function insideRoundedRect(px, py, w, h, r) {
  if (px < r && py < r) return dist(px, py, r, r) <= r;
  if (px >= w - r && py < r) return dist(px, py, w - r - 1, r) <= r;
  if (px < r && py >= h - r) return dist(px, py, r, h - r - 1) <= r;
  if (px >= w - r && py >= h - r) return dist(px, py, w - r - 1, h - r - 1) <= r;
  return true;
}

function fillRoundedRect(canvas, x0, y0, w, h, radius, color) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (insideRoundedRect(x, y, w, h, radius)) {
        setPixel(canvas, x0 + x, y0 + y, color);
      }
    }
  }
}

function fillRect(canvas, x0, y0, w, h, color, radius = 0) {
  if (radius > 0) {
    fillRoundedRect(canvas, x0, y0, w, h, radius, color);
    return;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) setPixel(canvas, x0 + x, y0 + y, color);
  }
}

// Same 4-bar mark as src/components/ui/Logo.tsx's variant="mark" SVG (viewBox
// 0 0 48 48), expressed as ratios so it rasterizes at any size and stays
// pixel-proportional to the real logo used in the header.
const LOGO_MARK_BARS = [
  { x: 12.5 / 48, y: 20.5 / 48, w: 4 / 48, h: 7 / 48 },
  { x: 19.5 / 48, y: 14 / 48, w: 4 / 48, h: 20 / 48 },
  { x: 26.5 / 48, y: 10.5 / 48, w: 4 / 48, h: 27 / 48 },
  { x: 33.5 / 48, y: 17 / 48, w: 4 / 48, h: 14 / 48 },
];
const LOGO_MARK_BAR_RADIUS_RATIO = 2 / 48;
const LOGO_MARK_BG_RADIUS_RATIO = 11.5 / 48;

function drawLogoMark(canvas, size, scale, color) {
  const offset = (size - size * scale) / 2;
  for (const bar of LOGO_MARK_BARS) {
    const w = bar.w * size * scale;
    const h = bar.h * size * scale;
    const x0 = Math.round(offset + bar.x * size * scale);
    const y0 = Math.round(offset + bar.y * size * scale);
    const radius = Math.max(1, Math.round((LOGO_MARK_BAR_RADIUS_RATIO * size * scale) / 2));
    fillRect(canvas, x0, y0, Math.round(w), Math.round(h), color, radius);
  }
}

const FONT_5X7 = {
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function drawBitmapText(canvas, text, x0, y0, pixelSize, color) {
  let cursorX = x0;
  for (const char of text.toUpperCase()) {
    const glyph = FONT_5X7[char] ?? FONT_5X7[" "];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === "1") {
          fillRect(canvas, cursorX + col * pixelSize, y0 + row * pixelSize, pixelSize, pixelSize, color);
        }
      }
    }
    cursorX += 6 * pixelSize;
  }
  return cursorX - 6 * pixelSize + 5 * pixelSize;
}

function toPngBuffer(canvas) {
  const png = new PNG({ width: canvas.width, height: canvas.height });
  canvas.data.copy(png.data);
  return PNG.sync.write(png);
}

function savePng(canvas, filename) {
  const buffer = toPngBuffer(canvas);
  writeFileSync(path.join(publicDir, filename), buffer);
  return buffer;
}

function makeAppIcon(size, { maskable = false } = {}) {
  const canvas = createCanvas(size, size, TRANSPARENT);
  if (maskable) {
    fillRect(canvas, 0, 0, size, size, BRAND_BG, 0);
    // Android's maskable-icon safe zone is the center ~80% of the canvas.
    drawLogoMark(canvas, size, 0.62, BRAND_FG);
  } else {
    const radius = Math.round(size * LOGO_MARK_BG_RADIUS_RATIO);
    fillRoundedRect(canvas, 0, 0, size, size, radius, BRAND_BG);
    drawLogoMark(canvas, size, 1, BRAND_FG);
  }
  return canvas;
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dirEntries = [];
  const dataBuffers = [];
  let offset = 6 + entries.length * 16;

  for (const { size, buffer } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    dataBuffers.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...dataBuffers]);
}

const icon512 = makeAppIcon(512);
savePng(icon512, "icon-512.png");

const icon192 = makeAppIcon(192);
savePng(icon192, "icon-192.png");

const iconMaskable512 = makeAppIcon(512, { maskable: true });
savePng(iconMaskable512, "icon-maskable-512.png");

const appleTouchIcon = makeAppIcon(180);
savePng(appleTouchIcon, "apple-touch-icon.png");

const favicon32 = makeAppIcon(32);
savePng(favicon32, "favicon-32x32.png");

const favicon16 = makeAppIcon(16);
savePng(favicon16, "favicon-16x16.png");

const favicon48 = makeAppIcon(48);

const icoBuffer = buildIco([
  { size: 16, buffer: toPngBuffer(favicon16) },
  { size: 32, buffer: toPngBuffer(favicon32) },
  { size: 48, buffer: toPngBuffer(favicon48) },
]);
writeFileSync(path.join(publicDir, "favicon.ico"), icoBuffer);

const og = createCanvas(1200, 630, [15, 13, 33, 255]);
fillRect(og, 0, 0, 1200, 630, [15, 13, 33, 255]);
const ogMarkCanvas = { width: 1200, height: 630, data: og.data };
const ogMarkSize = 300;
const ogOffsetX = 600 - ogMarkSize / 2;
const ogOffsetY = 260 - ogMarkSize / 2;
for (const bar of LOGO_MARK_BARS) {
  const w = bar.w * ogMarkSize;
  const h = bar.h * ogMarkSize;
  const x0 = Math.round(ogOffsetX + bar.x * ogMarkSize);
  const y0 = Math.round(ogOffsetY + bar.y * ogMarkSize);
  const radius = Math.max(1, Math.round((LOGO_MARK_BAR_RADIUS_RATIO * ogMarkSize) / 2));
  fillRect(ogMarkCanvas, x0, y0, Math.round(w), Math.round(h), BRAND_FG, radius);
}
const text = "DOCTALK";
const pixelSize = 10;
const glyphAdvance = 6 * pixelSize;
const textWidth = text.length * glyphAdvance - pixelSize;
drawBitmapText(og, text, Math.round(600 - textWidth / 2), 430, pixelSize, BRAND_FG);
savePng(og, "og-image.png");

console.log("Icons generated in /public, matching src/components/ui/Logo.tsx's mark.");
