import type { SiteContent } from "./schema";

/**
 * Example Webbis shown on the landing page and served at /w/{slug} with an
 * "example" banner. They are ordinary Site JSON — the same renderer, the same
 * schema — so they double as fixtures for the renderer. Photos are CC0 (see
 * the CREDITS.txt file in each public/demo folder). The numbers are placeholders, not real lines.
 */
const DEMO_NUMBER = "60123456789";

const rasaKampung: SiteContent = {
  version: 1,
  language: "ms",
  business: {
    name: "Rasa Kampung",
    category: "restaurant",
    tagline: "Masakan kampung, rasa rumah",
    area: "Kajang",
    whatsapp: DEMO_NUMBER,
    address: "12, Jalan Reko, 43000 Kajang, Selangor",
    instagram: "rasakampung.kajang",
  },
  theme: { preset: "warm" },
  cta: { label: "Order di WhatsApp", kind: "whatsapp", message: "Hi Rasa Kampung, saya nak order" },
  sections: [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      headline: "Masakan kampung, rasa rumah",
      subheadline: "Nasi lemak, rendang dan lauk kampung dimasak segar setiap pagi. Bungkus, makan di kedai atau order untuk majlis.",
      badge: "Kajang · Buka 7 pagi – 3 petang",
      image: { url: "/demo/rasa-kampung/nasi-lemak.jpg", alt: "Nasi lemak dengan ayam goreng berempah", width: 1400, height: 1054 },
    },
    {
      id: "menu",
      type: "offerings",
      enabled: true,
      kind: "menu",
      title: "Menu popular",
      note: "Harga termasuk nasi. Lauk habis, habis — datang awal ya.",
      items: [
        { id: "m1", name: "Nasi Lemak Ayam Berempah", price: "RM 9.50", tag: "Paling laris", description: "Sambal tumis, ikan bilis rangup, telur dan ayam goreng berempah.", image: { url: "/demo/rasa-kampung/nasi-lemak.jpg", alt: "Nasi Lemak Ayam Berempah" } },
        { id: "m2", name: "Rendang Daging", price: "RM 12", description: "Rendang tok dimasak 4 jam dengan kerisik dan santan pekat.", image: { url: "/demo/rasa-kampung/beef-rendang.jpg", alt: "Rendang Daging" } },
        { id: "m3", name: "Ayam Masak Merah", price: "RM 10", description: "Ayam goreng bersalut sos tomato pedas manis.", image: { url: "/demo/rasa-kampung/ayam-masak-merah.jpg", alt: "Ayam Masak Merah" } },
        { id: "m4", name: "Kuih Lompang", price: "RM 1.20", description: "Kuih pandan dengan kelapa parut, dibuat setiap pagi.", image: { url: "/demo/rasa-kampung/kuih-lompang.jpg", alt: "Kuih Lompang" } },
        { id: "m5", name: "Ikan Keli Masak Lemak", price: "RM 12", description: "Masak lemak cili api dengan daun kunyit." },
        { id: "m6", name: "Teh Tarik", price: "RM 2.50" },
      ],
    },
    {
      id: "highlights",
      type: "highlights",
      enabled: true,
      items: [
        { id: "h1", icon: "schedule", title: "Masak segar setiap pagi", text: "Tiada masakan semalam. Apa yang habis, habis." },
        { id: "h2", icon: "restaurant", title: "Resepi turun-temurun", text: "Resepi Mak Cik Zainab dari Kuala Pilah sejak 1998." },
        { id: "h3", icon: "verified", title: "Halal & bersih", text: "Dapur terbuka. Bahan dari pasar Kajang setiap pagi." },
      ],
    },
    {
      id: "about",
      type: "about",
      enabled: true,
      title: "Tentang Rasa Kampung",
      body: [
        "Rasa Kampung bermula sebagai gerai tepi jalan di Kajang pada tahun 2015. Kini kami ada kedai sendiri, tetapi resepi masih sama: rempah ditumbuk sendiri, santan diperah pagi-pagi.",
        "Kami juga terima tempahan untuk majlis, kenduri dan pejabat. Hubungi kami sehari awal untuk tempahan lebih 20 pax.",
      ],
      highlights: ["Tempahan majlis & pejabat", "Bungkus atau makan di kedai", "Parkir percuma di hadapan kedai"],
    },
    {
      id: "reviews",
      type: "reviews",
      enabled: true,
      items: [
        { id: "r1", name: "Aina Syafiqah", text: "Nasi lemak paling sedap di Kajang. Sambal dia memang lain macam, tak terlalu manis.", rating: 5, source: "Google" },
        { id: "r2", name: "Encik Faizal", text: "Order untuk kenduri 50 orang, semua puji rendang dia. Servis cepat dan tepat masa.", rating: 5, source: "WhatsApp" },
        { id: "r3", name: "Mei Ling", text: "Datang setiap Sabtu untuk kuih. Ayam masak merah pun sedap. Harga berpatutan.", rating: 5, source: "Google" },
      ],
    },
    {
      id: "gallery",
      type: "gallery",
      enabled: true,
      images: [
        { url: "/demo/rasa-kampung/beef-rendang.jpg", alt: "Rendang daging" },
        { url: "/demo/rasa-kampung/ayam-masak-merah.jpg", alt: "Ayam masak merah" },
        { url: "/demo/rasa-kampung/kuih-lompang.jpg", alt: "Kuih lompang" },
      ],
    },
    {
      id: "location",
      type: "location",
      enabled: true,
      address: "12, Jalan Reko, 43000 Kajang, Selangor",
      hours: [
        { id: "o1", days: "Isnin – Sabtu", hours: "7:00 pagi – 3:00 petang" },
        { id: "o2", days: "Ahad", hours: "Tutup" },
      ],
      note: "Berhampiran stesen MRT Kajang. Parkir di hadapan kedai.",
    },
    { id: "cta", type: "cta", enabled: true, headline: "Lapar? Order sekarang.", body: "Kami balas dalam 5 minit waktu operasi." },
    { id: "contact", type: "contact", enabled: true },
  ],
};

