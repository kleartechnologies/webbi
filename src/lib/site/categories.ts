import type { IconName } from "@/components/ui/Icon";
import type { PresetId } from "./presets";

/**
 * Business categories Webbi understands. The AI maps any description to the
 * closest one; "other" is the safe fallback. Each category carries the default
 * call to action and visual preset from the design system.
 */
export const CATEGORY_IDS = [
  "restaurant",
  "car",
  "beauty",
  "homeServices",
  "photographer",
  "property",
  "tutor",
  "retail",
  "fitness",
  "professional",
  "creative",
  "health",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  label: string;
  /** Short description used in AI prompts and UI hints. */
  hint: string;
  cta: string;
  ctaIcon: IconName;
  icon: IconName;
  preset: PresetId;
  /** What the offerings are called on this kind of site. */
  offeringsLabel: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  restaurant: {
    id: "restaurant",
    label: "Restaurant & F&B",
    hint: "restaurants, cafés, food stalls, home bakers, catering",
    cta: "Order on WhatsApp",
    ctaIcon: "chat",
    icon: "restaurant_menu",
    preset: "warm",
    offeringsLabel: "Menu",
  },
  car: {
    id: "car",
    label: "Car sales advisor",
    hint: "new or used car sales advisors, dealerships",
    cta: "Book a Test Drive",
    ctaIcon: "directions_car",
    icon: "directions_car",
    preset: "bold",
    offeringsLabel: "Models",
  },
  beauty: {
    id: "beauty",
    label: "Beauty & wellness",
    hint: "salons, spas, lash and nail studios, barbers, massage",
    cta: "Book an Appointment",
    ctaIcon: "calendar_month",
    icon: "spa",
    preset: "elegant",
    offeringsLabel: "Services",
  },
  homeServices: {
    id: "homeServices",
    label: "Home services",
    hint: "aircond, plumbing, electrical, renovation, cleaning, pest control",
    cta: "Get a Quote",
    ctaIcon: "request_quote",
    icon: "home_repair_service",
    preset: "trust",
    offeringsLabel: "Services",
  },
  photographer: {
    id: "photographer",
    label: "Photographer",
    hint: "wedding, event, product and portrait photographers, videographers",
    cta: "Check Availability",
    ctaIcon: "event_available",
    icon: "photo_camera",
    preset: "elegant",
    offeringsLabel: "Packages",
  },
  property: {
    id: "property",
    label: "Property agent",
    hint: "real estate negotiators and agents, rentals and sales",
    cta: "Enquire About Property",
    ctaIcon: "chat",
    icon: "apartment",
    preset: "trust",
    offeringsLabel: "Listings",
  },
  tutor: {
    id: "tutor",
    label: "Tutor",
    hint: "tuition centres, private tutors, coaches, classes",
    cta: "Enquire Now",
    ctaIcon: "chat",
    icon: "school",
    preset: "bright",
    offeringsLabel: "Subjects",
  },
  retail: {
    id: "retail",
    label: "Online seller",
    hint: "online shops, boutiques, product sellers, dropship",
    cta: "Shop on WhatsApp",
    ctaIcon: "shopping_bag",
    icon: "storefront",
    preset: "bright",
    offeringsLabel: "Products",
  },
  fitness: {
    id: "fitness",
    label: "Fitness & sports",
    hint: "gyms, personal trainers, yoga, martial arts, sports coaching",
    cta: "Book a Free Trial",
    ctaIcon: "fitness_center",
    icon: "fitness_center",
    preset: "bold",
    offeringsLabel: "Programmes",
  },
  professional: {
    id: "professional",
    label: "Professional services",
    hint: "accountants, consultants, agents, lawyers, insurance, IT",
    cta: "Enquire Now",
    ctaIcon: "chat",
    icon: "work",
    preset: "trust",
    offeringsLabel: "Services",
  },
  creative: {
    id: "creative",
    label: "Creative & design",
    hint: "designers, makers, artists, printing, event decor",
    cta: "Check Availability",
    ctaIcon: "chat",
    icon: "brush",
    preset: "elegant",
    offeringsLabel: "Services",
  },
  health: {
    id: "health",
    label: "Health & clinic",
    hint: "clinics, dental, physio, traditional medicine, pharmacies",
    cta: "Book an Appointment",
    ctaIcon: "calendar_month",
    icon: "medical_services",
    preset: "trust",
    offeringsLabel: "Services",
  },
  other: {
    id: "other",
    label: "Small business",
    hint: "any other legitimate small business or independent professional",
    cta: "Chat on WhatsApp",
    ctaIcon: "chat",
    icon: "storefront",
    preset: "trust",
    offeringsLabel: "Services",
  },
};

export function getCategory(id: string | undefined | null): Category {
  return (id && (CATEGORIES as Record<string, Category>)[id]) || CATEGORIES.other;
}
