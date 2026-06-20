"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MerchGarmentSilhouette } from "@/components/create/merch-garment-silhouette";
import { getMerchPreviewLayout } from "@/lib/create/merch-preview-layout";
import { usePrintfulBlankPhoto } from "@/lib/printful/use-blank-photo";
import {
  computeDesignOverlayBox,
  getDefaultPrintAreaInches,
} from "@/lib/print/overlay-geometry";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import type { ProductType } from "@/lib/types";

/**
 * Read-only on-merch preview — composites a design over the Printful flat
 * mockup (or SVG silhouette fallback). Used for shop thumbnails and
 * create-flow product tiles.
 *
 * Geometry comes from `computeDesignOverlayBox`; do not recompute band /
 * design pcts inline here — every surface must funnel through that helper
 * so the rendered design always reflects Printful's live print area.
 */
export function MerchPlacementPreview({
  imageUrl,
  productType,
  placement,
  blankColorName,
  showPrintAreaFrame = true,
  transparentBlankBackdrop = false,
  className,
}: {
  imageUrl: string;
  productType: ProductType;
  placement: StoredPrintPlacement;
  /** Optional preferred blank color (e.g. "Black") for catalog-photo previews. */
  blankColorName?: string | null;
  /** Draw the dashed print-area guide (editing/tuning surfaces). */
  showPrintAreaFrame?: boolean;
  /** Use transparent backdrop behind blank photos (storefront surfaces). */
  transparentBlankBackdrop?: boolean;
  className?: string;
}) {
  const baseLayout = getMerchPreviewLayout(productType);
  const preferredBlank = usePrintfulBlankPhoto(productType, blankColorName);
  const defaultBlank = usePrintfulBlankPhoto(productType);
  const [failedUrls, setFailedUrls] = useState<Record<string, true>>({});

  const preferredUrl =
    blankColorName && preferredBlank.url && !failedUrls[preferredBlank.url]
      ? preferredBlank.url
      : null;
  const defaultUrl =
    defaultBlank.url && !failedUrls[defaultBlank.url] ? defaultBlank.url : null;

  const usingPreferredBlank = Boolean(preferredUrl);
  const activeBlank = usingPreferredBlank ? preferredBlank : defaultBlank;
  const blankPhotoUrl = preferredUrl ?? defaultUrl;
  const blankLoading = !blankPhotoUrl && (preferredBlank.loading || defaultBlank.loading);
  const liveArea = activeBlank.area;
  const blankPixelRect = activeBlank.pixelRect;
  const blankBackdropColor = activeBlank.backdropColor;
  const layout = blankPixelRect
    ? {
        ...baseLayout,
        garmentAspect: blankPixelRect.mockupWidthPx / blankPixelRect.mockupHeightPx,
      }
    : blankPhotoUrl && baseLayout.photoBand
      ? { ...baseLayout, ...baseLayout.photoBand }
      : baseLayout;

  const overlay = computeDesignOverlayBox({
    productType,
    layout,
    printAreaInches: liveArea,
    defaultPrintAreaInches: getDefaultPrintAreaInches(productType),
    normalizedPlacement: placement,
    printAreaPixelRect: blankPhotoUrl ? blankPixelRect : null,
  });

  const renderArtwork = (opacity: number) => (
    <div
      className="pointer-events-none absolute"
      style={{
        width: `${overlay.design.widthPct}%`,
        height: `${overlay.design.heightPct}%`,
        left: `${overlay.design.leftPct}%`,
        top: `${overlay.design.topPct}%`,
        opacity,
      }}
    >
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes="256px"
        className="object-contain object-center"
        unoptimized
        draggable={false}
      />
    </div>
  );

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg bg-secondary", className)}>
      {!layout.showGarment ? (
        <div className="flex h-full w-full items-center justify-center p-2">
          <div
            className={cn(
              "relative w-[88%] overflow-hidden rounded-md",
              showPrintAreaFrame
                ? "border border-dashed border-primary/50 bg-muted/40 shadow-inner"
                : "border-0 bg-transparent shadow-none",
            )}
            style={{ aspectRatio: overlay.band.aspectRatio }}
          >
            <div className="relative h-full w-full">{renderArtwork(1)}</div>
          </div>
        </div>
      ) : (
        <div className="relative h-full min-h-0 w-full overflow-hidden">
          <div
            className="absolute left-1/2 top-[48%] w-[94%] max-h-[92%] -translate-x-1/2 -translate-y-1/2"
            style={{ aspectRatio: `${layout.garmentAspect}` }}
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-1 sm:p-2">
              {blankPhotoUrl ? (
                <div
                  className="relative h-full w-full overflow-hidden"
                  style={{
                    backgroundColor: transparentBlankBackdrop
                      ? "transparent"
                      : blankBackdropColor ?? "#ffffff",
                  }}
                >
                  <Image
                    src={blankPhotoUrl}
                    alt=""
                    fill
                    sizes="256px"
                    className="object-contain"
                    unoptimized
                    draggable={false}
                    onError={() => {
                      setFailedUrls((prev) => ({ ...prev, [blankPhotoUrl]: true }));
                    }}
                  />
                </div>
              ) : blankLoading ? (
                /**
                 * Show immediate silhouette + artwork while Printful blank warms.
                 * This avoids long "empty card" waits on first storefront loads.
                 */
                <div
                  style={{
                    width: "min(88%, 260px)",
                    aspectRatio: `${layout.garmentAspect}`,
                    maxHeight: "94%",
                  }}
                >
                  <MerchGarmentSilhouette type={productType} className="block h-full w-full text-foreground" />
                </div>
              ) : (
                <div
                  style={{
                    width: "min(88%, 260px)",
                    aspectRatio: `${layout.garmentAspect}`,
                    maxHeight: "94%",
                  }}
                >
                  <MerchGarmentSilhouette type={productType} className="block h-full w-full text-foreground" />
                </div>
              )}
            </div>

            {showPrintAreaFrame ? (
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
                  className="relative max-h-full overflow-visible rounded-sm border border-dashed border-primary/70 ring-1 ring-background/60"
                  style={{
                    aspectRatio: overlay.band.aspectRatio,
                    width:
                      overlay.band.leftPct != null
                        ? "100%"
                        : `${overlay.band.widthPct}%`,
                  }}
                >
                  <div className="pointer-events-none absolute inset-0">
                    {renderArtwork(0.3)}
                  </div>
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm">
                    {renderArtwork(1)}
                  </div>
                </div>
              </div>
            ) : (
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
                  className="relative max-h-full"
                  style={{
                    aspectRatio: overlay.band.aspectRatio,
                    width:
                      overlay.band.leftPct != null
                        ? "100%"
                        : `${overlay.band.widthPct}%`,
                  }}
                >
                  <div className="pointer-events-none absolute inset-0">{renderArtwork(1)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
