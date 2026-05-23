// Supabase Storage helpers for design assets.
//
// Why this exists: Printful's order endpoint accepts a public URL per design
// layer and fetches the asset itself — it does not accept base64 contents
// or multipart uploads. Our designs are produced as data URLs (Gemini's raw
// output, or browser FileReader for uploads), so we need somewhere
// publicly-fetchable to host them before referencing in an order.
//
// We use a public Supabase Storage bucket (`design-images`) created in
// migration 003. Reads are unauthenticated; writes happen here, server-side,
// using the service-role client so we don't have to expose a storage policy
// to the browser bundle.

import { getServiceClient } from "@/lib/supabase/admin";

const BUCKET = "design-images";

/**
 * Returns true when Storage uploads are usable (service-role configured).
 * Lets callers degrade gracefully — e.g. keep the inline data URL on the
 * design row when Storage isn't set up rather than failing the whole
 * publish. Printful fulfillment is unavailable in that mode (Printful
 * fetches by URL), but the storefront still renders.
 */
function isStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export interface DecodedDesignDataUrl {
  bytes: Buffer;
  mimeType: string;
  extension: string;
}

function mimeToExtension(mime: string): string {
  const root = mime.toLowerCase().split(";")[0].trim();
  if (root === "image/svg+xml") return "svg";
  if (root === "image/jpeg") return "jpg";
  return root.split("/")[1]?.split("+")[0] || "bin";
}

/**
 * Decode a browser `data:` URL into raw bytes — supports BOTH:
 * - `data:image/png;base64,...` (Gemini, most JPG/PNG uploads)
 * - `data:image/svg+xml;charset=utf-8,...` (many browsers' SVG `readAsDataURL`)
 *
 * Percent-encoded payloads use `decodeURIComponent` per RFC 2397.
 */
export function decodeDesignDataUrl(input: string): DecodedDesignDataUrl | null {
  if (!input.startsWith("data:")) return null;

  const comma = input.indexOf(",", 5);
  if (comma === -1) return null;

  const header = input.slice(5, comma);
  const rawData = input.slice(comma + 1);
  const isBase64 = /;base64/i.test(header);

  const mimeType = header.split(";")[0].trim() || "application/octet-stream";
  const extension = mimeToExtension(mimeType);

  if (isBase64) {
    const cleaned = rawData.replace(/\s/g, "");
    const bytes = Buffer.from(cleaned, "base64");
    return { bytes, mimeType, extension };
  }

  try {
    // UTF-8 or percent-encoded (SVG/XML text common here)
    const decoded = decodeURIComponent(rawData.replace(/\+/g, "%20"));
    const bytes = Buffer.from(decoded, "utf8");
    return { bytes, mimeType, extension };
  } catch {
    return null;
  }
}

interface DataUrlPayload {
  bytes: Buffer;
  mimeType: string;
  extension: string;
}

function decodeOrThrow(input: string): DataUrlPayload {
  const d = decodeDesignDataUrl(input);
  if (!d) {
    throw new Error("decodeDesignImage: unrecognized data URL (need base64 or UTF-8 data: URL)");
  }
  return d;
}

/**
 * Upload a base64 data URL to the public design-images bucket and return a
 * URL that any external service (Printful, browsers, search crawlers) can
 * fetch directly. If the input is already an http(s) URL we return it
 * unchanged — designs migrated from external sources don't need re-hosting.
 *
 * When `SUPABASE_SERVICE_ROLE_KEY` is missing (common on partial Vercel
 * setups), this falls back to the original data URL so publish keeps
 * working end-to-end — the storefront still renders, just with the
 * larger inline image; Printful fulfillment stays disabled until the
 * env var is set on the deployment.
 *
 * Throws on storage errors (other than missing service-role config) so
 * callers can decide whether to fail the publish or fall back to the
 * original URL.
 */
export async function uploadDesignImage(
  designId: string,
  imageUrl: string,
): Promise<string> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (!isStorageConfigured()) {
    console.warn(
      "[storage] SUPABASE_SERVICE_ROLE_KEY not set — keeping inline data URL on " +
        "design row. Add the env var on the deployment to enable Storage hosting " +
        "and Printful fulfillment.",
    );
    return imageUrl;
  }

  const payload = decodeOrThrow(imageUrl);

  const path = `${designId}.${payload.extension}`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, payload.bytes, {
    contentType: payload.mimeType.split(";")[0].trim(),
    // Replace if a previous publish for this design id half-uploaded;
    // designs are immutable from the user's POV but the upload itself
    // can be retried after a transient error.
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed for ${path}: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error(`Storage upload succeeded but no public URL returned for ${path}`);
  }
  return data.publicUrl;
}

const DESIGN_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"] as const;

/** Best-effort remove design file(s) from public bucket (paths used by `uploadDesignImage`). */
export async function removeDesignImageFromStorage(designId: string): Promise<void> {
  const supabase = getServiceClient();
  const paths = DESIGN_IMAGE_EXTENSIONS.map((ext) => `${designId}.${ext}`);
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error && !/not found/i.test(String(error.message))) {
    console.warn("[storage] remove design images:", error.message);
  }
}

const LISTING_MOCKUPS_PREFIX = "listing-mockups";

/** Best-effort remove custom listing mockup objects for a product id. */
export async function removeListingMockupFromStorage(productId: string): Promise<void> {
  const supabase = getServiceClient();
  const paths = DESIGN_IMAGE_EXTENSIONS.map((ext) => `${LISTING_MOCKUPS_PREFIX}/${productId}.${ext}`);
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error && !/not found/i.test(String(error.message))) {
    console.warn("[storage] remove listing mockups:", error.message);
  }
}

/**
 * Product card image on `/shop/[slug]` and `/product/[id]`.
 * Stored separately from the design file so creators can refresh the listing thumbnail.
 */
export async function uploadProductListingMockup(
  productId: string,
  imageUrl: string,
): Promise<string> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (!isStorageConfigured()) {
    console.warn(
      "[storage] SUPABASE_SERVICE_ROLE_KEY not set — listing mockup upload skipped " +
        "(keeping original URL).",
    );
    return imageUrl;
  }

  const payload = decodeOrThrow(imageUrl);
  const path = `${LISTING_MOCKUPS_PREFIX}/${productId}.${payload.extension}`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, payload.bytes, {
    contentType: payload.mimeType.split(";")[0].trim(),
    upsert: true,
  });

  if (error) {
    throw new Error(`Listing mockup upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error(`Listing mockup upload succeeded but no public URL for ${path}`);
  }
  return data.publicUrl;
}

const STOREFRONT_PREFIX = "storefront";

/**
 * Hero / homepage images for creator storefronts (same public bucket as designs).
 */
export async function uploadStorefrontHeroImage(
  profileId: string,
  imageUrl: string,
): Promise<string> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (!isStorageConfigured()) {
    throw new Error(
      "Storage isn't configured on this deployment (missing SUPABASE_SERVICE_ROLE_KEY) " +
        "— please upload a hosted image URL instead, or set the env var.",
    );
  }

  const payload = decodeOrThrow(imageUrl);
  const path = `${STOREFRONT_PREFIX}/${profileId}/hero.${payload.extension}`;
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, payload.bytes, {
    contentType: payload.mimeType.split(";")[0].trim(),
    upsert: true,
  });

  if (error) {
    throw new Error(`Storefront hero upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error(`Storefront hero upload succeeded but no public URL for ${path}`);
  }
  return data.publicUrl;
}
