import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { listBrowseCategories } from "@/lib/supabase/queries";
import { isPlatformAdminUser } from "@/lib/browse-categories/admin-access";
import { parseBrowseCategoryCreateBody } from "@/lib/browse-categories/api-body";

export const dynamic = "force-dynamic";

/**
 * GET — list all browse categories (public) for SEO pages and picker UIs.
 */
export async function GET() {
  const supabase = await createClient();
  const rows = await listBrowseCategories(supabase);
  return NextResponse.json({ categories: rows });
}

/**
 * POST — create a category (auth). Platform admins create official tag landings.
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

  const parsed = parseBrowseCategoryCreateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const asAdmin = isPlatformAdminUser(user);
  const isPlatform = asAdmin && body.isPlatform === true;

  const insertRow = {
    ...parsed.row,
    created_by: user.id,
    ...(isPlatform ? { is_platform: true } : { is_platform: false }),
  };

  const db = isPlatform ? getServiceClient() : supabase;
  const { data, error } = await db
    .from("browse_categories")
    .insert(insertRow)
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
