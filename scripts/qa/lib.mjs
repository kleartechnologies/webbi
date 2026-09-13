// Shared helpers for the QA scripts (no dependencies beyond Node + puppeteer-core).
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Writes an 8-bit RGB PNG of w×h pixels, colouring each pixel with `pixel(x, y)` → [r, g, b]. */
function writePng(file, w, h, pixel) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(file, png);
  return file;
}

/**
 * Writes a simple "portrait" PNG (warm background, round face, dark shirt) so
 * the profile-photo upload can be exercised without shipping a real photo.
 */
export function writeAvatarPng(file, size = 320) {
  const cx = size / 2, cy = size * 0.42, r = size * 0.2;
  return writePng(file, size, size, (x, y) => {
    const dx = x - cx, dy = y - cy;
    let px = [0xf3, 0xe1, 0xc8];
    if (y > size * 0.68 && Math.abs(dx) < size * 0.34 - (y - size * 0.68) * 0.15) px = [0x2b, 0x3a, 0x67];
    if (dx * dx + dy * dy < r * r) px = [0xc9, 0x8a, 0x64];
    if (dx * dx + dy * dy < r * r * 0.55 && dy > -r * 0.1 && dy < r * 0.55) px = [0xb9, 0x7a, 0x56];
    return px;
  });
}

/**
 * Writes a landscape 16:9 "cover photo" PNG: a sky-to-ground gradient with a
 * sun and a centred dark block, so mobile cropping is visible in screenshots.
 */
export function writeCoverPng(file, w = 640, h = 360) {
  const sx = w * 0.78, sy = h * 0.28, sr = h * 0.12;
  return writePng(file, w, h, (x, y) => {
    const t = y / h;
    let px = t < 0.62 ? [0x6f + t * 0x50, 0xa8 + t * 0x30, 0xd8] : [0x3f, 0x8f - (t - 0.62) * 0x60, 0x4a];
    const dx = x - sx, dy = y - sy;
    if (dx * dx + dy * dy < sr * sr) px = [0xff, 0xd1, 0x5c];
    if (Math.abs(x - w / 2) < w * 0.12 && y > h * 0.4 && y < h * 0.75) px = [0x24, 0x1f, 0x1a];
    return px.map((c) => Math.max(0, Math.min(255, Math.round(c))));
  });
}

/** Writes a square "logo" PNG: a navy tile with a pale ring and a bold centre mark. */
export function writeLogoPng(file, size = 320) {
  const c = size / 2, ring = size * 0.36, ringW = size * 0.05;
  return writePng(file, size, size, (x, y) => {
    const d = Math.hypot(x - c, y - c);
    if (Math.abs(d - ring) < ringW) return [0xf6, 0xe7, 0xc1];
    if (Math.abs(x - c) < size * 0.07 && Math.abs(y - c) < size * 0.22) return [0xf6, 0xe7, 0xc1];
    return [0x14, 0x2b, 0x52];
  });
}

/**
 * The hidden <input type=file> behind an image upload card (#profile-photo,
 * #business-logo or #hero-image) on the Content step or the editor's Business tab.
 */
export async function imageInput(page, id) {
  const handle = await page.evaluateHandle(
    (sel) => document.querySelector(sel)?.closest("[data-image-field]")?.querySelector("input[type=file]") ?? null,
    `#${id}`,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`${id} upload input not on the page`);
  return el;
}

/** The profile-photo <input type=file> on the Content step or the editor's Business tab. */
export const profilePhotoInput = (page) => imageInput(page, "profile-photo");

/**
 * Creates a Webbi account and lands on the creation flow. Building is
 * account-first, so every QA run that enters /start has to sign up the way a
 * new visitor does: /signin?mode=create&next=/start → the form → /start.
 * Returns the credentials so a later step can sign back in as the same person.
 */
export async function signUp(page, base, { name = "QA Tester", email, password = "password123" } = {}) {
  const address = email || `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto(`${base}/signin?mode=create&next=%2Fstart`, { waitUntil: "load" });
  await page.waitForSelector("#auth-name", { timeout: 20000 });
  await page.type("#auth-name", name);
  await page.type("#auth-email", address);
  await page.type("#auth-password", password);
  await page.click("button[type=submit]");
  await page.waitForFunction(() => location.pathname === "/start", { timeout: 30000 });
  await page.waitForSelector("textarea", { timeout: 20000 });
  return { name, email: address, password };
}
