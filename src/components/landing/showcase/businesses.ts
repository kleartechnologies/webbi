import type { IconName } from "@/components/ui";
import type { CategoryId } from "@/lib/site/categories";
import { DEMO_SITES } from "@/lib/site/demo";
import type { PresetId } from "@/lib/site/presets";

export interface ShowcaseBusiness {
  /** Address shown in the mock browser; a live example when it is one of DEMO_SITES. */
  slug: string;
  name: string;
  template: PresetId;
  /** Picks the button label and icons, the same way a real site gets them. */
  category: CategoryId;
  nav: [string, string, string, string];
  kicker: string;
  headline: string;
  lede: string;
  secondary: { label: string; icon: IconName };
  features: [Feature, Feature, Feature];
  photo: { src: string; position?: string };
  /** Bright sites cycle the template's soft tints (see BRIGHT_TINTS). */
  tint?: number;
}

interface Feature {
  icon: IconName;
  title: string;
  line: string;
}

/**
 * Nine kinds of business, each shown the way its Webbi would look. Rasa Kampung,
 * Hafiz Rahman, Sereni and SejukTech are the shipped example sites (their
 * headlines match); the rest illustrate other categories. Everything here is
 * the example site's own content, so it stays put when the landing switches
 * language; the card subtitles and button captions live in i18n/copy.ts.
 */