const hafizRahman: SiteContent = {
  version: 1,
  language: "en",
  business: {
    name: "Hafiz Rahman",
    category: "car",
    tagline: "Proton Sales Advisor",
    area: "Shah Alam",
    whatsapp: DEMO_NUMBER,
    facebook: "hafizproton",
    tiktok: "hafiz.proton",
  },
  theme: { preset: "bold" },
  cta: { label: "Book a Test Drive", kind: "whatsapp", message: "Hi Hafiz, I'd like to book a test drive" },
  sections: [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      headline: "Your next Proton, sorted.",
      subheadline: "Best deals on the X50, X70, S70 and Saga. Trade-in, loan and delivery, all arranged for you.",
      badge: "Proton Sales Advisor · Shah Alam",
    },
    {
      id: "models",
      type: "offerings",
      enabled: true,
      kind: "models",
      title: "Models",
      note: "Prices are on-the-road estimates. Message me for this month's rebates.",
      items: [
        { id: "c1", name: "Proton X50", price: "From RM 86,300", tag: "Best seller", description: "1.5L turbo SUV. The one everyone asks for." },
        { id: "c2", name: "Proton X70", price: "From RM 98,800", description: "Family SUV with more space and a quieter cabin." },
        { id: "c3", name: "Proton S70", price: "From RM 73,800", tag: "New", description: "Sedan with SUV features. Great for daily drives." },
        { id: "c4", name: "Proton Saga", price: "From RM 34,800", description: "Malaysia's favourite first car. Low monthly." },
        { id: "c5", name: "Proton X90", price: "From RM 123,800", description: "7-seater with mild hybrid. Ideal for big families." },
      ],
    },
    {
      id: "highlights",
      type: "highlights",
      enabled: true,
      items: [
        { id: "h1", icon: "swap_vert", title: "Same-day trade-in valuation", text: "Send photos on WhatsApp, get a number within the hour." },
        { id: "h2", icon: "task_alt", title: "Loan approval in 24 hours", text: "I work with five banks so you get the best rate." },
        { id: "h3", icon: "directions_car", title: "Free delivery in Klang Valley", text: "Or I bring the car to you for a test drive." },
      ],
    },
    {
      id: "about",
      type: "about",
      enabled: true,
      title: "Hi, I'm Hafiz",
      body: [
        "I've been with Proton Shah Alam for eight years and delivered over 600 cars. Most of my customers come from referrals, which tells you how I work: straight answers, no hidden charges, and I'm still around after the sale.",
        "First car, family upgrade or fleet purchase, message me and I'll sort out the paperwork.",
      ],
      highlights: ["600+ cars delivered", "Top 10 advisor 2024", "Weekend test drives"],
    },
    {
      id: "reviews",
      type: "reviews",
      enabled: true,
      items: [
        { id: "r1", name: "Nurul Izzah", text: "Loan approved in one day and Hafiz delivered the X50 to my office. Super smooth.", rating: 5, source: "Google" },
        { id: "r2", name: "Daniel Wong", text: "Honest advisor. Told me the S70 was a better fit than the X70 for my budget, and he was right.", rating: 5, source: "Facebook" },
        { id: "r3", name: "Kumar S.", text: "Traded in my old Myvi at a good price. Whole process took a week.", rating: 5, source: "Google" },
      ],
    },
    {
      id: "faq",
      type: "faq",
      enabled: true,
      items: [
        { id: "q1", question: "Can I trade in my current car?", answer: "Yes. Send me a few photos and the mileage on WhatsApp and I'll get you a valuation the same day." },
        { id: "q2", question: "How long does loan approval take?", answer: "Usually within 24 hours for salaried applicants. Self-employed takes two to three working days." },
        { id: "q3", question: "Do you deliver outside Selangor?", answer: "Yes, delivery to other states can be arranged for a small fee. Klang Valley delivery is free." },
      ],
    },
    {
      id: "location",
      type: "location",
      enabled: true,
      mapsQuery: "Proton Shah Alam",
      hours: [
        { id: "o1", days: "Monday – Saturday", hours: "9:00 am – 7:00 pm" },
        { id: "o2", days: "Sunday", hours: "By appointment" },
      ],
    },
    { id: "cta", type: "cta", enabled: true, headline: "Ready for a test drive?", body: "Message me and I'll bring the car to you." },
    { id: "contact", type: "contact", enabled: true },
  ],
};

