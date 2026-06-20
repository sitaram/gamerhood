import type { DesignRow } from "@/lib/supabase/queries";

/**
 * URL safe to pass through the RSC → client-component boundary.
 * Inline `data:` URLs (multi‑KB base64 from Gemini) can break Flight
 * serialization for the whole designs array, so dashboard cards use a
 * same-origin proxy instead.
 */
export function designCardImageSrc(d: Pick<DesignRow, "id" | "image_url">): string {
  return `/api/designs/${d.id}/image?pv=1`;
}

/** Same-origin preview URL for compositing art on merch mockups in the create flow. */
export function designPreviewImageSrc(designId: string): string {
  return `/api/designs/${designId}/image?pv=1`;
}

/** Plain JSON row for client components — never includes inline data URLs. */
export function toDashboardDesignCard(
  d: Pick<DesignRow, "id" | "title" | "prompt" | "style" | "created_at" | "image_url">,
) {
  return {
    id: d.id,
    title: d.title,
    prompt: d.prompt,
    style: d.style,
    created_at: d.created_at,
    image_url: designCardImageSrc(d),
  };
}
