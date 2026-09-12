import { describe, expect, it } from "vitest";
import { mapsQueryText, resolveLocation } from "../location";

const AMIR = "No. 9257C, Jalan Balakong, 43300 Balakong, Selangor (berdekatan kawasan Amerin Mall)";

describe("mapsQueryText", () => {
  it("drops bracketed asides and tidies punctuation so Maps gets the address itself", () => {
    expect(mapsQueryText(AMIR)).toBe("No. 9257C, Jalan Balakong, 43300 Balakong, Selangor");
    expect(mapsQueryText("12, Jalan Reko, 43000 Kajang, Selangor.")).toBe("12, Jalan Reko, 43000 Kajang, Selangor");
    expect(mapsQueryText("  Lot 2-3,\n Bangsar Village II,  59100 KL ")).toBe("Lot 2-3, Bangsar Village II, 59100 KL");
  });

  it("works for Malay, English, mixed and partial text", () => {
    expect(mapsQueryText("Kedai Kopi Pak Man, Seksyen 7 Shah Alam")).toBe("Kedai Kopi Pak Man, Seksyen 7 Shah Alam");
    expect(mapsQueryText("Balakong")).toBe("Balakong");
    expect(mapsQueryText("dekat Amerin Mall Balakong")).toBe("dekat Amerin Mall Balakong");
    expect(mapsQueryText("Proton Shah Alam")).toBe("Proton Shah Alam");
  });

  it("falls back to the plain text when stripping would leave nothing, and caps the length", () => {
    expect(mapsQueryText("(Amerin Mall)")).toBe("(Amerin Mall)");
    expect(mapsQueryText("   ")).toBe("");
    expect(mapsQueryText("a".repeat(500))).toHaveLength(240);
  });
});

describe("resolveLocation", () => {
  const business = { address: undefined as string | undefined, area: "Balakong" };

  it("uses the full address first, as a precise location, with a real Google Maps search", () => {
    const place = resolveLocation({ address: AMIR, mapsQuery: "Balakong" }, business);
    expect(place).not.toBeNull();
    expect(place!.precise).toBe(true);
    expect(place!.label).toBe(AMIR);
    expect(place!.href).toBe(
      "https://www.google.com/maps/search/?api=1&query=No.%209257C%2C%20Jalan%20Balakong%2C%2043300%20Balakong%2C%20Selangor",
    );
    expect(place!.embedSrc).toBe("https://www.google.com/maps?q=No.%209257C%2C%20Jalan%20Balakong%2C%2043300%20Balakong%2C%20Selangor&output=embed");
  });

  it("falls back to the business address, then the Maps query, then the area — never precise", () => {
    expect(resolveLocation({}, { address: "12, Jalan Reko, Kajang" })).toMatchObject({ precise: true, label: "12, Jalan Reko, Kajang" });
    expect(resolveLocation({ mapsQuery: "Proton Shah Alam" }, business)).toMatchObject({
      precise: false,
      label: "Proton Shah Alam",
      href: "https://www.google.com/maps/search/?api=1&query=Proton%20Shah%20Alam",
    });
    expect(resolveLocation({}, business)).toMatchObject({ precise: false, label: "Balakong" });
    expect(resolveLocation(undefined, business)).toMatchObject({ precise: false, label: "Balakong" });
  });

  it("returns null when there is nothing to point at", () => {
    expect(resolveLocation({}, {})).toBeNull();
    expect(resolveLocation({ address: "  ", mapsQuery: "" }, { area: " " })).toBeNull();
  });

  it("only ever produces google.com/maps destinations, whatever the owner typed", () => {
    for (const text of ["javascript:alert(1)", "https://evil.example/?x", "<script>alert(1)</script>", "data:text/html,hi"]) {
      const place = resolveLocation({ address: text }, {});
      expect(place!.href.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
      expect(place!.embedSrc.startsWith("https://www.google.com/maps?q=")).toBe(true);
      expect(place!.href).not.toContain("<");
      expect(place!.embedSrc).not.toContain("<");
    }
  });
});