const sereni: SiteContent = {
  version: 1,
  language: "en",
  business: {
    name: "Sereni",
    category: "beauty",
    tagline: "Facials · Lashes · Brows",
    area: "Bangsar",
    whatsapp: DEMO_NUMBER,
    address: "Lot 2-3, Bangsar Village II, 59100 Kuala Lumpur",
    instagram: "sereni.studio",
  },
  theme: { preset: "elegant" },
  cta: { label: "Book an Appointment", kind: "whatsapp", message: "Hi Sereni, I'd like to book an appointment" },
  sections: [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      headline: "Slow down. Glow up.",
      subheadline: "A calm, women-only studio in Bangsar for facials, lash extensions and brows.",
      badge: "Bangsar · Women-only studio",
    },
    {
      id: "treatments",
      type: "offerings",
      enabled: true,
      kind: "treatments",
      title: "Treatments",
      note: "First visit? Take 10% off any facial.",
      items: [
        { id: "t1", name: "Signature Hydra Facial", price: "RM 180", description: "75 min · Deep cleanse, hydration infusion and LED.", tag: "Popular" },
        { id: "t2", name: "Deep Cleanse Facial", price: "RM 140", description: "60 min · For congested or oily skin." },
        { id: "t3", name: "Classic Lash Extensions", price: "RM 150", description: "Natural set, lasts 3–4 weeks." },
        { id: "t4", name: "Lash Refill", price: "RM 90", description: "Within 3 weeks of a full set." },
        { id: "t5", name: "Brow Lamination & Tint", price: "RM 120", description: "45 min · Fuller, set brows for 6 weeks." },
      ],
    },
    {
      id: "highlights",
      type: "highlights",
      enabled: true,
      items: [
        { id: "h1", icon: "lock", title: "Private, women-only rooms", text: "Every treatment in your own room." },
        { id: "h2", icon: "spa", title: "Korean skincare", text: "Products chosen for humid Malaysian skin." },
        { id: "h3", icon: "directions_car", title: "Easy parking", text: "Bangsar Village II car park, 2 minutes' walk." },
      ],
    },
    {
      id: "about",
      type: "about",
      enabled: true,
      body: [
        "Sereni was started by Farah, a certified aesthetician with ten years at KL's top spas. The idea was simple: a quiet studio where you don't feel rushed, sold to, or judged.",
        "We keep the treatment list short so we can do each one properly.",
      ],
    },
    {
      id: "reviews",
      type: "reviews",
      enabled: true,
      items: [
        { id: "r1", name: "Sarah T.", text: "The hydra facial is the best I've had in KL. Skin still glowing a week later.", rating: 5, source: "Google" },
        { id: "r2", name: "Priya", text: "Finally lashes that look natural. Farah is so gentle and the room is so peaceful.", rating: 5, source: "Instagram" },
        { id: "r3", name: "Hana Y.", text: "Easy to book on WhatsApp, never had to wait. Brow lamination was perfect.", rating: 5, source: "Google" },
      ],
    },
    {
      id: "faq",
      type: "faq",
      enabled: true,
      items: [
        { id: "q1", question: "Do I need to book in advance?", answer: "Yes, we're appointment only. Same-day slots are sometimes available, just WhatsApp us." },
        { id: "q2", question: "Is the studio really women-only?", answer: "Yes. All our therapists are women and the studio is closed to walk-ins." },
        { id: "q3", question: "How long do lash extensions last?", answer: "Three to four weeks with normal care. A refill within three weeks keeps them full." },
      ],
    },
    {
      id: "location",
      type: "location",
      enabled: true,
      address: "Lot 2-3, Bangsar Village II, 59100 Kuala Lumpur",
      hours: [
        { id: "o1", days: "Tuesday – Sunday", hours: "10:00 am – 8:00 pm" },
        { id: "o2", days: "Monday", hours: "Closed" },
      ],
    },
    { id: "cta", type: "cta", enabled: true, headline: "Book your first visit", body: "New clients get 10% off any facial." },
    { id: "contact", type: "contact", enabled: true },
  ],
};

