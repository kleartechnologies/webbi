/**
 * Real, tiny image files for upload tests (made with macOS sips and checked to
 * open as images), plus files that only pretend to be images.
 */

const bytes = (base64: string) => new Uint8Array(Buffer.from(base64, "base64"));

/** 3 × 2 baseline JPEG with JFIF, Exif and Photoshop segments before the frame header. */
export const JPEG = bytes(
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAA6ADAAQAAAABAAAAAgAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAgADAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A8I8If8i1p/8A1yH8zXR1znhD/kWtP/65D+Zro6/hnHfx5+r/ADP9Gcx/3ip/if5n/9k=",
);

/** 3 × 2 RGB PNG. */
export const PNG = bytes("iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAFElEQVR4nGM4wcBwQoPhRACQgrEAOyQFoWbYy54AAAAASUVORK5CYII=");

/** 1 × 1 lossy WebP (VP8), the format the browser's resizer produces. */
export const WEBP = bytes("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");

/** 1 × 1 lossless WebP (VP8L). */
export const WEBP_LOSSLESS = bytes("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");

/** Extended WebP (VP8X) header for a 640 × 480 canvas; only the header matters to the checks. */
export function webpExtended(width = 640, height = 480): Uint8Array {
  const b = new Uint8Array(30);
  b.set(Buffer.from("RIFF"), 0);
  new DataView(b.buffer).setUint32(4, 22, true);
  b.set(Buffer.from("WEBPVP8X"), 8);
  new DataView(b.buffer).setUint32(16, 10, true);
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return b;
}

const text = (value: string) => new Uint8Array(Buffer.from(value, "utf8"));

export const SVG = text(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(document.domain)</script><rect width="10" height="10"/></svg>',
);
export const HTML = text("<!doctype html><html><body><script>fetch('/api/sites')</script></body></html>");

/** Deterministic noise: no image signature. */
export function randomBytes(length = 4096): Uint8Array {
  const b = new Uint8Array(length);
  let seed = 7;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    b[i] = seed & 0xff;
  }
  return b;
}

/** A JPEG signature followed by padding to `length` bytes: big enough to trip the size limit. */
export function oversizedJpeg(length: number): Uint8Array {
  const b = new Uint8Array(length);
  b.set(JPEG.subarray(0, JPEG.length - 2));
  b.set([0xff, 0xd9], length - 2);
  return b;
}
