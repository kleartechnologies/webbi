import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import {
  buildQrDownload,
  canNativeShare,
  copyLink,
  dataUrlToBlob,
  qrAlt,
  qrFileName,
  qrPngDataUrl,
  qrSvg,
  QR_MARGIN,
  SHARE_TEXT,
  shareData,
  shareLink,
  shareTarget,
  type ShareTarget,
} from "../share";
import type { Site } from "../types";

function site(overrides: Partial<Site> = {}): Site {
  return {
    id: "Xk29fPq0aZ7firebaseId",
    ownerUid: "owner-1",
    status: "published",
    paid: true,
    slug: "amir-perodua-sales-advisor",
    draft: { business: { name: "Amir (Perodua Sales Advisor)" } },
    ...overrides,
  } as unknown as Site;
}

const TARGET: ShareTarget = {
  name: "Amir (Perodua Sales Advisor)",
  url: "https://webbi.online/w/amir-perodua-sales-advisor",
  slug: "amir-perodua-sales-advisor",
};

describe("shareTarget", () => {
  it("uses the canonical public website URL for a published site", () => {
    expect(shareTarget(site())).toEqual(TARGET);
  });

  it("never points at the dashboard, editor or a Firebase id", () => {
    const { url } = shareTarget(site())!;
    expect(url).not.toMatch(/dashboard|\/s\/|edit|firebase|netlify|Xk29fPq0aZ7firebaseId/i);
    expect(url.startsWith("https://webbi.online/w/")).toBe(true);
  });

  it("refuses drafts, unpublished sites and sites without a link", () => {
    expect(shareTarget(site({ status: "draft" }))).toBeNull();
    expect(shareTarget(site({ status: "draft", slug: null }))).toBeNull();
    expect(shareTarget(site({ slug: null }))).toBeNull();
    expect(shareTarget(site({ status: "generating" as Site["status"] }))).toBeNull();
  });
});

describe("share wording", () => {
  it("builds share data from the site name and URL only", () => {
    expect(shareData(TARGET)).toEqual({ title: TARGET.name, text: SHARE_TEXT, url: TARGET.url });
    expect(SHARE_TEXT).toBe("Check out my website");
  });

  it("describes the QR code for screen readers", () => {
    expect(qrAlt(TARGET)).toBe("QR code for Amir (Perodua Sales Advisor) website");
  });
});

describe("qrFileName", () => {
  it("names downloads after the business", () => {
    expect(qrFileName(TARGET, "png")).toBe("amir-perodua-sales-advisor-qr.png");
    expect(qrFileName(TARGET, "svg")).toBe("amir-perodua-sales-advisor-qr.svg");
  });

  it("strips unsafe characters and path tricks", () => {
    const name = qrFileName({ ...TARGET, name: '../../etc/pass wd<script>"Kedai" Ah Seng?*' }, "png");
    expect(name).toMatch(/^[a-z0-9-]+-qr\.png$/);
    expect(name).not.toMatch(/[\/\\<>"?*:]|\.\./);
    expect(name.split(".")).toHaveLength(2);
  });

  it("falls back to the slug, then a generic name", () => {
    expect(qrFileName({ ...TARGET, name: "咖啡店" }, "svg")).toBe("amir-perodua-sales-advisor-qr.svg");
    expect(qrFileName({ ...TARGET, name: "!!!", slug: "" }, "png")).toBe("website-qr.png");
  });
});

/** Reads the dark modules back out of qrcode's SVG path, so the test checks what the file encodes. */
function svgModules(svg: string): { size: number; dark: Set<string> } {
  const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!;
  const size = Number(viewBox[1]);
  const d = /<path[^>]*stroke="#000000"[^>]*d="([^"]+)"/.exec(svg)![1];
  const dark = new Set<string>();
  let x = 0;
  let y = 0;
  for (const [, cmd, a, b] of d.matchAll(/([MmHhVv])(-?\d+)(?:\s(-?\d+))?/g)) {
    const n = Number(a);
    if (cmd === "M") {
      x = n;
      y = Number(b);
    } else if (cmd === "m") {
      x += n;
      y += Number(b);
    } else if (cmd === "h") {
      for (let i = 0; i < n; i++) dark.add(`${x + i},${Math.floor(y)}`);
      x += n;
    }
  }
  return { size, dark };
}

