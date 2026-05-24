/**
 * Profile avatar helpers — shared across the navbar, dashboard, storefront,
 * and settings so every surface picks the same image for the same user.
 *
 * Resolution order for "what to show":
 *   1. The creator's uploaded `avatar_url` (from `/dashboard/settings`) —
 *      always wins.
 *   2. A deterministic pick from `DEFAULT_AVATAR_POOL`, keyed by profile
 *      id, so a given creator always sees the same axolotl. (Anonymous
 *      / id-less callers get the first one.)
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
 * Pick a default avatar for a profile id. Pure / deterministic — the same
 * id always returns the same url, both server-side (for SSR) and in the
 * browser. Falls back to the first entry when called without an id.
 */
export function defaultAvatarFor(profileId: string | null | undefined): DefaultAvatarUrl {
  if (!profileId) return DEFAULT_AVATAR_POOL[0];
  // Take the first 8 hex chars of the id. UUIDs always start with hex
  // and so do our `prefix-<id>` strings, so this hashes evenly across
  // the pool without pulling in a real hash function.
  const trimmed = profileId.replace(/[^0-9a-f]/gi, "").slice(0, 8);
  const parsed = trimmed ? Number.parseInt(trimmed, 16) : 0;
  const index = (Number.isFinite(parsed) ? parsed : 0) % DEFAULT_AVATAR_POOL.length;
  return DEFAULT_AVATAR_POOL[index];
}

/**
 * The url to render for a profile. Uploaded photo wins; otherwise the
 * deterministic axolotl pick. Use this everywhere instead of duplicating
 * fallback logic — keeps "no avatar uploaded" looking the same in the
 * navbar, dashboard, settings, storefront, and landing spotlight.
 */
export function getDisplayAvatar(profile: {
  id?: string | null;
  avatar_url?: string | null;
}): string {
  const uploaded = profile.avatar_url?.trim();
  if (uploaded) return uploaded;
  return defaultAvatarFor(profile.id ?? null);
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
