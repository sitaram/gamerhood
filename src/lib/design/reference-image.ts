import { decodeDesignDataUrl } from "@/lib/storage";

const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

export type ReferenceImagePayload = { mimeType: string; base64: string };

/**
 * Resolve a design image (data URL or hosted URL) into base64 for Gemini
 * inlineData. Restricts http(s) fetches to our Supabase public bucket so
 * callers can't use the generate route as an open proxy.
 */
export async function loadReferenceImageFromUrl(
  url: string,
): Promise<ReferenceImagePayload | null> {
  if (url.startsWith("data:")) {
    const decoded = decodeDesignDataUrl(url);
    if (!decoded || decoded.bytes.length > MAX_REFERENCE_BYTES) return null;
    const mimeType = decoded.mimeType.split(";")[0].trim().toLowerCase();
    if (!mimeType.startsWith("image/")) return null;
    return { mimeType, base64: decoded.bytes.toString("base64") };
  }

  if (!url.startsWith("https://") && !url.startsWith("http://")) return null;
  if (!isAllowedReferenceUrl(url)) return null;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_REFERENCE_BYTES) return null;

  const mimeType =
    res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "image/png";
  if (!mimeType.startsWith("image/")) return null;

  return { mimeType, base64: buf.toString("base64") };
}

function isAllowedReferenceUrl(url: string): boolean {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (supabaseOrigin && url.startsWith(supabaseOrigin)) {
    return url.includes("/storage/v1/object/public/design-images/");
  }
  // Local dev: allow fetching from the same Next app (e.g. /api/… or public/).
  if (process.env.NODE_ENV === "development") {
    try {
      const { hostname } = new URL(url);
      return hostname === "localhost" || hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  return false;
}
