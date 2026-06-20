import { validateBrowseCategorySlug } from "@/lib/browse-routes";
import { parseTagsInput, sanitizeSlugInput, MAX_BROWSE_CATEGORY_SLUG_LEN } from "@/lib/slug-utils";

function parseKeywordsField(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === "string").join(", ");
  }
  return typeof raw === "string" ? raw : "";
}

export type ParsedBrowseCategoryBody =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string; status: number };

export function parseBrowseCategoryCreateBody(
  body: Record<string, unknown>,
): ParsedBrowseCategoryBody {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    return { ok: false, error: "Name is required", status: 400 };
  }

  const slugFromBody =
    typeof body.slug === "string" && body.slug.trim()
      ? sanitizeSlugInput(body.slug, MAX_BROWSE_CATEGORY_SLUG_LEN)
      : "";
  const slugRaw = slugFromBody || sanitizeSlugInput(name, MAX_BROWSE_CATEGORY_SLUG_LEN);
  const slugCheck = validateBrowseCategorySlug(slugRaw);
  if (!slugCheck.ok) {
    return { ok: false, error: slugCheck.error, status: 400 };
  }

  const kw = parseTagsInput(parseKeywordsField(body.keywords), 40);
  const seoTitle = typeof body.seoTitle === "string" ? body.seoTitle.trim().slice(0, 120) || null : null;
  const seoDesc =
    typeof body.seoDescription === "string" ? body.seoDescription.trim().slice(0, 320) || null : null;

  return {
    ok: true,
    row: {
      slug: slugCheck.slug,
      name,
      seo_title: seoTitle,
      seo_description: seoDesc,
      keywords: kw.length ? kw : [],
    },
  };
}

export function parseBrowseCategoryPatchBody(
  body: Record<string, unknown>,
  existing: {
    name: string;
    slug: string;
    seo_title: string | null;
    seo_description: string | null;
    keywords: string[] | null;
  },
): ParsedBrowseCategoryBody {
  const row: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    row.name = body.name.trim().slice(0, 120) || existing.name;
  }

  if (body.slug !== undefined && body.slug !== null) {
    const v = validateBrowseCategorySlug(String(body.slug));
    if (!v.ok) {
      return { ok: false, error: v.error, status: 400 };
    }
    row.slug = v.slug;
  }

  if (body.seoTitle !== undefined) {
    row.seo_title =
      body.seoTitle === null
        ? null
        : typeof body.seoTitle === "string"
          ? body.seoTitle.trim().slice(0, 120) || null
          : existing.seo_title;
  }
  if (body.seoDescription !== undefined) {
    row.seo_description =
      body.seoDescription === null
        ? null
        : typeof body.seoDescription === "string"
          ? body.seoDescription.trim().slice(0, 320) || null
          : existing.seo_description;
  }
  if (body.keywords !== undefined) {
    const kw = parseTagsInput(parseKeywordsField(body.keywords), 40);
    row.keywords = kw;
  }

  if (Object.keys(row).length === 0) {
    return { ok: false, error: "No changes", status: 400 };
  }

  return { ok: true, row };
}
