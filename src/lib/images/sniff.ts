import type { UploadType } from "./limits";

/**
 * Identifies an uploaded image by its bytes. The file name and the declared
 * Content-Type are never trusted: only a JPEG, PNG or WebP whose header parses
 * down to real pixel dimensions is accepted. SVG, HTML, scripts and random
 * bytes have none of these signatures and are refused.
 *
 * This reads headers, not every pixel: a file with a valid image header and
 * junk after it would pass. It is stored with the detected image type and is
 * served from Firebase Storage's own domain, never from Webbi's.
 */

export interface SniffedImage {
  type: UploadType;
  width: number;
  height: number;
}

/** Larger than any photo Webbi needs (the browser sends at most 1600 px), small enough to refuse decompression bombs. */
export const MAX_IMAGE_EDGE = 10_000;

const ascii = (bytes: Uint8Array, at: number, text: string) =>
  bytes.length >= at + text.length && [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

function png(b: Uint8Array): Omit<SniffedImage, "type"> | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 33 || !signature.every((byte, i) => b[i] === byte)) return null;
  // The first chunk must be a 13-byte IHDR.
  if (u32be(b, 8) !== 13 || !ascii(b, 12, "IHDR")) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function jpeg(b: Uint8Array): Omit<SniffedImage, "type"> | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    // Markers without a length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // image data or end before any frame header
    const length = u16be(b, at + 2);
    if (length < 2) return null;
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (at + 9 > b.length) return null;
      return { height: u16be(b, at + 5), width: u16be(b, at + 7) };
    }
    at += 2 + length;
  }
  return null;
}

function webp(b: Uint8Array): Omit<SniffedImage, "type"> | null {
  if (b.length < 30 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  if (ascii(b, 12, "VP8 ")) {
    // Lossy: a key frame's start code, then 14-bit dimensions.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (ascii(b, 12, "VP8L")) {
    if (b[20] !== 0x2f) return null;
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(b, 12, "VP8X")) {
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

const READERS: [UploadType, (bytes: Uint8Array) => Omit<SniffedImage, "type"> | null][] = [
  ["image/jpeg", jpeg],
  ["image/png", png],
  ["image/webp", webp],
];

export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const sane = (edge: number) => Number.isInteger(edge) && edge > 0 && edge <= MAX_IMAGE_EDGE;
  for (const [type, read] of READERS) {
    const size = read(bytes);
    if (size) return sane(size.width) && sane(size.height) ? { type, ...size } : null;
  }
  return null;
}
