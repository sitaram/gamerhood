import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listBrowseCategories } from "@/lib/supabase/queries";
import { validateBrowseCategorySlug } from "@/lib/browse-routes";
import { parseTagsInput, sanitizeSlugInput, MAX_BROWSE_CATEGORY_SLUG_LEN } from "@/lib/slug-utils";

export const dynamic = "force-dynamic";

function parseKeywordsField(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === "string").join(", ");
  }
  return typeof raw === "string" ? raw : "";
}

/**
 * GET — list all browse categories (public) for SEO pages and picker UIs.
 */
export async function GET() {
  const supabase = await createClient();
  const rows = await listBrowseCategories(supabase);
  return NextResponse.json({ categories: rows });
}

/**
 * POST — create a category (auth). `slug` becomes `/{slug}/hoodies` etc.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slugFromBody =
    typeof body.slug === "string" && body.slug.trim()
      ? sanitizeSlugInput(body.slug, MAX_BROWSE_CATEGORY_SLUG_LEN)
      : "";
  const slugRaw = slugFromBody || sanitizeSlugInput(name, MAX_BROWSE_CATEGORY_SLUG_LEN);
  const slugCheck = validateBrowseCategorySlug(slugRaw);
  if (!slugCheck.ok) {
    return NextResponse.json({ error: slugCheck.error }, { status: 400 });
  }

  const kw = parseTagsInput(parseKeywordsField(body.keywords), 40);
  const seoTitle = typeof body.seoTitle === "string" ? body.seoTitle.trim().slice(0, 120) || null : null;
  const seoDesc =
    typeof body.seoDescription === "string" ? body.seoDescription.trim().slice(0, 320) || null : null;

  const { data, error } = await supabase
    .from("browse_categories")
    .insert({
      slug: slugCheck.slug,
      name,
      seo_title: seoTitle,
      seo_description: seoDesc,
      keywords: kw.length ? kw : [],
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That category URL is already taken." }, { status: 409 });
    }
    console.error("[browse-categories POST]", error);
    return NextResponse.json({ error: "Could not create category" }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}
