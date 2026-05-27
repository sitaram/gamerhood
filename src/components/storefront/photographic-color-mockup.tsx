"use client";

import Image from "next/image";
import type { Product } from "@/lib/types";
import { DEFAULT_STORED, normalizedPlacementToPrintful } from "@/lib/print/placement";
import { getMerchPreviewLayout } from "@/lib/create/merch-preview-layout";
import { getPrintAreaInches } from "@/lib/printful/catalog";

/**
 * Composite the saved design over a real per-color Printful blank photo.
 * Same placement geometry as `MerchPlacementPreview` — the design's
 * transparent pixels reveal the garment beneath, so heathers stay
 * heathered and there's no synthetic backdrop for transparent regions.
 *
 * Single source of truth for "render this listing in a specific color".
 * Used by the product detail page hero image AND the cart line thumbnails;
 * callers fetch the per-color blank URL via `usePrintfulBlankPhoto` and
 * pass it in here.
 */
export function PhotographicColorMockup({
  product,
  photoUrl,
  colorName,
  sizes = "(max-width: 1024px) 100vw, 50vw",
}: {
  product: Product;
  photoUrl: string;
  colorName: string;
  /** Responsive image `sizes` hint; default suits the product detail hero. */
  sizes?: string;
}) {
  const baseLayout = getMerchPreviewLayout(product.productType);
  const layout = baseLayout.photoBand
    ? { ...baseLayout, ...baseLayout.photoBand }
    : baseLayout;
  const area = getPrintAreaInches(product.productType);
  const Aw = area?.width ?? 12;
  const Ah = area?.height ?? 15;
  const pf = normalizedPlacementToPrintful({
    areaWidthIn: Aw,
    areaHeightIn: Ah,
    placement: product.printPlacement ?? DEFAULT_STORED,
  });
  const designImageUrl = product.designImageUrl ?? "";

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-secondary"
      role="img"
      aria-label={`${product.title} preview in ${colorName}`}
    >
      <div className="absolute inset-0">
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes={sizes}
          className="object-contain"
          unoptimized
          draggable={false}
        />
      </div>

      {/**
       * Design overlay — positioned at the same percentages used by the
       * placement editor + storefront card. No background fill so
       * transparent areas of the design show the garment photo through.
       */}
      <div
        className={
          layout.printBandLeftPct != null && layout.printBandWidthPct != null
            ? "pointer-events-none absolute flex items-center justify-center"
            : "pointer-events-none absolute left-1 right-1 flex items-center justify-center sm:left-2 sm:right-2"
        }
        style={{
          top: `${layout.printBandTopPct}%`,
          bottom: `${layout.printBandBottomPct}%`,
          ...(layout.printBandLeftPct != null && layout.printBandWidthPct != null
            ? {
                left: `${layout.printBandLeftPct}%`,
                width: `${layout.printBandWidthPct}%`,
              }
            : {}),
        }}
      >
        <div
          className="relative max-h-full overflow-visible"
          style={{
            aspectRatio: `${Aw} / ${Ah}`,
            width: `${layout.printMaxWidthPct}%`,
          }}
        >
          <div
            className="pointer-events-none absolute"
            style={{
              width: `${(pf.width / pf.area_width) * 100}%`,
              height: `${(pf.height / pf.area_height) * 100}%`,
              left: `${(pf.left / pf.area_width) * 100}%`,
              top: `${(pf.top / pf.area_height) * 100}%`,
            }}
          >
            <Image
              src={designImageUrl}
              alt=""
              fill
              sizes={sizes}
              className="object-contain object-center"
              unoptimized
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
