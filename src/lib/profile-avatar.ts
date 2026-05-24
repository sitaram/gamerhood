/**
 * Profile avatar helpers — the single source of truth for "what photo to
 * show for this user" across the navbar, dashboard, storefront, settings,
 * and creator-spotlight surfaces.
 *
 * Two resolvers live here. Pick the one that matches the *context* you're
 * rendering, not the data you happen to have:
 *
 *   getDisplayAvatar(profile)         → personal photo everywhere except
 *                                       public storefront pages.
 *     uploaded avatar_url → deterministic default-axolotl pick.
 *
 *   getStorefrontAvatar(profile)      → public storefront pages ONLY.
 *     uploaded storefront_avatar_url
 *       → uploaded avatar_url
 *       → deterministic default-axolotl pick.
 *
 * Both fall back to the same deterministic axolotl per profile id, so a
 * brand-new creator looks identical in the navbar, dashboard, and on
 * their public shop. The deterministic seed is the *profile id* (the
 * `public.profiles.id` UUID) — NEVER the auth user id, because the two
 * differ and using the wrong one would pick a different axolotl on
 * surfaces that only know about the auth user. When neither is known
 * (anonymous callers), we return the first entry.
 *
 * The pool is a hand-maintained list rather than a directory scan so the
 * production build doesn't have to read `public/`. To add a new avatar:
 *   1. Drop the source PNG into `public/brand/default-avatars/_source/`.
 *   2. Run `pnpm avatars:defaults` (or `node scripts/process-default-avatars.mjs`).
 *   3. Append the new filename to `DEFAULT_AVATAR_POOL` below.
 */

/** Public paths to the bundled default-avatar PNGs (512×512, transparent). */
export const DEFAULT_AVATAR_POOL = [
  "/brand/default-avatars/axolotl-burger.png",
  "/brand/default-avatars/axolotl-manga.png",
  "/brand/default-avatars/axolotl-painter.png",
  "/brand/default-avatars/axolotl-soccer.png",
  "/brand/default-avatars/axolotl-violinist.png",
  // Appended (do not reorder above — would shift existing users' deterministic picks).
  "/brand/default-avatars/axolotl-basketball.png",
  "/brand/default-avatars/axolotl-cat-cuddle.png",
  "/brand/default-avatars/axolotl-gamer-rage.png",
  "/brand/default-avatars/axolotl-tiedye-peace.png",
] as const;

export type DefaultAvatarUrl = (typeof DEFAULT_AVATAR_POOL)[number];

/**
 * FNV-1a 32-bit hash. Deterministic, dependency-free, and even across the
 * pool for both UUID and "prefix-<hex>" id strings. Math.imul keeps the
 * 32-bit multiply correct in JS (regular `*` would lose precision past 2^32).
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Pick a default avatar for a profile id. Pure / deterministic — the same
 * id always returns the same url, both server-side (for SSR) and in the
 * browser. Falls back to the first entry when called without an id.
 */
export function defaultAvatarFor(profileId: string | null | undefined): DefaultAvatarUrl {
  if (!profileId) return DEFAULT_AVATAR_POOL[0];
  const index = fnv1a32(profileId) % DEFAULT_AVATAR_POOL.length;
  return DEFAULT_AVATAR_POOL[index];
}

/**
 * The url to render for a creator's *personal* avatar (nav, dashboard,
 * settings, design cards, creator-spotlight, etc.). Uploaded photo wins;
 * otherwise the deterministic axolotl pick.
 *
 * For public storefront pages use `getStorefrontAvatar` instead.
 */
export function getDisplayAvatar(profile: {
  id?: string | null;
  avatar_url?: string | null;
}): string {
  const uploaded = profile.avatar_url?.trim();
  if (uploaded) return uploaded;
  return defaultAvatarFor(profile.id ?? null);
}

/**
 * The url to render on the *public storefront* (`/shop/[slug]` etc).
 * Storefront-specific photo wins over the personal photo, so creators can
 * present a different face on their shop without losing the personal one
 * that's used everywhere else.
 *
 * Resolution order: storefront_avatar_url → avatar_url → default axolotl.
 */
export function getStorefrontAvatar(profile: {
  id?: string | null;
  avatar_url?: string | null;
  storefront_avatar_url?: string | null;
}): string {
  const storefront = profile.storefront_avatar_url?.trim();
  if (storefront) return storefront;
  return getDisplayAvatar(profile);
}

/** Initials for the AvatarFallback while the image loads / fails. */
export function profileInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