describe("QR code", () => {
  it("SVG is a true vector of the exact public URL, with a quiet zone", async () => {
    const svg = await qrSvg(QRCode, TARGET.url);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<image|data:image/);
    expect(svg).toContain('fill="#ffffff"');

    const expected = QRCode.create(TARGET.url, { errorCorrectionLevel: "M" }).modules;
    const { size, dark } = svgModules(svg);
    expect(size).toBe(expected.size + QR_MARGIN * 2);
    for (let row = 0; row < expected.size; row++) {
      for (let col = 0; col < expected.size; col++) {
        const isDark = dark.has(`${col + QR_MARGIN},${row + QR_MARGIN}`);
        expect(isDark, `module ${col},${row}`).toBe(Boolean(expected.get(row, col)));
      }
    }
  });

  it("asks the library for the public URL, a quiet zone and black on white", async () => {
    const lib = { toString: vi.fn(async () => "<svg/>"), toDataURL: vi.fn(async () => "data:image/png;base64,AA==") };
    await qrSvg(lib as never, TARGET.url);
    await qrPngDataUrl(lib as never, TARGET.url);
    for (const call of [lib.toString.mock.calls[0], lib.toDataURL.mock.calls[0]] as unknown as [string, Record<string, unknown>][]) {
      expect(call[0]).toBe(TARGET.url);
      expect(call[1]).toMatchObject({ margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
    }
    expect(lib.toString.mock.calls[0]).toMatchObject([TARGET.url, { type: "svg" }]);
    expect((lib.toDataURL.mock.calls[0] as unknown as [string, { width: number }])[1].width).toBeGreaterThanOrEqual(1200);
  });

  it("builds a PNG download and an SVG download with sanitized names", async () => {
    const png = await buildQrDownload(QRCode, TARGET, "png");
    expect(png.fileName).toBe("amir-perodua-sales-advisor-qr.png");
    expect(png.blob.type).toBe("image/png");
    const head = new Uint8Array(await png.blob.slice(0, 8).arrayBuffer());
    expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const svg = await buildQrDownload(QRCode, TARGET, "svg");
    expect(svg.fileName).toBe("amir-perodua-sales-advisor-qr.svg");
    expect(svg.blob.type).toBe("image/svg+xml");
    expect(await svg.blob.text()).toBe(await qrSvg(QRCode, TARGET.url));
  });

  it("decodes data URLs into blobs", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,aGVsbG8=");
    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("hello");
  });
});

describe("copyLink", () => {
  it("copies the exact URL", async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyLink(TARGET.url, { writeText })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(TARGET.url);
  });

  it("reports failure instead of throwing", async () => {
    expect(await copyLink(TARGET.url, { writeText: async () => Promise.reject(new Error("denied")) })).toBe("failed");
    expect(await copyLink(TARGET.url, undefined)).toBe("failed");
  });
});

describe("shareLink", () => {
  it("opens the native share sheet with the public URL", async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    expect(await shareLink(TARGET, { share, clipboard: { writeText } })).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: TARGET.name, text: SHARE_TEXT, url: TARGET.url });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does nothing more when the owner closes the share sheet", async () => {
    const writeText = vi.fn(async () => {});
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    const result = await shareLink(TARGET, { share: async () => Promise.reject(abort), clipboard: { writeText } });
    expect(result).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the link when Web Share is unsupported", async () => {
    const writeText = vi.fn(async () => {});
    expect(await shareLink(TARGET, { clipboard: { writeText } })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(TARGET.url);
  });

  it("copies the link when the browser can't share this data or the share fails", async () => {
    const writeText = vi.fn(async () => {});
    const share = vi.fn(async () => {});
    expect(await shareLink(TARGET, { share, canShare: () => false, clipboard: { writeText } })).toBe("copied");
    expect(share).not.toHaveBeenCalled();
    const broken = { share: async () => Promise.reject(new DOMException("nope", "NotAllowedError")), clipboard: { writeText } };
    expect(await shareLink(TARGET, broken)).toBe("copied");
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith(TARGET.url);
  });

  it("reports failure when neither sharing nor copying works", async () => {
    expect(await shareLink(TARGET, {})).toBe("failed");
    expect(await shareLink(TARGET, undefined)).toBe("failed");
  });

  it("detects Web Share support", () => {
    const data = shareData(TARGET);
    expect(canNativeShare(undefined, data)).toBe(false);
    expect(canNativeShare({}, data)).toBe(false);
    expect(canNativeShare({ share: async () => {} }, data)).toBe(true);
    expect(canNativeShare({ share: async () => {}, canShare: () => false }, data)).toBe(false);
  });
});
