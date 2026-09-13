/**
 * Every word on the marketing landing, in English (the source of truth) and
 * Bahasa Melayu. Both dictionaries have the same shape; the landing's copy
 * test holds them to it, and qa:landing checks nothing is left behind when
 * the visitor switches.
 *
 * Not in here, on purpose: the example websites drawn inside the previews
 * (src/lib/site/demo.ts, showcase/businesses.ts). They are customer content
 * and read the same in either language. Proper names, template names (Warm,
 * Bold…), prices and addresses stay as they are.
 *
 * Kept free of runtime imports so node scripts can read it directly.
 */
import type { CategoryId } from "@/lib/site/categories";

export type LandingLang = "en" | "ms";

/** The categories the showcase cards use, keyed for their button captions. */
type ShowcaseCategory = Extract<CategoryId, "restaurant" | "car" | "tutor" | "beauty" | "homeServices" | "photographer" | "retail" | "professional">;

const en = {
  language: {
    group: "Language",
    en: "English (EN)",
    ms: "Bahasa Melayu (BM)",
  },
  nav: {
    how: "How it works",
    examples: "Examples",
    pricing: "Pricing",
    signIn: "Sign in",
    dashboard: "Dashboard",
    home: "Webbi home",
  },
  cta: {
    create: "Create My Website",
    dockOnce: (price: string) => `${price} once`,
  },
  hero: {
    titleLead: "Tell us what you do.",
    titleRest: "We'll build your website.",
    lede: "Professional websites for businesses, creators and salespeople. No hassle.",
    how: "See How It Works",
    checks: (price: string) => [`${price}, one time`, "No subscription", "WhatsApp-ready"],
    caption: "Example Webbi · Rasa Kampung, built from one description",
    priceChip: (price: string) => `${price} · one time`,
    whatsappChip: "Order on WhatsApp",
  },
  prompt: {
    /** The description the hero and the watch-it-happen panel type out. */
    text: "I run a nasi lemak shop in Kajang. Customers usually order through WhatsApp.",
    question: "What do you do?",
    working: "Building your website…",
    done: "Your website is ready",
  },
  strip: ["One description in, one website out", "English & Bahasa Melayu", "WhatsApp as your front door", "Published on webbi.online"],
  moment: {
    eyebrow: "Watch it happen",
    titleLead: "One description.",
    titleRest: "One complete website.",
    youType: "You type",
    again: "Watch again",
    noForms: "No forms. No templates to pick.",
    reads: "Webbi reads it",
    understanding: "Understanding your business…",
    chips: ["Restaurant & F&B", "Kajang", "6 items mentioned", "Order on WhatsApp"],
    style: (label: string) => `${label} style`,
    written: "Menu, about, hours, location, reviews and your WhatsApp button. All written and laid out for you.",
    ready: "Website ready",
    publish: "You publish",
  },
  examples: {
    eyebrow: "Examples",
    title: "Built for what you do.",
    lede: "Every Webbi is laid out around one business. The words, the sections, the colours and the button all follow from what you sell.",
    tablist: "Example websites",
    tabs: [
      { label: "Restaurant & F&B", caption: "Rasa Kampung: menu, hours, location and an order button." },
      { label: "Car sales advisor", caption: "Hafiz Rahman: advisor profile, models, FAQ and a test-drive button." },
      { label: "Beauty & wellness", caption: "Sereni: services, price list, reviews and a booking button." },
    ],
    style: (label: string) => `${label} style`,
    open: "Open this example",
  },
  showcase: {
    title: "Nine kinds of business. One way to start.",
    lede: "A nasi lemak stall, a Proton advisor, a tutor, an accountant. Each Webbi gets the template, the words and the button that suit the business.",
    /** What and where, as each card heading shows it. Keyed by slug. */
    subs: {
      "rasa-kampung": "Nasi Lemak · Kajang",
      "hafiz-rahman": "Proton Advisor · Shah Alam",
      "cikgu-amir": "Maths Tuition · Ipoh",
      sereni: "Beauty Studio · Bangsar",
      sejuktech: "Aircond Service · Klang Valley",
      "studio-dua": "Wedding Photography · KL",
      "teh-tarik": "Minuman · Kajang",
      "kedai-rina": "Online Boutique · Melaka",
      "lim-and-co": "Accounting · Johor Bahru",
    } as Record<string, string>,
    /** The card footer's caption for the site's main button (English matches CATEGORIES). */
    buttons: {
      restaurant: "Order on WhatsApp",
      car: "Book a Test Drive",
      tutor: "Enquire Now",
      beauty: "Book an Appointment",
      homeServices: "Get a Quote",
      photographer: "Check Availability",
      retail: "Shop on WhatsApp",
      professional: "Enquire Now",
    } as Record<ShowcaseCategory, string>,
    open: "Open example",
    openLabel: (name: string) => `Open the ${name} example website`,
    rail: "Example websites for nine kinds of business",
    previous: "Previous business",
    next: "Next business",
  },
  how: {
    eyebrow: "How Webbi works",
    title: "Four steps, and you're live.",
    tell: {
      title: "Tell us what you do",
      body: "A few sentences in English or Malay. That is the whole brief.",
      question: "What do you do?",
      sample: "Nasi lemak shop in Kajang, open from 7am…",
      button: "Build my website",
    },
    build: {
      title: "Webbi builds your website",
      body: "Copy, sections, prices and layout. Assembled for your kind of business.",
      /** The generating screen's steps, as the product shows them. */
      steps: ["Understanding your business", "Organizing your content", "Choosing the right layout", "Optimizing for mobile"],
    },
    edit: {
      title: "Make it yours",
      body: "Change the words, swap photos, pick a style. No layout to wrestle with.",
      tabs: ["Business", "Menu", "Photos", "Style"],
      tagline: "Tagline",
    },
    publish: {
      title: "Publish",
      body: "Pay once, pick your link, go live. Share it anywhere you already post.",
      oneTime: "One-time",
      button: "Publish my website",
    },
  },
  control: {
    eyebrow: "Yours to change",
    title: "Webbi does the hard work. You stay in control.",
    lines: ["Rewrite any heading, price or paragraph.", "Swap photos. Webbi crops and fits them.", "Change the style and accent colour.", "Turn sections on or off, and reword the button."],
    style: "Style",
    accent: "Accent colour",
    wording: "Button wording",
    buttons: ["Order on WhatsApp", "Book a table", "Call us"],
  },
  beforeAfter: {
    title: "Your business deserves more than a WhatsApp link.",
    before: "Before",
    beforeTitle: "A link in your bio",
    beforeLines: ["Prices answered one chat at a time.", "Menu buried in an old story highlight.", "Nothing to send a customer who asks “where?”"],
    bioLink: "instagram.com/yourbusiness",
    after: "After",
    afterTitle: "A website that does the answering",
    afterLines: ["Menu and prices on one page.", "Hours, address and a map that opens in Google Maps.", "A WhatsApp button that starts the order for them."],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "One price. One website. Yours.",
    lede: "See it free. Pay to go live. No subscription, no renewal, ever.",
    steps: ["Sign up and describe your business", "Preview and edit the real website, free", "Pay once, pick your link, go live"],
    oneTime: "one time",
    included: (host: string) => ["Create your website", "Customise it", `Publish it on ${host}`],
    card: "Card",
    secure: "Secure payment · edit any time after publishing",
  },
  final: {
    titleLead: "Tell us what you do.",
    titleRest: "We'll take it from here.",
    lede: "It takes about as long as telling a friend what you do.",
    examples: "See Examples",
    note: (price: string) => `Free to create and preview · ${price} once when you publish`,
  },
  footer: {
    label: "Footer",
    terms: "Terms",
    privacy: "Privacy",
    support: "WhatsApp support",
    built: "Built in Malaysia",
  },
};

