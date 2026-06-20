import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  canManageBrowseCategory,
  isPlatformAdminUser,
} from "@/lib/browse-categories/admin-access";
import { parseBrowseCategoryPatchBody } from "@/lib/browse-categories/api-body";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * PATCH — update a category you created, or any row if platform admin.
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

  const asAdmin = isPlatformAdminUser(user);
  const lookup = asAdmin ? getServiceClient() : supabase;

  const { data: existing, error: findErr } = await lookup
    .from("browse_categories")
    .select("*")
    .eq("slug", paramSlug.trim().toLowerCase())
    .maybeSingle();

  if (findErr || !existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (!canManageBrowseCategory(user, existing, asAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBrowseCategoryPatchBody(body, existing);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const row = { ...parsed.row };
  if (asAdmin && body.isPlatform === true) row.is_platform = true;
  if (asAdmin && body.isPlatform === false) row.is_platform = false;

  const db = asAdmin ? getServiceClient() : supabase;
  const { data: updated, error } = await db
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

  const asAdmin = isPlatformAdminUser(user);
  const lookup = asAdmin ? getServiceClient() : supabase;

  const { data: existing } = await lookup
    .from("browse_categories")
    .select("id, created_by, is_platform")
    .eq("slug", paramSlug.trim().toLowerCase())
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageBrowseCategory(user, existing, asAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = asAdmin ? getServiceClient() : supabase;
  const { error } = await db.from("browse_categories").delete().eq("id", existing.id);
  if (error) {
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