const sejukTech: SiteContent = {
  version: 1,
  language: "mixed",
  business: {
    name: "SejukTech",
    category: "homeServices",
    tagline: "Aircond service & repair",
    area: "Klang Valley",
    whatsapp: DEMO_NUMBER,
    phone: "60123456789",
  },
  theme: { preset: "trust" },
  cta: { label: "Get a Quote", kind: "whatsapp", message: "Hi SejukTech, I need an aircond quote" },
  sections: [
    {
      id: "hero",
      type: "hero",
      enabled: true,
      headline: "Aircond tak sejuk? We come today.",
      subheadline: "Service, repair and installation across the Klang Valley. Fixed prices, no surprise charges.",
      badge: "Klang Valley · Same-day service",
    },
    {
      id: "services",
      type: "offerings",
      enabled: true,
      kind: "services",
      title: "Services & prices",
      note: "Prices per unit. Chemical wash includes indoor and outdoor units.",
      items: [
        { id: "s1", name: "General service", price: "RM 60", description: "Clean filters, coil and drainage. Recommended every 3 months." },
        { id: "s2", name: "Chemical wash", price: "RM 130", description: "Full strip-down clean for units that smell or drip.", tag: "Popular" },
        { id: "s3", name: "Gas top-up (R32 / R410)", price: "From RM 80", description: "Includes leak check." },
        { id: "s4", name: "New unit installation", price: "From RM 250", description: "Piping and bracket included up to 10ft." },
        { id: "s5", name: "Repair & diagnosis", price: "RM 50", description: "Waived if you proceed with the repair." },
      ],
    },
    {
      id: "highlights",
      type: "highlights",
      enabled: true,
      items: [
        { id: "h1", icon: "schedule", title: "Same-day slots", text: "Book before 12pm, we come the same day." },
        { id: "h2", icon: "receipt_long", title: "Fixed prices", text: "You see the price before we start. No add-ons." },
        { id: "h3", icon: "verified", title: "30-day guarantee", text: "Problem comes back? We come back free." },
      ],
    },
    {
      id: "about",
      type: "about",
      enabled: true,
      body: [
        "SejukTech is a two-van team based in Puchong, serving homes and small offices across the Klang Valley since 2019. We handle all major brands: Daikin, Panasonic, Midea, Acson, York and more.",
      ],
      highlights: ["All major brands", "Homes & small offices", "Cashless payment"],
    },
    {
      id: "reviews",
      type: "reviews",
      enabled: true,
      items: [
        { id: "r1", name: "Azlan", text: "Called at 10am, done by 3pm. Aircond sejuk gila now. Recommended.", rating: 5, source: "Google" },
        { id: "r2", name: "Jessica Lim", text: "Very professional, showed me the dirty coil before and after. Fair price.", rating: 5, source: "Google" },
      ],
    },
    {
      id: "location",
      type: "location",
      enabled: true,
      mapsQuery: "Puchong, Selangor",
      hours: [
        { id: "o1", days: "Monday – Saturday", hours: "9:00 am – 6:00 pm" },
        { id: "o2", days: "Sunday", hours: "Emergency only" },
      ],
      note: "We cover Puchong, Subang, PJ, Shah Alam, KL and Cheras.",
    },
    { id: "cta", type: "cta", enabled: true, headline: "Get a quote in 5 minutes", body: "Send us your unit's photo and location on WhatsApp." },
    { id: "contact", type: "contact", enabled: true },
  ],
};

export const DEMO_SITES: Record<string, SiteContent> = {
  "rasa-kampung": rasaKampung,
  "hafiz-rahman": hafizRahman,
  sereni,
  sejuktech: sejukTech,
};

export const DEMO_SLUGS = Object.keys(DEMO_SITES);

export function getDemoSite(slug: string): SiteContent | null {
  return DEMO_SITES[slug] ?? null;
}
