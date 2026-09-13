import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GoogleG } from "../GoogleG";

const svg = renderToStaticMarkup(<GoogleG />);
/** Google's four brand colours, in the order the mark is drawn. */
const BRAND = ["#EA4335", "#4285F4", "#FBBC05", "#34A853"];

describe("Google G", () => {
  it("is the official mark: four brand-coloured paths on Google's own 48×48 grid", () => {
    expect(svg).toContain('viewBox="0 0 48 48"');
    const fills = [...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]);
    expect(fills).toEqual(BRAND);
    expect(svg.match(/<path/g)).toHaveLength(4);
  });

  it("has no enclosing circle or drawn substitute — the G stands on its own", () => {
    expect(svg).not.toContain("<circle");
    expect(svg).not.toContain("<rect");
    expect(svg).not.toContain("gradient");
    expect(svg).not.toMatch(/border-radius|rounded-full/);
  });

  it("is decorative: the button already says “Continue with Google”", () => {
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).not.toContain("<title");
  });

  it("keeps its proportions wherever it is placed", () => {
    expect(renderToStaticMarkup(<GoogleG size={24} />)).toContain('width="24" height="24"');
    // A flex row must not squeeze it into an oval.
    expect(svg).toContain("flex:none");
  });
});

describe("the Continue with Google button", () => {
  const source = readFileSync(path.resolve(import.meta.dirname, "../../app/AuthForm.tsx"), "utf8");

  it("uses the official mark rather than an approximation of it", () => {
    expect(source).toContain("<GoogleG />");
    expect(source).not.toContain("conic-gradient");
    expect(source).toContain("Continue with Google");
  });
});
