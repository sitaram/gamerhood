import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDesignById, getDefaultProfileForAuthUser } from "@/lib/supabase/queries";
import {
  designHasDmcaReports,
  designHasOrderHistoryViaProducts,
} from "@/lib/delete-guards";
import { getServiceClient } from "@/lib/supabase/admin";
import { removeDesignImageFromStorage, removeListingMockupFromStorage } from "@/lib/storage";
import { detectDesignTransparencyFromAnySource } from "@/lib/print/transparency";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await getDesignById(supabase, id);
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { count: publishedProductCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("design_id", id)
    .eq("is_published", true);

  /**
   * Lazy backfill: pre-migration rows have `has_transparency = null`.
   * The first read pulls the image, runs the sharp alpha check, persists
   * the result, and returns it so the UI's badge never has to special-case
   * "unknown" for legacy designs. Best-effort — if the fetch / decode
   * fails we still return `null` so the badge stays in the neutral state.
   */
  let hasTransparency: boolean | null =
    typeof data.has_transparency === "boolean" ? data.has_transparency : null;
  if (hasTransparency === null && data.image_url) {
    const result = await detectDesignTransparencyFromAnySource(data.image_url);
    if (result) {
      hasTransparency = result.transparent;
      await supabase
        .from("designs")
        .update({ has_transparency: hasTransparency })
        .eq("id", data.id)
        .then(({ error: updErr }) => {
          if (updErr) {
            console.warn(
              `[designs GET] has_transparency backfill failed for ${data.id}:`,
              updErr.message,
            );
          }
        });
    }
  }

  return NextResponse.json({
    id: data.id,
    imageUrl: data.image_url,
    prompt: data.prompt,
    style: data.style,
    title: data.title,
    hasPublishedProducts: (publishedProductCount ?? 0) > 0,
    hasTransparency,
    uploadedAsSvg: Boolean(data.uploaded_as_svg),
  });
}

/**
 * Deletes the design and all listings that use it when nothing blocks removal
 * (no orders on those listings, no DMCA rows pointing at this design).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: designId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 400 });
  }

  const { data: design, error: designErr } = await supabase
    .from("designs")
    .select("id, profile_id")
    .eq("id", designId)
    .single();

  if (designErr || !design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  if (design.profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (await designHasDmcaReports(designId)) {
      return NextResponse.json(
        {
          error: "This design can’t be deleted while compliance records reference it.",
          code: "HAS_DMCA",
        },
        { status: 409 },
      );
    }

    if (await designHasOrderHistoryViaProducts(designId)) {
      return NextResponse.json(
        {
          error:
            "This design still has listings that were purchased. Remove unsold listings first, or contact support.",
          code: "HAS_ORDER_HISTORY",
        },
        { status: 409 },
      );
    }

    const admin = getServiceClient();
    const { data: products } = await admin.from("products").select("id").eq("design_id", designId);
    const productIds = (products ?? []).map((r) => r.id as string);
    await Promise.all(productIds.map((pid) => removeListingMockupFromStorage(pid).catch(() => {})));

    await removeDesignImageFromStorage(designId).catch(() => {});

    const { error: delErr } = await supabase.from("designs").delete().eq("id", designId);
    if (delErr) {
      console.error("[designs DELETE]", delErr);
      return NextResponse.json({ error: "Could not delete design" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[designs DELETE]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("service-role")) {
      return NextResponse.json(
        { error: "Design deletion isn’t configured on this server." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not delete design" }, { status: 500 });
  }
}