export type LandingCopy = typeof en;

const ms: LandingCopy = {
  language: {
    group: "Bahasa",
    en: "English (EN)",
    ms: "Bahasa Melayu (BM)",
  },
  nav: {
    how: "Cara guna",
    examples: "Contoh",
    pricing: "Harga",
    signIn: "Log masuk",
    dashboard: "Dashboard",
    home: "Laman utama Webbi",
  },
  cta: {
    create: "Bina Website Saya",
    dockOnce: (price) => `${price} sekali`,
  },
  hero: {
    titleLead: "Ceritakan bisnes anda.",
    titleRest: "Kami bina website anda.",
    lede: "Website profesional untuk bisnes, kreator dan jurujual. Tanpa leceh.",
    how: "Lihat Caranya",
    checks: (price) => [`${price}, sekali bayar`, "Tiada langganan", "Siap dengan WhatsApp"],
    caption: "Contoh Webbi · Rasa Kampung, dibina daripada satu penerangan",
    priceChip: (price) => `${price} · sekali bayar`,
    whatsappChip: "Order melalui WhatsApp",
  },
  prompt: {
    text: "Saya jual nasi lemak di Kajang. Pelanggan biasanya order melalui WhatsApp.",
    question: "Apa bisnes anda?",
    working: "Sedang bina website anda…",
    done: "Website anda dah siap",
  },
  strip: ["Satu penerangan, terus dapat website", "Bahasa Inggeris & Bahasa Melayu", "WhatsApp jadi pintu depan bisnes", "Terbit di webbi.online"],
  moment: {
    eyebrow: "Tengok sendiri",
    titleLead: "Satu penerangan.",
    titleRest: "Satu website lengkap.",
    youType: "Anda taip",
    again: "Tengok semula",
    noForms: "Tiada borang. Tak perlu pilih template.",
    reads: "Webbi baca",
    understanding: "Sedang faham bisnes anda…",
    chips: ["Restoran & F&B", "Kajang", "6 item disebut", "Order melalui WhatsApp"],
    style: (label) => `Gaya ${label}`,
    written: "Menu, tentang kami, waktu buka, lokasi, ulasan dan butang WhatsApp anda. Semuanya ditulis dan disusun untuk anda.",
    ready: "Website siap",
    publish: "Anda terbitkan",
  },
  examples: {
    eyebrow: "Contoh",
    title: "Dibina ikut bisnes anda.",
    lede: "Setiap Webbi disusun untuk satu bisnes. Ayat, bahagian, warna dan butangnya semua ikut apa yang anda jual.",
    tablist: "Contoh website",
    tabs: [
      { label: "Restoran & F&B", caption: "Rasa Kampung: menu, waktu buka, lokasi dan butang order." },
      { label: "Jurujual kereta", caption: "Hafiz Rahman: profil jurujual, model, soalan lazim dan butang pandu uji." },
      { label: "Kecantikan & kesihatan", caption: "Sereni: servis, senarai harga, ulasan dan butang tempahan." },
    ],
    style: (label) => `Gaya ${label}`,
    open: "Buka contoh ini",
  },
  showcase: {
    title: "Sembilan jenis bisnes. Satu cara untuk mula.",
    lede: "Gerai nasi lemak, jurujual Proton, cikgu tuisyen, akauntan. Setiap Webbi dapat template, ayat dan butang yang sesuai dengan bisnesnya.",
    subs: {
      "rasa-kampung": "Nasi Lemak · Kajang",
      "hafiz-rahman": "Jurujual Proton · Shah Alam",
      "cikgu-amir": "Tuisyen Matematik · Ipoh",
      sereni: "Studio Kecantikan · Bangsar",
      sejuktech: "Servis Aircond · Lembah Klang",
      "studio-dua": "Jurugambar Perkahwinan · KL",
      "teh-tarik": "Minuman · Kajang",
      "kedai-rina": "Butik Online · Melaka",
      "lim-and-co": "Perakaunan · Johor Bahru",
    },
    buttons: {
      restaurant: "Order melalui WhatsApp",
      car: "Tempah Pandu Uji",
      tutor: "Tanya Sekarang",
      beauty: "Buat Temujanji",
      homeServices: "Minta Sebut Harga",
      photographer: "Semak Tarikh Kosong",
      retail: "Beli melalui WhatsApp",
      professional: "Tanya Sekarang",
    },
    open: "Buka contoh",
    openLabel: (name) => `Buka contoh website ${name}`,
    rail: "Contoh website untuk sembilan jenis bisnes",
    previous: "Bisnes sebelumnya",
    next: "Bisnes seterusnya",
  },
  how: {
    eyebrow: "Cara Webbi berfungsi",
    title: "Empat langkah, terus online.",
    tell: {
      title: "Ceritakan bisnes anda",
      body: "Beberapa ayat dalam Bahasa Melayu atau Inggeris. Itu saja yang kami perlukan.",
      question: "Apa bisnes anda?",
      sample: "Kedai nasi lemak di Kajang, buka dari 7 pagi…",
      button: "Bina website saya",
    },
    build: {
      title: "Webbi bina website anda",
      body: "Ayat, bahagian, harga dan susun atur. Disiapkan ikut jenis bisnes anda.",
      steps: ["Faham bisnes anda", "Susun kandungan anda", "Pilih susun atur yang sesuai", "Kemas untuk telefon"],
    },
    edit: {
      title: "Ubah ikut citarasa",
      body: "Tukar ayat, tukar gambar, pilih gaya. Tak perlu pening pasal susun atur.",
      tabs: ["Bisnes", "Menu", "Gambar", "Gaya"],
      tagline: "Slogan",
    },
    publish: {
      title: "Terbitkan",
      body: "Bayar sekali, pilih link, terus online. Kongsi di mana-mana anda biasa post.",
      oneTime: "Sekali bayar",
      button: "Terbitkan website saya",
    },
  },
  control: {
    eyebrow: "Anda boleh ubah",
    title: "Webbi buat kerja berat. Keputusan tetap di tangan anda.",
    lines: ["Tulis semula mana-mana tajuk, harga atau perenggan.", "Tukar gambar. Webbi potong dan muatkan untuk anda.", "Tukar gaya dan warna utama.", "Pilih bahagian yang nak dipaparkan, dan tukar ayat pada butang."],
    style: "Gaya",
    accent: "Warna utama",
    wording: "Ayat butang",
    buttons: ["Order melalui WhatsApp", "Tempah meja", "Hubungi kami"],
  },
  beforeAfter: {
    title: "Bisnes anda layak dapat lebih daripada sekadar link WhatsApp.",
    before: "Sebelum",
    beforeTitle: "Satu link di bio",
    beforeLines: ["Soalan harga dijawab satu-satu dalam chat.", "Menu tenggelam dalam story highlight lama.", "Tiada apa nak dihantar bila pelanggan tanya “kat mana?”"],
    bioLink: "instagram.com/bisnesanda",
    after: "Selepas",
    afterTitle: "Website yang tolong jawab untuk anda",
    afterLines: ["Menu dan harga dalam satu halaman.", "Waktu buka, alamat dan peta yang terus buka Google Maps.", "Butang WhatsApp yang terus mulakan order pelanggan."],
  },
  pricing: {
    eyebrow: "Harga",
    title: "Satu harga. Satu website. Milik anda.",
    lede: "Tengok dulu, percuma. Bayar bila nak online. Tiada langganan, tiada bayaran pembaharuan, sampai bila-bila.",
    steps: ["Daftar dan ceritakan bisnes anda", "Tengok dan edit website sebenar, percuma", "Bayar sekali, pilih link, terus online"],
    oneTime: "sekali bayar",
    included: (host) => ["Bina website anda", "Ubah ikut citarasa", `Terbitkan di ${host}`],
    card: "Kad",
    secure: "Pembayaran selamat · boleh edit bila-bila masa selepas terbit",
  },
  final: {
    titleLead: "Ceritakan bisnes anda.",
    titleRest: "Selebihnya serah pada kami.",
    lede: "Masa yang diambil lebih kurang sama macam cerita pada kawan tentang bisnes anda.",
    examples: "Lihat Contoh",
    note: (price) => `Percuma untuk bina dan tengok · ${price} sekali bila anda terbitkan`,
  },
  footer: {
    label: "Pautan bawah",
    terms: "Terma",
    privacy: "Privasi",
    support: "Bantuan WhatsApp",
    built: "Dibina di Malaysia",
  },
};

export const LANDING_COPY: Record<LandingLang, LandingCopy> = { en, ms };
