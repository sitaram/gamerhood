import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDesignById } from "@/lib/supabase/queries";
import { decodeDesignDataUrl } from "@/lib/storage";

/**
 * Serves a design's raster for `<img src>` — decodes inline data URLs or
 * redirects to the public Storage URL. Same-origin so dashboard cards can
 * load creator-owned designs with session cookies.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: design, error } = await getDesignById(supabase, id);
  if (error || !design?.image_url) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = design.image_url.trim();

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return NextResponse.redirect(url, 307);
  }

  if (url.startsWith("data:")) {
    const decoded = decodeDesignDataUrl(url);
    if (!decoded) {
      return new NextResponse("Invalid image data", { status: 400 });
    }
    const mime = decoded.mimeType.split(";")[0].trim() || "image/png";
    return new NextResponse(new Uint8Array(decoded.bytes), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new NextResponse("Unsupported image URL", { status: 400 });
}
