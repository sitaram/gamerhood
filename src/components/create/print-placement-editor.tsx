"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MerchGarmentSilhouette } from "@/components/create/merch-garment-silhouette";
import { getMerchPreviewLayout } from "@/lib/create/merch-preview-layout";
import { getPrintAreaInches } from "@/lib/printful/catalog";
import { usePrintfulBlankPhoto } from "@/lib/printful/use-blank-photo";
import {
  normalizedPlacementToPrintful,
  PLACEMENT_ZOOM_MAX,
  PLACEMENT_ZOOM_MIN,
  PLACEMENT_ZOOM_DEFAULT,
} from "@/lib/print/placement";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import type { ProductType } from "@/lib/types";
import { PRODUCT_TYPE_LABELS } from "@/components/storefront/product-card";

/** Deterministic default when several product types are selected (batch placement). */
export function pickStablePreviewType(selected: Set<ProductType>): ProductType {
  const first = [...selected].sort((a, b) => a.localeCompare(b))[0];
  return first ?? "hoodie";
}

function previewGuideLine(previewType: ProductType): string {
  if (previewType === "joggers") {
    return "along the outer leg on a simple sweatpants outline (leg strip print).";
  }
  const apparel = new Set<ProductType>([
    "hoodie",
    "kids-hoodie",
    "tshirt",
    "kids-tshirt",
    "kids-heavyweight-tee",
    "kids-long-sleeve",
    "kids-sports-tee",
    "pet-sweater",
    "blanket",
  ]);
  if (apparel.has(previewType)) {
    if (previewType === "hoodie" || previewType === "kids-hoodie") {
      return "front-view sketch only — art lands on the chest inside the dashed box; the curved hood above is not printable.";
    }
    if (previewType === "pet-sweater") return "on a simple pet + sweater silhouette (chest motif).";
    if (previewType === "blanket") return "centered on a folded blanket silhouette (embroidered area).";
    return "on an illustrative garment outline.";
  }
  return "inside a silhouette that matches this product category (poster, mug, tote, pillow, puzzle, ornament, sticker, patch, journal, phone case, etc.).";
}

function clampPan(n: number): number {
  return Math.min(1, Math.max(-1, n));
}

interface Props {
  imageUrl: string | null;
  selectedProductTypes: Set<ProductType>;
  value: StoredPrintPlacement;
  onChange: Dispatch<SetStateAction<StoredPrintPlacement>>;
  onAspectDetected?: (aspect: number) => void;
  /** Hide the note about sharing framing across types (single-item tuning dialogs). */
  hideBatchPlacementNote?: boolean;
}

