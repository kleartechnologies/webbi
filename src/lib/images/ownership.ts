import type { GenerationInput, SiteImage } from "@/lib/site/schema";

/** Storage folder every upload for this user lands in (see storage.rules). */
export function ownsImagePath(uid: string, path: string | undefined): boolean {
  return !path || path.startsWith(`users/${uid}/`);
}

/**
 * The first uploaded image in a generation request that lives outside the
 * caller's own Storage folder, or undefined when every image is theirs. The
 * generate API refuses such requests so nobody can point a site at another
 * account's file.
 */
export function foreignImage(
  uid: string,
  input: Pick<GenerationInput, "photos" | "offerings" | "profilePhoto" | "logo" | "heroImage">,
): SiteImage | undefined {
  const images = [input.profilePhoto, input.logo, input.heroImage, ...input.photos, ...input.offerings.map((o) => o.image)];
  return images.find((img): img is SiteImage => Boolean(img?.path) && !ownsImagePath(uid, img?.path));
}
