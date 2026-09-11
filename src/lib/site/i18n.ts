import type { Language, OfferingKind } from "./schema";

/**
 * Chrome strings for the public site renderer (section fallbacks, buttons).
 * Content itself comes from the site JSON in the owner's language; these are
 * only the labels Webbi adds around it. "mixed" (Manglish) uses English chrome.
 */
const STRINGS = {
  en: {
    about: "About",
    gallery: "Gallery",
    reviews: "Reviews",
    faq: "Questions",
    location: "Location",
    hours: "Opening hours",
    contact: "Contact",
    contactBody: "Message us and we'll get back to you.",
    openMaps: "Open in Google Maps",
    call: "Call",
    whatsapp: "WhatsApp",
    chat: "Chat on WhatsApp",
    email: "Email",
    builtWith: "Built with",
    askAbout: "Ask about this",
    interested: "Hi, I'm interested in",
    hi: "Hi",
    exampleBanner: "This is an example Webbi.",
    buildYours: "Build yours",
    from: "From",
    closed: "Closed",
    kinds: {
      products: "Products",
      services: "Services",
      packages: "Packages",
      menu: "Menu",
      models: "Models",
      listings: "Listings",
      subjects: "Subjects",
      classes: "Classes",
      treatments: "Treatments",
    } satisfies Record<OfferingKind, string>,
  },
  ms: {
    about: "Tentang kami",
    gallery: "Galeri",
    reviews: "Ulasan",
    faq: "Soalan lazim",
    location: "Lokasi",
    hours: "Waktu operasi",
    contact: "Hubungi kami",
    contactBody: "Hantar mesej, kami akan balas secepat mungkin.",
    openMaps: "Buka di Google Maps",
    call: "Telefon",
    whatsapp: "WhatsApp",
    chat: "Chat di WhatsApp",
    email: "E-mel",
    builtWith: "Dibina dengan",
    askAbout: "Tanya tentang ini",
    interested: "Hi, saya berminat dengan",
    hi: "Hi",
    exampleBanner: "Ini contoh Webbi.",
    buildYours: "Bina milik anda",
    from: "Dari",
    closed: "Tutup",
    kinds: {
      products: "Produk",
      services: "Perkhidmatan",
      packages: "Pakej",
      menu: "Menu",
      models: "Model",
      listings: "Hartanah",
      subjects: "Subjek",
      classes: "Kelas",
      treatments: "Rawatan",
    } satisfies Record<OfferingKind, string>,
  },
} as const;

type Strings = (typeof STRINGS)["en"];
/** Widen the literal types so `ms` and `en` share one shape. */
export type SiteStrings = { [K in keyof Strings]: Strings[K] extends string ? string : Record<OfferingKind, string> };

export function siteStrings(language: Language): SiteStrings {
  return language === "ms" ? STRINGS.ms : STRINGS.en;
}
