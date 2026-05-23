import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { getDefaultProfileForAuthUser } from "@/lib/supabase/queries";
import { decodeDesignDataUrl, uploadProductListingMockup, removeListingMockupFromStorage } from "@/lib/storage";
import {
  bytesToBase64DataUrl,
  capRasterIfHuge,
  isSvgMime,
  rasterizeSvgForPrinting,
} from "@/lib/print/normalize-upload";
import { moderateImageBase64 } from "@/lib/moderation";
import { parseTagsInput, normalizeProductCategoryInput } from "@/lib/slug-utils";
import { parseStoredPlacement } from "@/lib/print/placement";
import { refreshPrintfulListingMockupForProduct } from "@/lib/printful/mockups";
import { productHasOrderHistory } from "@/lib/delete-guards";

export const dynamic = "force-dynamic";

const MAX_MOCKUP_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * PATCH listing metadata for a product you own (tags, category, descriptions, card image, print placement).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await context.params;
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

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, profile_id")
    .eq("id", productId)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row: Record<string, unknown> = {};

  if (typeof body.description === "string") {
    row.description = body.description.slice(0, 4000);
  }

  if (body.seoDescription === null) {
    row.seo_description = null;
  } else if (typeof body.seoDescription === "string") {
    row.seo_description = body.seoDescription.slice(0, 4000) || null;
  }

  if (body.category === null) {
    row.category = null;
  } else if (typeof body.category === "string") {
    row.category = normalizeProductCategoryInput(body.category);
  }

  if (typeof body.tags === "string") {
    const t = parseTagsInput(body.tags);
    row.tags = t.length ? t : null;
  } else if (Array.isArray(body.tags)) {
    const t = parseTagsInput(body.tags.filter((x) => typeof x === "string").join(","));
    row.tags = t.length ? t : null;
  }

  if (body.printPlacement !== undefined) {
    if (body.printPlacement === null) {
      row.print_placement = null;
    } else if (
      typeof body.printPlacement === "object" &&
      body.printPlacement !== null &&
      !Array.isArray(body.printPlacement)
    ) {
      const parsed = parseStoredPlacement(body.printPlacement);
      if (parsed === null) {
        return NextResponse.json({ error: "Invalid printPlacement payload" }, { status: 400 });
      }
      row.print_placement = parsed;
    } else {
      return NextResponse.json(
        { error: "printPlacement must be a placement object or null" },
        { status: 400 },
      );
    }
  }

  const mockupDataUrl =
    typeof body.mockupImageDataUrl === "string" && body.mockupImageDataUrl.startsWith("data:")
      ? body.mockupImageDataUrl
      : null;

  if (mockupDataUrl) {
    const decoded = decodeDesignDataUrl(mockupDataUrl);
    if (!decoded) {
      return NextResponse.json(
        { error: "Couldn't read that image — try PNG, JPG, WebP, GIF, or SVG." },
        { status: 400 },
      );
    }
    if (decoded.bytes.length > MAX_MOCKUP_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image is too large — please pick something under 8 MB." },
        { status: 400 },
      );
    }

    let uploadBytes = decoded.bytes;
    let uploadMime = decoded.mimeType.split(";")[0].trim().toLowerCase();
    const allowedUpload = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;
    if (!allowedUpload.test(uploadMime)) {
      return NextResponse.json(
        { error: "Unsupported file type — use PNG, JPG, WebP, GIF, or SVG." },
        { status: 400 },
      );
    }

    try {
      if (isSvgMime(uploadMime)) {
        uploadBytes = await rasterizeSvgForPrinting(uploadBytes);
        uploadMime = "image/png";
      } else {
        const capped = await capRasterIfHuge(uploadBytes, uploadMime);
        uploadBytes = capped.buffer;
        uploadMime = capped.mimeOut;
      }
    } catch (err) {
      const tag = err instanceof Error ? err.message : "";
      console.error("[products PATCH] Image normalization failed:", err);
      const msg =
        tag === "INVALID_SVG"
          ? "Couldn't process this SVG — check that it's valid, or export as PNG."
          : "Couldn't process uploaded image.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const normalizedDataUrl = bytesToBase64DataUrl(uploadBytes, uploadMime);
    const moderation = await moderateImageBase64(normalizedDataUrl);
    if (!moderation.safe) {
      return NextResponse.json(
        {
          error:
            "That image didn't pass our content check. Please try a different one.",
          flags: moderation.flags,
        },
        { status: 400 },
      );
    }

    try {
      row.mockup_url = await uploadProductListingMockup(productId, normalizedDataUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      console.error("[products PATCH] Mockup storage error:", e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  /** Service client + owner scope avoids “0 rows” from `.single()` when RLS blocks PATCH for the JWT. */
  let writer: SupabaseClient;
  let scopedToOwnerProfile: boolean;
  try {
    writer = getServiceClient();
    scopedToOwnerProfile = true;
  } catch {
    writer = supabase;
    scopedToOwnerProfile = false;
  }

  let updateQ = writer.from("products").update(row).eq("id", productId);
  if (scopedToOwnerProfile) {
    updateQ = updateQ.eq("profile_id", profile.id);
  }
  const { data: updated, error } = await updateQ.select().single();

  if (error) {
    console.error("[products PATCH]", error.message, error.code, error.details);
    return NextResponse.json(
      { error: error.message || "Update failed", code: error.code },
      { status: 500 },
    );
  }

  let responseProduct = updated;

  if (body.printPlacement !== undefined) {
    await refreshPrintfulListingMockupForProduct(writer, productId).catch((err) =>
      console.warn("[products PATCH] Printful listing mockup refresh skipped/failed:", err),
    );
    const againQuery = scopedToOwnerProfile
      ? writer
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("profile_id", profile.id)
          .single()
      : writer.from("products").select("*").eq("id", productId).single();

    const { data: again } = await againQuery;
    if (again) responseProduct = again;
  }

  return NextResponse.json({ product: responseProduct });
}

/**
 * Remove a storefront listing when it has never been purchased (preserves receipts when orders exist).
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await context.params;
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

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, profile_id")
    .eq("id", productId)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (product.profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    if (await productHasOrderHistory(productId)) {
      return NextResponse.json(
        {
          error:
            "This listing has purchase history and can’t be deleted. Contact support if you need help.",
          code: "HAS_ORDER_HISTORY",
        },
        { status: 409 },
      );
    }

    await removeListingMockupFromStorage(productId).catch(() => {});

    const { error: delErr } = await supabase.from("products").delete().eq("id", productId);
    if (delErr) {
      console.error("[products DELETE]", delErr);
      return NextResponse.json({ error: "Could not delete listing" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[products DELETE]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("service-role")) {
      return NextResponse.json(
        { error: "Listing deletion isn’t configured on this server." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Could not delete listing" }, { status: 500 });
  }
}