export const BUSINESSES: ShowcaseBusiness[] = [
  {
    slug: "rasa-kampung",
    name: "Rasa Kampung",
    template: "warm",
    category: "restaurant",
    nav: ["Menu", "Waktu", "Lokasi", "Hubungi"],
    kicker: "Kedai makan · Kajang",
    headline: "Nasi lemak asli, rasa sebenar.",
    lede: "Santapan harian dengan bahan segar dan resipi turun-temurun.",
    secondary: { label: "Lihat Menu", icon: "restaurant_menu" },
    features: [
      { icon: "schedule", title: "Masak segar", line: "Setiap pagi" },
      { icon: "local_florist", title: "Resipi asli", line: "Turun-temurun" },
      { icon: "verified", title: "Halal & bersih", line: "Dapur terbuka" },
    ],
    photo: { src: "/demo/rasa-kampung/nasi-lemak.jpg", position: "50% 55%" },
  },
  {
    slug: "hafiz-rahman",
    name: "Hafiz Rahman",
    template: "bold",
    category: "car",
    nav: ["Models", "Promotions", "Trade-in", "Contact"],
    kicker: "Proton Sales Advisor",
    headline: "Your next Proton, sorted.",
    lede: "Best deals on the X50, X70, S70 and Saga. Trade-in, loan and delivery arranged for you.",
    secondary: { label: "WhatsApp Me", icon: "chat" },
    features: [
      { icon: "directions_car", title: "Every model", line: "X50, X70, S70, Saga" },
      { icon: "sync", title: "Trade-in", line: "Fair valuation" },
      { icon: "payments", title: "Loan sorted", line: "Approval arranged" },
    ],
    photo: { src: "/showcase/car.jpg", position: "58% 62%" },
  },
  {
    slug: "cikgu-amir",
    name: "Cikgu Amir",
    template: "bright",
    category: "tutor",
    nav: ["Classes", "Results", "Reviews", "Contact"],
    kicker: "SPM Add Maths · Ipoh",
    headline: "Maths made easier.",
    lede: "Small-group tuition with clear explanations, past-year practice and a teacher who replies.",
    secondary: { label: "WhatsApp Me", icon: "chat" },
    features: [
      { icon: "groups", title: "Small groups", line: "Max 8 students" },
      { icon: "task_alt", title: "Step by step", line: "Strong basics" },
      { icon: "school", title: "Exam-focused", line: "Past-year papers" },
    ],
    photo: { src: "/showcase/tutor.jpg", position: "62% 28%" },
    tint: 0,
  },
  {
    slug: "sereni",
    name: "Sereni",
    template: "elegant",
    category: "beauty",
    nav: ["Treatments", "Prices", "Reviews", "Visit"],
    kicker: "Bangsar · Women-only studio",
    headline: "Slow down. Glow up.",
    lede: "A calm studio in Bangsar for facials, lash extensions and brows.",
    secondary: { label: "Treatments", icon: "spa" },
    features: [
      { icon: "spa", title: "Facials", line: "From RM 140" },
      { icon: "visibility", title: "Lashes", line: "Classic & volume" },
      { icon: "brush", title: "Brows", line: "Shape & tint" },
    ],
    photo: { src: "/showcase/beauty-facial.jpg", position: "40% 50%" },
  },
  {
    slug: "sejuktech",
    name: "SejukTech",
    template: "trust",
    category: "homeServices",
    nav: ["Services", "Prices", "Areas", "Contact"],
    kicker: "Klang Valley · Same-day service",
    headline: "Aircond tak sejuk? We come today.",
    lede: "Service, repair and installation across the Klang Valley. Fixed prices, no surprise charges.",
    secondary: { label: "Call Us", icon: "call" },
    features: [
      { icon: "cleaning_services", title: "Servicing", line: "From RM 60" },
      { icon: "construction", title: "Repair", line: "Fast & reliable" },
      { icon: "home_repair_service", title: "Installation", line: "New units" },
    ],
    photo: { src: "/showcase/aircond-technician.jpg", position: "45% 50%" },
  },
  {
    slug: "studio-dua",
    name: "Studio Dua",
    template: "elegant",
    category: "photographer",
    nav: ["Packages", "Portfolio", "About", "Contact"],
    kicker: "Kuala Lumpur & beyond",
    headline: "Your story, beautifully told.",
    lede: "Natural, timeless wedding photography for couples who want to remember the day as it felt.",
    secondary: { label: "Portfolio", icon: "photo_library" },
    features: [
      { icon: "celebration", title: "Weddings", line: "Full-day coverage" },
      { icon: "local_florist", title: "Engagements", line: "Portrait sessions" },
      { icon: "photo_camera", title: "Events", line: "Special moments" },
    ],
    photo: { src: "/showcase/wedding.jpg" },
  },
  {
    slug: "teh-tarik",
    name: "Teh Tarik",
    template: "warm",
    category: "restaurant",
    nav: ["Menu", "Lokasi", "Waktu", "Hubungi"],
    kicker: "Kedai minum · Kajang",
    headline: "Teh tarik macam dulu-dulu.",
    lede: "Teh tarik kaw, roti bakar dan snek kegemaran rakyat Malaysia.",
    secondary: { label: "Lihat Menu", icon: "restaurant_menu" },
    features: [
      { icon: "restaurant", title: "Panas & sejuk", line: "Pilihan untuk semua" },
      { icon: "schedule", title: "Buka awal", line: "Dari 7 pagi" },
      { icon: "groups", title: "Suasana santai", line: "Singgah lepak" },
    ],
    photo: { src: "/showcase/tehtarik.jpg" },
  },
  {
    slug: "kedai-rina",
    name: "Kedai Rina",
    template: "bright",
    category: "retail",
    nav: ["Produk", "Koleksi", "Ulasan", "Hubungi"],
    kicker: "Butik online · Melaka",
    headline: "Gaya harian untuk anda.",
    lede: "Pakaian ringkas, selesa dan bergaya untuk wanita moden.",
    secondary: { label: "Lihat Koleksi", icon: "storefront" },
    features: [
      { icon: "shopping_bag", title: "Pakaian harian", line: "Selesa & bergaya" },
      { icon: "sell", title: "Set lengkap", line: "Mudah dipadankan" },
      { icon: "near_me", title: "Pos seluruh Malaysia", line: "Mudah & selamat" },
    ],
    photo: { src: "/showcase/boutique-rack.jpg", position: "50% 40%" },
    tint: 1,
  },
  {
    slug: "lim-and-co",
    name: "Lim & Co.",
    template: "trust",
    category: "professional",
    nav: ["Services", "About", "Resources", "Contact"],
    kicker: "Chartered accountants · JB",
    headline: "Your business, our support.",
    lede: "SST filing, bookkeeping and accounts for SMEs in Johor Bahru.",
    secondary: { label: "WhatsApp Us", icon: "chat" },
    features: [
      { icon: "receipt_long", title: "SST filing", line: "Accurate & on time" },
      { icon: "account_balance", title: "Bookkeeping", line: "Records in order" },
      { icon: "fact_check", title: "Advisory", line: "Plan your growth" },
    ],
    photo: { src: "/showcase/accounting.jpg" },
  },
];

/** True when the business is one of the shipped example sites served at /w/[slug]. */
export function isLive(b: ShowcaseBusiness): boolean {
  return b.slug in DEMO_SITES;
}
