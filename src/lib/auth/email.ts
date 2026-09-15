/**
 * Light checks on an email address typed into the sign-up and sign-in forms.
 * They only catch typos (a missing "@", a space, no domain). Firebase Auth
 * decides what a real address is, and whether it is verified: no provider is
 * refused (Gmail, Yahoo, Outlook, a company's own domain), and no username is
 * judged "fake". Shared by the browser and tests; no Firebase import.
 */

/** The address as it is sent to Firebase: surrounding whitespace removed, nothing else changed. */
export function normalizeEmail(input: string): string {
  return input.trim();
}

const MAX_EMAIL = 254;
const MAX_LOCAL = 64;
/** A domain label: letters, digits and inner hyphens (internationalised domains arrive as punycode or Unicode letters). */
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;

export function isPlausibleEmail(input: string): boolean {
  const email = normalizeEmail(input);
  if (!email || email.length > MAX_EMAIL || /\s/.test(email)) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > MAX_LOCAL || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) => LABEL.test(label)) && labels[labels.length - 1].length >= 2;
}

export const INVALID_EMAIL_MESSAGE = "Enter a valid email address, like name@example.com.";
