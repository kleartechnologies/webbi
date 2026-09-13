import {
  Archivo,
  Bricolage_Grotesque,
  IBM_Plex_Mono,
  Lora,
  Marcellus,
  Plus_Jakarta_Sans,
} from "next/font/google";

// App faces: preloaded on every page.
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Site template faces: declared globally, downloaded only when a site uses them.
export const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  preload: false,
});

export const marcellus = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-marcellus",
  display: "swap",
  preload: false,
});

/** Bold: one variable file with the width axis the design stretches its headings on. */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  preload: false,
});

/** Trust: labels, prices and phone numbers. */
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  bricolage.variable,
  jakarta.variable,
  lora.variable,
  marcellus.variable,
  archivo.variable,
  plexMono.variable,
].join(" ");
