/**
 * Site templates from the approved Webbi template designs. A site picks one
 * (stored as `theme.preset`, see templates.ts); the renderer exposes its core
 * palette as CSS variables (--site-accent, --site-font, …) and each template's
 * own layout, type and surfaces come from src/components/site/skin.ts.
 */
export const PRESET_IDS = ["warm", "elegant", "bold", "trust", "bright"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  accent: string;
  /** A lighter accent for use on the template's dark surfaces. */
  accentAlt: string;
  ink: string;
  ground: string;
  line: string;
  muted: string;
  /** Dark hero treatment (Bold). */
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
    accent: "#9C4260",
    accentAlt: "#8A4A61",
    ink: "#2B2024",
    ground: "#F7F2EE",
    line: "#E4DAD4",
    muted: "#6E5F63",
    heroDark: false,
    font: "var(--font-marcellus), Georgia, serif",
    fontLabel: "Marcellus",
  },
  bold: {
    id: "bold",
    label: "Bold",
    description: "Cars, fitness, high-energy brands",
    accent: "#E62B18",
    accentAlt: "#FF4B33",
    ink: "#0A0E15",
    ground: "#F4F1EA",
    line: "#C9C3B6",
    muted: "#5A626D",
    heroDark: true,
    font: "var(--font-archivo), 'Archivo', ui-sans-serif, system-ui, sans-serif",
    fontLabel: "Archivo",
  },
  trust: {
    id: "trust",
    label: "Trust",
    description: "Services, property, professionals",
    accent: "#256B8E",
    accentAlt: "#6E8B78",
    ink: "#172A3A",
    ground: "#F7F8F6",
    line: "#DCE3E2",
    muted: "#5E7180",
    heroDark: false,
    font: "var(--font-jakarta), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    fontLabel: "Plus Jakarta Sans",
  },
  bright: {
    id: "bright",
    label: "Bright",
    description: "Tutors, classes, fresh and friendly",
    accent: "#24323D",
    accentAlt: "#8CC9E8",
    ink: "#24323D",
    ground: "#FFFDF7",
    line: "#EFE8DA",
    muted: "#5A6A75",
    heroDark: false,
    font: "var(--font-jakarta), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    fontLabel: "Plus Jakarta Sans",
  },
};

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
