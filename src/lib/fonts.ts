import {
  Barlow,
  Bricolage_Grotesque,
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

// Site preset faces: declared globally, downloaded only when a site uses them.
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

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
  preload: false,
});

export const fontVariables = [
  bricolage.variable,
  jakarta.variable,
  lora.variable,
  marcellus.variable,
  barlow.variable,
].join(" ");
