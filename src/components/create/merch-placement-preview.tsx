"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { MerchGarmentSilhouette } from "@/components/create/merch-garment-silhouette";
import { getMerchPreviewLayout } from "@/lib/create/merch-preview-layout";
import { getPrintAreaInches } from "@/lib/printful/catalog";
import { normalizedPlacementToPrintful } from "@/lib/print/placement";
import { usePrintfulBlankPhoto } from "@/lib/printful/use-blank-photo";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import type { ProductType } from "@/lib/types";

/**
 * Read-only on-merch preview (matches `PrintPlacementEditor` geometry).
 * Used for shop thumbnails and create-flow product tiles.
 */
export function MerchPlacementPreview({
  imageUrl,
  productType,
  placement,
  className,
}: {
  imageUrl: string;
  productType: ProductType;
  placement: StoredPrintPlacement;
  className?: string;
}) {
  const baseLayout = getMerchPreviewLayout(productType);
  const area = getPrintAreaInches(productType);
  const Aw = area?.width ?? 12;
  const Ah = area?.height ?? 15;
  const { url: blankPhotoUrl } = usePrintfulBlankPhoto(productType);
  const layout = blankPhotoUrl && baseLayout.photoBand
    ? { ...baseLayout, ...baseLayout.photoBand }
    : baseLayout;

  const pf = normalizedPlacementToPrintful({
    areaWidthIn: Aw,
    areaHeightIn: Ah,
    placement,
  });

  const artworkInner = (
    <div
      className="pointer-events-none absolute overflow-hidden bg-[#26262b]"
      style={{
        width: `${(pf.width / pf.area_width) * 100}%`,
        height: `${(pf.height / pf.area_height) * 100}%`,
        left: `${(pf.left / pf.area_width) * 100}%`,
        top: `${(pf.top / pf.area_height) * 100}%`,
      }}
    >
      <Image
        src={imageUrl}
        alt=""
        fill
        sizes="256px"
        className="object-cover object-center"
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
            className="relative w-[88%] overflow-hidden rounded-md border border-dashed border-primary/50 bg-muted/40 shadow-inner"
            style={{ aspectRatio: `${Aw} / ${Ah}` }}
          >
            <div className="relative h-full w-full">{artworkInner}</div>
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
                /** Printful flat mockup; renders the same SKU the order will print to. */
                <div className="relative h-full w-full">
                  <Image
                    src={blankPhotoUrl}
                    alt=""
                    fill
                    sizes="256px"
                    className="object-contain"
                    unoptimized
                    draggable={false}
                  />
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
                className="relative max-h-full overflow-hidden rounded-sm border border-dashed border-primary/70 bg-black/20 ring-1 ring-background/60"
                style={{
                  aspectRatio: `${Aw} / ${Ah}`,
                  width: `${layout.printMaxWidthPct}%`,
                }}
              >
                <div className="relative h-full w-full">{artworkInner}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