export function PrintPlacementEditor({
  imageUrl,
  selectedProductTypes,
  value,
  onChange,
  onAspectDetected,
  hideBatchPlacementNote = false,
}: Props) {
  const singleSelected =
    selectedProductTypes.size === 1 ? [...selectedProductTypes][0]! : undefined;

  /** User's batch-preview override; ignored when no longer in the current selection (React Compiler auto-memoizes). */
  const [batchPreviewType, setBatchPreviewType] = useState<ProductType | null>(null);

  const previewType: ProductType = singleSelected
    ? singleSelected
    : batchPreviewType && selectedProductTypes.has(batchPreviewType)
      ? batchPreviewType
      : pickStablePreviewType(selectedProductTypes);

  const baseLayout = getMerchPreviewLayout(previewType);
  const { url: blankPhotoUrl, area: liveArea } = usePrintfulBlankPhoto(previewType);
  /**
   * Print area in inches: prefer the live Printful-reported dims (cached on
   * `printful_blank_mockups` and surfaced via the blank-photo API), fall back
   * to our hardcoded DEFAULT_PRINT_AREA_IN values. This keeps the box
   * accurate even when we point env vars at a new SKU without redeploying.
   */
  const hardcodedArea = getPrintAreaInches(previewType);
  const Aw = liveArea?.width ?? hardcodedArea?.width ?? 12;
  const Ah = liveArea?.height ?? hardcodedArea?.height ?? 15;
  /** Flat photo backdrop swaps in the per-SKU print band tune (different framing than the silhouette). */
  const layout = blankPhotoUrl && baseLayout.photoBand
    ? { ...baseLayout, ...baseLayout.photoBand }
    : baseLayout;

  const drag = useRef<{ lastX: number; lastY: number } | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    if (imageUrl.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      const imageAspect =
        img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      onAspectDetected?.(imageAspect);
    };
    img.src = imageUrl;
  }, [imageUrl, onAspectDetected]);

  const pf = normalizedPlacementToPrintful({
    areaWidthIn: Aw,
    areaHeightIn: Ah,
    placement: value,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
    onChange((prev) => ({
      ...prev,
      panX: clampPan(prev.panX + dx / 180),
      panY: clampPan(prev.panY + dy / 180),
    }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      //
    }
    drag.current = null;
  };

  /**
   * Keyboard nudge: arrow keys move panX/panY in [-1, 1] space.
   * Shift = ~4× larger step (coarse positioning). preventDefault so the page
   * doesn't scroll while the editor has focus.
   */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.15 : 0.04;
    let dx = 0;
    let dy = 0;
    switch (e.key) {
      case "ArrowLeft":  dx = -step; break;
      case "ArrowRight": dx =  step; break;
      case "ArrowUp":    dy = -step; break;
      case "ArrowDown":  dy =  step; break;
      default: return;
    }
    e.preventDefault();
    onChange((prev) => ({
      ...prev,
      panX: clampPan(prev.panX + dx),
      panY: clampPan(prev.panY + dy),
    }));
  };

  const zoomMinPct = Math.round(PLACEMENT_ZOOM_MIN * 100);
  const zoomMaxPct = Math.round(PLACEMENT_ZOOM_MAX * 100);
  const zoomPercent = Math.round(value.zoom * 100);

  /**
   * Artwork itself — no inner background tint, so transparent PNGs reveal
   * the checkered "print area" pattern behind them (matching how Printful's
   * editor previews a transparent design).
   */
  const artworkInner = (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{
        width: `${(pf.width / pf.area_width) * 100}%`,
        height: `${(pf.height / pf.area_height) * 100}%`,
        left: `${(pf.left / pf.area_width) * 100}%`,
        top: `${(pf.top / pf.area_height) * 100}%`,
      }}
    >
      <Image
        src={imageUrl!}
        alt="Your artwork placement preview"
        fill
        sizes="480px"
        className="object-contain object-center"
        unoptimized
        draggable={false}
      />
    </div>
  );

  /**
   * CSS checkerboard pattern (8 px squares) — drawn behind the artwork so
   * the print box looks transparent the way Printful's does. Matches the
   * "this is the printable area; design lives inside it" mental model.
   */
  const checkerStyle = {
    backgroundImage:
      "linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.08) 75%)",
    backgroundSize: "16px 16px",
    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
  } as const;

  if (!imageUrl) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4 text-left">
      <div>
        <h3 className="text-lg font-semibold">Line up your art on the merch</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Drag to nudge placement and zoom to crop. The dashed frame matches Printful&apos;s printable box (
          {Aw}&quot;×{Ah}&quot;) for{" "}
          <span className="font-medium text-foreground">
            {PRODUCT_TYPE_LABELS[previewType] ?? previewType.replace(/-/g, " ")}
          </span>
          {layout.showGarment ? (
            <span>{` — ${previewGuideLine(previewType)}`}</span>
          ) : (
            "."
          )}{" "}
          Outline is illustrative only — production uses exactly this crop.
        </p>
      </div>

      {selectedProductTypes.size > 1 && (
        <div className="space-y-1.5 rounded-lg border border-border/50 bg-muted/40 p-3">
          <Label htmlFor="placement-silhouette" className="text-xs font-medium">
            Preview silhouette
          </Label>
          <select
            id="placement-silhouette"
            value={previewType}
            onChange={(e) => setBatchPreviewType(e.target.value as ProductType)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {[...selectedProductTypes].sort((a, b) => a.localeCompare(b)).map((t) => (
              <option key={t} value={t}>
                {PRODUCT_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Your crop is still the batch default for every selected type — pick which shape to preview against.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-xs font-medium text-foreground">Placement preview</p>
          <span className="text-[11px] text-muted-foreground">
            Garment:{" "}
            <span className="font-medium text-foreground">
              {PRODUCT_TYPE_LABELS[previewType] ?? previewType.replace(/-/g, " ")}
            </span>
            {blankPhotoUrl
              ? " · Printful flat mockup"
              : layout.showGarment
                ? " · placement sketch (flat mockup rendering…)"
                : null}
          </span>
        </div>

        {!layout.showGarment ? (
          <div
            className="relative w-full cursor-grab touch-none overflow-hidden rounded-xl border-2 border-dashed border-primary/60 bg-muted/70 shadow-inner outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
            style={{ aspectRatio: `${Aw} / ${Ah}` }}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            role="application"
            aria-label="Adjust design position on printable area — drag, or focus and use arrow keys (hold Shift for bigger steps)"
          >
            <div className="relative h-full w-full">{artworkInner}</div>
          </div>
        ) : (
          <div
            className="relative w-full cursor-grab touch-none overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-secondary/80 via-muted/90 to-muted pb-8 shadow-inner outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
            style={{ aspectRatio: `${layout.garmentAspect}` }}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            role="application"
            aria-label="Adjust design position — drag, or focus and use arrow keys (hold Shift for bigger steps)"
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-2 sm:p-4">
              {blankPhotoUrl ? (
                /** Printful flat mockup as backdrop — generated once per ProductType, cached in `printful_blank_mockups`. */
                <div className="relative h-full w-full overflow-hidden rounded-xl bg-white/[0.03]">
                  <Image
                    src={blankPhotoUrl}
                    alt=""
                    fill
                    sizes="512px"
                    className="object-contain"
                    unoptimized
                    draggable={false}
                  />
                </div>
              ) : (
                <div
                  className="rounded-xl bg-background/25 p-2 ring-1 ring-inset ring-border/50"
                  style={{
                    width: "min(88%, 380px)",
                    aspectRatio: `${layout.garmentAspect}`,
                    maxHeight: "94%",
                  }}
                >
                  <MerchGarmentSilhouette
                    type={previewType}
                    className="block h-full w-full text-foreground"
                  />
                </div>
              )}
            </div>

            <div
              className={
                layout.printBandLeftPct != null && layout.printBandWidthPct != null
                  ? "pointer-events-none absolute flex items-center justify-center"
                  : "pointer-events-none absolute left-2 right-2 flex items-center justify-center sm:left-4 sm:right-4"
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
              {/**
                * Print boundary: a single dashed outline with a translucent
                * checker behind the artwork — closely mirrors Printful's
                * "this is the printable area" affordance. Cyan corner dots
                * + center mid-handles render on top so the box reads as a
                * selectable object (matches Printful's selection state).
                */}
              <div
                className="relative max-h-full overflow-visible rounded-sm border border-dashed border-cyan-400/80 ring-1 ring-cyan-300/20"
                style={{
                  aspectRatio: `${Aw} / ${Ah}`,
                  width: `${layout.printMaxWidthPct}%`,
                }}
              >
                <div
                  className="absolute inset-0 overflow-hidden rounded-sm"
                  style={checkerStyle}
                >
                  {artworkInner}
                </div>

                {/** Four cyan corner handles + 4 mid-edge dots, Printful-style. */}
                {[
                  { className: "-top-1 -left-1" },
                  { className: "-top-1 -right-1" },
                  { className: "-bottom-1 -left-1" },
                  { className: "-bottom-1 -right-1" },
                ].map((p) => (
                  <span
                    key={p.className}
                    aria-hidden
                    className={`pointer-events-none absolute h-2 w-2 rounded-full bg-cyan-400 ring-1 ring-white ${p.className}`}
                  />
                ))}
                {[
                  { className: "left-1/2 -top-[3px] -translate-x-1/2" },
                  { className: "left-1/2 -bottom-[3px] -translate-x-1/2" },
                  { className: "top-1/2 -left-[3px] -translate-y-1/2" },
                  { className: "top-1/2 -right-[3px] -translate-y-1/2" },
                ].map((p) => (
                  <span
                    key={p.className}
                    aria-hidden
                    className={`pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-cyan-300/90 ${p.className}`}
                  />
                ))}
              </div>
            </div>

            <p className="pointer-events-none absolute bottom-2 left-0 right-0 px-2 text-center text-[10px] leading-snug text-muted-foreground/90">
              Drag or use arrow keys (Shift = bigger step) to move • Zoom out for whitespace, in to crop • Cyan frame = printable area
            </p>
          </div>
        )}

        {!hideBatchPlacementNote && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            This framing is the batch default for every merch type you publish next — you can fine-tune individual
            items on the product picker or later from your dashboard.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-card/80 p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Zoom</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{zoomPercent}%</span>
          </div>
          <Slider
            min={zoomMinPct}
            max={zoomMaxPct}
            step={5}
            value={[Math.min(zoomMaxPct, Math.max(zoomMinPct, zoomPercent))]}
            onValueChange={(vals) => {
              const z = Array.isArray(vals) ? vals[0] : vals;
              if (z === undefined || typeof z !== "number") return;
              onChange((prev) => ({
                ...prev,
                zoom: Math.min(PLACEMENT_ZOOM_MAX, Math.max(PLACEMENT_ZOOM_MIN, z / 100)),
              }));
            }}
            className="w-full"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange((prev) => ({
              ...prev,
              zoom: PLACEMENT_ZOOM_DEFAULT,
              panX: 0,
              panY: 0,
            }))
          }
        >
          Reset position & zoom
        </Button>
      </div>
    </div>
  );
}
