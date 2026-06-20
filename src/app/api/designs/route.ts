import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getDesignsByProfilePaginated,
  insertDesign,
} from "@/lib/supabase/queries";
import { toDashboardDesignCard } from "@/lib/design-image-url";
import { normalizeUploadedDesignDataUrl } from "@/lib/design/persist-upload";
import { uploadDesignAssetDerivatives } from "@/lib/storage";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 24;

/**
 * GET /api/designs?limit=24&cursor=<iso-created_at>
 * Lists the signed-in creator's saved designs (newest first).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ designs: [], nextCursor: null });
  }

  const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 48)
      : DEFAULT_LIMIT;
  const cursor = request.nextUrl.searchParams.get("cursor");

  const { data, error } = await getDesignsByProfilePaginated(supabase, profile.id, {
    limit,
    cursor,
  });

  if (error) {
    console.error("[designs GET list]", error);
    return NextResponse.json({ error: "Could not load your designs" }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

  return NextResponse.json({
    designs: page.map(toDashboardDesignCard),
    nextCursor,
  });
}

/**
 * POST /api/designs
 * Saves an uploaded artwork to the creator's library immediately (before publish).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to save uploads to your library" }, { status: 401 });
  }

  let body: {
    imageUrl?: string;
    style?: string;
    prompt?: string | null;
    title?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.imageUrl?.trim()) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  const normalized = await normalizeUploadedDesignDataUrl(body.imageUrl.trim());
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: normalized.status });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No creator profile found" }, { status: 400 });
  }

  const title =
    body.title?.trim() ||
    body.prompt?.trim()?.slice(0, 80) ||
    "Uploaded artwork";
  const style = typeof body.style === "string" && body.style.trim() ? body.style.trim() : "minimalist";

  const { data: design, error: designErr } = await insertDesign(supabase, {
    profile_id: profile.id,
    title,
    image_url: normalized.value.imageForPersist,
    prompt: body.prompt?.trim() || null,
    style,
    status: "approved",
    content_safe: true,
    has_transparency: normalized.value.hasTransparency,
    uploaded_as_svg: normalized.value.uploadedAsSvg,
  });

  if (designErr || !design) {
    console.error("[designs POST save upload]", designErr);
    return NextResponse.json({ error: "Failed to save upload" }, { status: 500 });
  }

  let publicImageUrl = normalized.value.imageForPersist;
  try {
    const assets = await uploadDesignAssetDerivatives(design.id, normalized.value.imageForPersist, {
      sourceSvgDataUrl: normalized.value.sourceSvgDataUrl,
    });
    publicImageUrl = assets.printUrl;
    if (publicImageUrl !== normalized.value.imageForPersist) {
      await supabase
        .from("designs")
        .update({ image_url: publicImageUrl })
        .eq("id", design.id);
    }
  } catch (err) {
    console.warn("[designs POST save upload] Storage upload failed:", err);
  }

  return NextResponse.json({
    designId: design.id,
    imageUrl: publicImageUrl,
    hasTransparency: normalized.value.hasTransparency,
    uploadedAsSvg: normalized.value.uploadedAsSvg,
    design: toDashboardDesignCard({ ...design, image_url: publicImageUrl }),
  });
}
