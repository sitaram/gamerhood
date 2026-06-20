import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDesignById } from "@/lib/supabase/queries";
import { decodeDesignDataUrl, getDesignAssetPublicUrl } from "@/lib/storage";
import { getServiceClient } from "@/lib/supabase/admin";
import { stripCheckerboardArtifacts } from "@/lib/print/normalize-upload";
import { stripDesignArtifactsForSanitizedPreview } from "@/lib/print/artifact-strip";

/**
 * Serves a design's raster for `<img src>` — decodes inline data URLs or
 * redirects to the public Storage URL. Same-origin so dashboard cards can
 * load creator-owned designs with session cookies.
 *
 * `?pv=1` (preview compositing for listing mockups) runs display sanitization
 * so baked-in transparency checkerboards never paint over garment photos.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const previewMode = request.nextUrl.searchParams.get("pv") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPublishedDesign = async (): Promise<boolean> => {
    try {
      const admin = getServiceClient();
      const { data, error } = await admin
        .from("products")
        .select("id")
        .eq("design_id", id)
        .eq("is_published", true)
        .limit(1)
        .maybeSingle();
      if (error) return false;
      return Boolean(data?.id);
    } catch {
      return false;
    }
  };

  if (!user) {
    const published = await isPublicPublishedDesign();
    if (!published) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const readDesignViaAdmin = async (): Promise<string | null> => {
    try {
      const admin = getServiceClient();
      const { data, error } = await admin
        .from("designs")
        .select("image_url")
        .eq("id", id)
        .maybeSingle();
      if (error) return null;
      const u = data?.image_url;
      return typeof u === "string" && u.trim() ? u.trim() : null;
    } catch {
      return null;
    }
  };

  const { data: design, error } = await getDesignById(supabase, id);
  let resolvedUrl = design?.image_url?.trim() || null;
  if ((!resolvedUrl || error) && !user) {
    resolvedUrl = await readDesignViaAdmin();
  }
  if (!resolvedUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  const serveBytes = async (
    buf: Buffer,
    mimeHint: string,
    cacheControl = "public, max-age=3600",
  ): Promise<NextResponse> =>
    new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeHint,
        "Cache-Control": cacheControl,
      },
    });

  const shouldRepairChecker =
    !previewMode && (Boolean(design?.uploaded_as_svg) || design?.has_transparency === false);

  const repairIfNeeded = async (buf: Buffer, mimeHint: string): Promise<NextResponse> => {
    if (previewMode) {
      try {
        const sanitized = await stripDesignArtifactsForSanitizedPreview(buf);
        return serveBytes(sanitized, "image/png");
      } catch {
        return serveBytes(buf, mimeHint);
      }
    }
    if (!shouldRepairChecker) return serveBytes(buf, mimeHint);
    const cleaned = await stripCheckerboardArtifacts(buf, mimeHint).catch(() => ({
      buffer: buf,
      mimeOut: mimeHint,
    }));
    return serveBytes(cleaned.buffer, cleaned.mimeOut);
  };

  if (previewMode) {
    for (const kind of ["preview", "print"] as const) {
      try {
        const assetUrl = getDesignAssetPublicUrl(id, kind);
        const res = await fetch(assetUrl);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          return repairIfNeeded(Buffer.from(arr), "image/png");
        }
      } catch {
        // Try the next derivative path.
      }
    }
  }

  if (resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://")) {
    if (!previewMode && !shouldRepairChecker) {
      return NextResponse.redirect(resolvedUrl, 307);
    }
    try {
      const res = await fetch(resolvedUrl);
      if (!res.ok) return new NextResponse("Not found", { status: 404 });
      const arr = await res.arrayBuffer();
      const mime = res.headers.get("content-type")?.split(";")[0].trim() || "image/png";
      return repairIfNeeded(Buffer.from(arr), mime);
    } catch {
      return NextResponse.redirect(resolvedUrl, 307);
    }
  }

  if (resolvedUrl.startsWith("data:")) {
    const decoded = decodeDesignDataUrl(resolvedUrl);
    if (!decoded) {
      return new NextResponse("Invalid image data", { status: 400 });
    }
    const mime = decoded.mimeType.split(";")[0].trim() || "image/png";
    return repairIfNeeded(decoded.bytes, mime);
  }

  return new NextResponse("Unsupported image URL", { status: 400 });
}
