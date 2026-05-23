import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateBrowseCategorySlug } from "@/lib/browse-routes";
import { parseTagsInput } from "@/lib/slug-utils";

export const dynamic = "force-dynamic";

function parseKeywordsField(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === "string").join(", ");
  }
  return typeof raw === "string" ? raw : "";
}

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * PATCH — update a category you created (slug change allowed if not taken).
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  const { slug: paramSlug } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing, error: findErr } = await supabase
    .from("browse_categories")
    .select("*")
    .eq("slug", paramSlug.trim().toLowerCase())
    .maybeSingle();

  if (findErr || !existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    row.name = body.name.trim().slice(0, 120) || existing.name;
  }

  if (body.slug !== undefined && body.slug !== null) {
    const v = validateBrowseCategorySlug(String(body.slug));
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
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
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("browse_categories")
    .update(row)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That category URL is already taken." }, { status: 409 });
    }
    console.error("[browse-categories PATCH]", error);
    return NextResponse.json({ error: "Could not update" }, { status: 500 });
  }

  return NextResponse.json({ category: updated });
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  const { slug: paramSlug } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("browse_categories")
    .select("id, created_by")
    .eq("slug", paramSlug.trim().toLowerCase())
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("browse_categories").delete().eq("id", existing.id);
  if (error) {
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
