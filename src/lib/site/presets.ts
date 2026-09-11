/**
 * Site visual presets from the Webbi design system. A site picks one preset;
 * the renderer exposes it as CSS variables (--site-accent, --site-font, …).
 */
export type PresetId = "warm" | "elegant" | "bold" | "trust" | "bright";

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  accent: string;
  accentAlt: string;
  ink: string;
  ground: string;
  line: string;
  muted: string;
  /** Dark hero treatment (bold preset). */
  heroDark: boolean;
  /** CSS font stack for the site's display face. */
  font: string;
  fontLabel: string;
}

export const PRESETS: Record<PresetId, Preset> = {
  warm: {
    id: "warm",
    label: "Warm",
    description: "Food, cafés, homely businesses",
    accent: "#B4472B",
    accentAlt: "#B4472B",
    ink: "#2B1F16",
    ground: "#FBF7F0",
    line: "#EADFD2",
    muted: "#6B5744",
    heroDark: false,
    font: "var(--font-lora), Georgia, serif",
    fontLabel: "Lora",
  },
  elegant: {
    id: "elegant",
    label: "Elegant",
    description: "Beauty, photography, boutiques",
    accent: "#A8546A",
    accentAlt: "#A8546A",
    ink: "#2E2226",
    ground: "#FBF6F4",
    line: "#EEDDE0",
    muted: "#6B545A",
    heroDark: false,
    font: "var(--font-marcellus), Georgia, serif",
    fontLabel: "Marcellus",
  },
  bold: {
    id: "bold",
    label: "Bold",
    description: "Cars, fitness, high-energy brands",
    accent: "#C62828",
    accentAlt: "#C62828",
    ink: "#15171C",
    ground: "#F4F5F7",
    line: "#E3E5EA",
    muted: "#5C616D",
    heroDark: true,
    font: "var(--font-barlow), 'Barlow', ui-sans-serif, system-ui, sans-serif",
    fontLabel: "Barlow",
  },
  trust: {
    id: "trust",
    label: "Trust",
    description: "Services, property, professionals",
    accent: "#1D5FD1",
    accentAlt: "#0E6B63",
    ink: "#142033",
    ground: "#F3F6FA",
    line: "#DFE6F0",
    muted: "#4B5A72",
    heroDark: false,
    font: "var(--font-jakarta), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    fontLabel: "Plus Jakarta Sans",
  },
  bright: {
    id: "bright",
    label: "Bright",
    description: "Tutors, retail, fresh and friendly",
    accent: "#157A5B",
    accentAlt: "#157A5B",
    ink: "#15261D",
    ground: "#F4F8F4",
    line: "#D8E5DC",
    muted: "#46594F",
    heroDark: false,
    font: "var(--font-jakarta), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    fontLabel: "Plus Jakarta Sans",
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** Inline style object that scopes a preset to a subtree. */
export function presetStyle(preset: Preset, accentOverride?: string): Record<string, string> {
  return {
    "--site-accent": accentOverride || preset.accent,
    "--site-accent-alt": preset.accentAlt,
    "--site-ink": preset.ink,
    "--site-ground": preset.ground,
    "--site-line": preset.line,
    "--site-muted": preset.muted,
    "--site-font": preset.font,
  };
}
