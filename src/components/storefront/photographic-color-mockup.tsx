"use client";

import Image from "next/image";
import type { Product } from "@/lib/types";
import { DEFAULT_STORED } from "@/lib/print/placement";
import { getMerchPreviewLayout } from "@/lib/create/merch-preview-layout";
import {
  computeDesignOverlayBox,
  getDefaultPrintAreaInches,
} from "@/lib/print/overlay-geometry";

/**
 * Composite the saved design over a real per-color Printful blank photo.
 *
 * Geometry comes from the unified `computeDesignOverlayBox` helper so the
 * design size always reflects Printful's authoritative print area — even
 * when the buyer swaps colors. The helper takes the *per-color* live print
 * area (when known via the blank-photo cache) so any per-variant
 * differences are picked up automatically.
 *
 * Used by the product detail page hero image AND the cart line thumbnails;
 * callers fetch the per-color blank URL + print area via
 * `usePrintfulBlankPhoto` and pass it in here.
 */
export function PhotographicColorMockup({
  product,
  photoUrl,
  colorName,
  printAreaInches = null,
  printAreaPixelRect = null,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  onPhotoLoad,
}: {
  product: Product;
  photoUrl: string;
  colorName: string;
  /**
   * Per-variant Printful print area in inches (from the blank-photo
   * cache). When null the helper falls back to `DEFAULT_PRINT_AREA_IN` —
   * use only as a last resort: legacy rows pre-migration 023.
   */
  printAreaInches?: { width: number; height: number } | null;
  /**
   * Authoritative pixel-space rect for the print box on `photoUrl`. When
   * set, the design is composited at the exact Printful coords; when
   * null we fall back to the hand-tuned photoBand. Per-color Track A
   * catalog photos are framed differently than the mockup-tasks default,
   * so callers pass this only for the default-color render path.
   */
  printAreaPixelRect?: {
    mockupWidthPx: number;
    mockupHeightPx: number;
    xPx: number;
    yPx: number;
    wPx: number;
    hPx: number;
  } | null;
  /** Responsive image `sizes` hint; default suits the product detail hero. */
  sizes?: string;
  /**
   * Fires once the per-color blank photo has fully decoded. The product
   * detail crossfade stack uses this to know when the new layer is safe
   * to fade in (so the design overlay never appears without its garment).
   */
  onPhotoLoad?: () => void;
}) {
  const baseLayout = getMerchPreviewLayout(product.productType);
  const layout = baseLayout.photoBand
    ? { ...baseLayout, ...baseLayout.photoBand }
    : baseLayout;

  const overlay = computeDesignOverlayBox({
    productType: product.productType,
    layout,
    printAreaInches,
    defaultPrintAreaInches: getDefaultPrintAreaInches(product.productType),
    normalizedPlacement: product.printPlacement ?? DEFAULT_STORED,
    printAreaPixelRect,
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
          onLoad={onPhotoLoad}
        />
      </div>

      <div
        className={
          overlay.band.leftPct != null
            ? "pointer-events-none absolute flex items-center justify-center"
            : "pointer-events-none absolute left-1 right-1 flex items-center justify-center sm:left-2 sm:right-2"
        }
        style={{
          top: `${overlay.band.topPct}%`,
          bottom: `${overlay.band.bottomPct}%`,
          ...(overlay.band.leftPct != null
            ? {
                left: `${overlay.band.leftPct}%`,
                width: `${overlay.band.widthPct}%`,
              }
            : {}),
        }}
      >
        <div
          className="relative max-h-full overflow-visible"
          style={{
            aspectRatio: overlay.band.aspectRatio,
            width:
              overlay.band.leftPct != null
                ? "100%"
                : `${overlay.band.widthPct}%`,
          }}
        >
          <div
            className="pointer-events-none absolute"
            style={{
              width: `${overlay.design.widthPct}%`,
              height: `${overlay.design.heightPct}%`,
              left: `${overlay.design.leftPct}%`,
              top: `${overlay.design.topPct}%`,
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
