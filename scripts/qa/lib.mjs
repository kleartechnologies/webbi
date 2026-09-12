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

/**
 * Writes a simple "portrait" PNG (warm background, round face, dark shirt) so
 * the profile-photo upload can be exercised without shipping a real photo.
 */
export function writeAvatarPng(file, size = 320) {
  const rows = [];
  const cx = size / 2, cy = size * 0.42, r = size * 0.2;
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      let px = [0xf3, 0xe1, 0xc8];
      if (y > size * 0.68 && Math.abs(dx) < size * 0.34 - (y - size * 0.68) * 0.15) px = [0x2b, 0x3a, 0x67];
      if (dx * dx + dy * dy < r * r) px = [0xc9, 0x8a, 0x64];
      if (dx * dx + dy * dy < r * r * 0.55 && dy > -r * 0.1 && dy < r * 0.55) px = [0xb9, 0x7a, 0x56];
      row.push(...px);
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
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

/** The profile-photo <input type=file> on the Content step or the editor's Business tab. */
export async function profilePhotoInput(page) {
  const handle = await page.evaluateHandle(() =>
    document.querySelector("#profile-photo")?.parentElement?.parentElement?.querySelector("input[type=file]") ?? null,
  );
  const el = handle.asElement();
  if (!el) throw new Error("profile photo input not on the page");
  return el;
}
