import { blockedSlugLanguageReason } from "@/lib/slug-content-policy";

/** Slug segment allows hyphens; stored lowercase. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Dashes users may type (en/em dash, minus sign, etc.) → ASCII hyphen. */
const UNICODE_DASH_RE = /[\p{Dash_Punctuation}\u2212\u2043\u207B\u208B\u2796]/gu;

/** Props for slug text inputs — avoids smart punctuation substituting dashes on Apple OSes. */
export const SLUG_INPUT_PROPS = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;

/** Max lengths for URL slug segments stored in the DB. */
export const MAX_STORE_SLUG_LEN = 40;
export const MAX_BROWSE_CATEGORY_SLUG_LEN = 48;
export const MAX_PRODUCT_CATEGORY_SLUG_LEN = 40;

/**
 * Canonical form for store slugs, browse category slugs, product categories, and path segments:
 * lowercase `a-z`, digits, single hyphens between tokens — no spaces or other characters.
 * Use in controlled inputs so users cannot type invalid URL characters.
 * Trailing hyphens are kept so users can type segments like `my-shop` (trim on save via finalizeSlugInput).
 */
export function sanitizeSlugInput(raw: string, maxLength: number): string {
  const s = raw
    .toLowerCase()
    .replace(UNICODE_DASH_RE, "-")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/g, "");
  return s.slice(0, maxLength);
}

/** Stored / validated slug — same as sanitizeSlugInput but trims edge hyphens. */
export function finalizeSlugInput(raw: string, maxLength: number): string {
  return sanitizeSlugInput(raw, maxLength).replace(/-+$/g, "");
}

/** Server-side normalize for optional single-segment category fields (publish, PATCH product). */
export function normalizeProductCategoryInput(
  raw: string | undefined | null,
): string | null {
  const s = finalizeSlugInput(typeof raw === "string" ? raw : "", MAX_PRODUCT_CATEGORY_SLUG_LEN);
  return s || null;
}

const RESERVED = new Set([
  "about",
  "api",
  "apple-icon",
  "auth",
  "cart",
  "checkout",
  "create",
  "dashboard",
  "dmca",
  "faq",
  "icon",
  "login",
  "privacy",
  "product",
  "safety",
  "shop",
  "signup",
  "terms",
  "_next",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}

export function validateStoreSlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = finalizeSlugInput(typeof raw === "string" ? raw : "", MAX_STORE_SLUG_LEN);
  if (slug.length < 3) return { ok: false, error: "URL must be at least 3 characters." };
  if (slug.length > MAX_STORE_SLUG_LEN) return { ok: false, error: `URL must be at most ${MAX_STORE_SLUG_LEN} characters.` };
  if (!SLUG_RE.test(slug)) return { ok: false, error: "Use lowercase letters, numbers, and single hyphens only." };
  if (isReservedSlug(slug)) return { ok: false, error: "That URL is reserved. Pick another." };
  const blocked = blockedSlugLanguageReason(slug);
  if (blocked) return { ok: false, error: blocked };
  return { ok: true, slug };
}

export function parseTagsInput(raw: string, max = 12): string[] {
  const parts = raw
    .split(/[,#]+/)
    .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, ""))
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.replace(/\s+/g, "-").slice(0, 32);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
