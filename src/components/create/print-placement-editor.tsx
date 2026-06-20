"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MerchGarmentSilhouette } from "@/components/create/merch-garment-silhouette";
import { getMerchPreviewLayout } from "@/lib/create/merch-preview-layout";
import { usePrintfulBlankPhoto } from "@/lib/printful/use-blank-photo";
import {
  PLACEMENT_ZOOM_MIN,
  PLACEMENT_ZOOM_DEFAULT,
} from "@/lib/print/placement";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import {
  computeDesignOverlayBox,
  getDefaultPrintAreaInches,
} from "@/lib/print/overlay-geometry";
import { DesignPrintSizeIndicator } from "@/components/create/design-print-size-indicator";
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

/**
 * Pan is allowed to range past ±1 so creators can intentionally crop the
 * design off the printable area (Printful clips the overhang on render).
 * The hard limit (`PLACEMENT_PAN_MAX`) is sized so at least half of the
 * smaller of `box` / `design` always overlaps with the print box, i.e.
 * the design can never be dragged entirely off-frame.
 */
/**
 * Keep the whole artwork inside the printable area. At |pan| = 1 an artwork
 * edge sits exactly on the box edge; beyond that it would overhang, so we
 * clamp to ±1 (combined with the zoom ≤ 1 "contain" cap, the full design is
 * always inside the frame).
 */
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
  /** Fired when the artwork image fails to load (e.g. deleted library design). */
  onArtworkError?: () => void;
}

export function PrintPlacementEditor({
  imageUrl,
  selectedProductTypes,
  value,
  onChange,
  onAspectDetected,
  hideBatchPlacementNote = false,
  onArtworkError,
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
  const {
    url: blankPhotoUrl,
    loading: blankPhotoLoading,
    area: liveArea,
    pixelRect: blankPixelRect,
    backdropColor: blankBackdropColor,
  } = usePrintfulBlankPhoto(previewType);

  useEffect(() => {
    if (blankPhotoUrl) {
      console.log("[placement-editor] rendering Printful backdrop", {
        productType: previewType,
        url: blankPhotoUrl,
      });
    } else {
      console.warn("[placement-editor] rendering SVG silhouette fallback", {
        productType: previewType,
        loading: blankPhotoLoading,
        reason: blankPhotoLoading ? "still_loading" : "unavailable_or_no_url",
      });
    }
  }, [previewType, blankPhotoUrl, blankPhotoLoading]);

  /**
   * Match the preview frame to the mockup-templates coordinate space when
   * Printful gave us pixel coords; otherwise fall back to photoBand tuning
   * for legacy flat mockups without a template rect.
   */
  const layout = blankPixelRect
    ? {
        ...baseLayout,
        garmentAspect: blankPixelRect.mockupWidthPx / blankPixelRect.mockupHeightPx,
      }
    : blankPhotoUrl && baseLayout.photoBand
      ? { ...baseLayout, ...baseLayout.photoBand }
      : baseLayout;

  /**
   * Unified overlay geometry: same helper drives every preview surface so
   * `Aw`/`Ah` (used for the cyan frame's aspect ratio + the indicator
   * caption) always match what Printful will print.
   *
   * When Printful has provided pixel-space coordinates for this variant's
   * Ghost mockup (`blankPixelRect`), we forward them — `computeDesignOverlayBox`
   * pins the cyan frame to Printful's `/mockup-templates` print area, the
   * same coordinate frame `layer.position` uses at fulfillment. The backdrop
   * must be a Ghost mockup style (not Flat 2) or the overlay will drift.
   */
  const overlay = computeDesignOverlayBox({
    productType: previewType,
    layout,
    printAreaInches: liveArea,
    defaultPrintAreaInches: getDefaultPrintAreaInches(previewType),
    normalizedPlacement: value,
    printAreaPixelRect: blankPhotoUrl ? blankPixelRect : null,
  });
  const Aw = overlay.printAreaInches.width;
  const Ah = overlay.printAreaInches.height;

  const frameRef = useRef<HTMLDivElement | null>(null);
  const printRectRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startZoom: number;
    bandW: number;
    bandH: number;
    centerX: number;
    centerY: number;
    startDist: number;
  } | null>(null);

  useEffect(() => {
    if (!imageUrl || !onAspectDetected) return;
    let cancelled = false;
    import("@/lib/print/image-content-bounds")
      .then(({ detectContentAspect }) => detectContentAspect(imageUrl))
      .then((aspect) => {
        if (!cancelled) onAspectDetected(aspect);
      })
      .catch(() => {
        if (!cancelled) onAspectDetected(1);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, onAspectDetected]);

  /** Cap at 1.0 = "contain" so the art can scale down to the minimum but
   *  never grow past the printable area (no overhang / crop). */
  const clampZoom = (z: number) => Math.min(1, Math.max(PLACEMENT_ZOOM_MIN, z));

  const captureToFrame = (e: React.PointerEvent) => {
    try {
      frameRef.current?.setPointerCapture(e.pointerId);
    } catch {
      //
    }
  };

  const beginMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = printRectRef.current?.getBoundingClientRect();
    drag.current = {
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      startPanX: value.panX,
      startPanY: value.panY,
      startZoom: value.zoom,
      bandW: rect?.width ?? 1,
      bandH: rect?.height ?? 1,
      centerX: 0,
      centerY: 0,
      startDist: 1,
    };
    captureToFrame(e);
  };

  /** Corner-handle resize: proportional (uniform) scale about the art's
   *  centre, so the artwork is never distorted — what you see is what prints. */
  const beginResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = printRectRef.current?.getBoundingClientRect();
    let centerX = e.clientX;
    let centerY = e.clientY;
    if (rect) {
      centerX =
        rect.left + ((overlay.design.leftPct + overlay.design.widthPct / 2) / 100) * rect.width;
      centerY =
        rect.top + ((overlay.design.topPct + overlay.design.heightPct / 2) / 100) * rect.height;
    }
    drag.current = {
      mode: "resize",
      startX: e.clientX,
      startY: e.clientY,
      startPanX: value.panX,
      startPanY: value.panY,
      startZoom: value.zoom,
      bandW: rect?.width ?? 1,
      bandH: rect?.height ?? 1,
      centerX,
      centerY,
      startDist: Math.max(8, Math.hypot(e.clientX - centerX, e.clientY - centerY)),
    };
    captureToFrame(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      // Pixels the art travels per 1.0 of pan: in the normal range
      // `left = slack/2 + pan·slack/2`, so it moves ((1−designFrac)/2)·bandPx
      // per unit. Using that divisor makes the drag track the pointer 1:1
      // (vs. the old ÷180 crawl). Band size cached at gesture start.
      const sensX = Math.max(1, ((1 - overlay.design.widthPct / 100) / 2) * d.bandW);
      const sensY = Math.max(1, ((1 - overlay.design.heightPct / 100) / 2) * d.bandH);
      onChange((prev) => ({
        ...prev,
        panX: clampPan(d.startPanX + (e.clientX - d.startX) / sensX),
        panY: clampPan(d.startPanY + (e.clientY - d.startY) / sensY),
      }));
    } else {
      const dist = Math.hypot(e.clientX - d.centerX, e.clientY - d.centerY);
      onChange((prev) => ({ ...prev, zoom: clampZoom(d.startZoom * (dist / d.startDist)) }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      frameRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      //
    }
    drag.current = null;
  };

  /**
   * Keyboard nudge: arrow keys move panX/panY across the full overhang range
   * (±PLACEMENT_PAN_MAX). Shift = ~4× larger step (coarse positioning).
   * preventDefault so the page doesn't scroll while the editor has focus.
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

  /**
   * Artwork box — positioned in the cyan-frame's coord system (left/top/
   * width/height are pct of the print-area inches, so the design's bounding
   * box always matches the printed result). The wrapper itself has no
   * background, so the design's transparent pixels reveal whatever sits
   * beneath: inside the cyan frame that's the Printful flat-mockup garment
   * (true printed appearance); outside the frame it's the surrounding
   * preview, dimmed to 30 % so creators can see what gets clipped off.
   */
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
        src={imageUrl!}
        alt="Your artwork placement preview"
        fill
        sizes="480px"
        className="object-contain object-center"
        unoptimized
        draggable={false}
        onError={() => onArtworkError?.()}
      />
    </div>
  );

  if (!imageUrl) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4 text-left">
      <div>
        <h3 className="text-lg font-semibold">Line up your art on the merch</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Drag the art to move it, drag a corner to resize. The solid frame is Printful&apos;s printable box (
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
              ? blankPixelRect
                ? " · Printful print template"
                : " · Printful mockup"
              : layout.showGarment
                ? " · placement sketch (template loading…)"
                : null}
          </span>
        </div>

        {!layout.showGarment ? (
          <div
            ref={(el) => {
              frameRef.current = el;
              printRectRef.current = el;
            }}
            className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-xl border-2 border-dashed border-primary/60 bg-muted/70 shadow-inner outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
            style={{ aspectRatio: `${Aw} / ${Ah}` }}
            tabIndex={0}
            onPointerDown={beginMove}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            role="application"
            aria-label="Adjust design position on printable area — drag, or focus and use arrow keys (hold Shift for bigger steps)"
          >
            <div className="relative h-full w-full">{renderArtwork(1)}</div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-secondary/80 via-muted/90 to-muted shadow-inner">
            <div
              ref={frameRef}
              className="relative w-full touch-none select-none outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
              style={{ aspectRatio: `${layout.garmentAspect}` }}
              tabIndex={0}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              role="application"
              aria-label="Adjust design position — drag the art to move, drag a corner to resize, or use arrow keys (hold Shift for bigger steps)"
            >
              <div className="pointer-events-none absolute inset-0">
                {blankPhotoUrl ? (
                  /** Printful mockup-templates backdrop — image + print_area share one coordinate frame. */
                  <div
                    className="relative h-full w-full overflow-hidden"
                    style={{ backgroundColor: blankBackdropColor ?? "#ffffff" }}
                  >
                    <Image
                      src={blankPhotoUrl}
                      alt=""
                      fill
                      sizes="512px"
                      className="object-contain"
                      unoptimized
                      draggable={false}
                      onLoad={() =>
                        console.log("[placement-editor] mockup img loaded", {
                          productType: previewType,
                          url: blankPhotoUrl,
                        })
                      }
                      onError={(e) =>
                        console.error("[placement-editor] mockup img FAILED to load", {
                          productType: previewType,
                          url: blankPhotoUrl,
                          type: e.type,
                        })
                      }
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-2 sm:p-4">
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
                  </div>
                )}

                <div
                  className={
                    overlay.band.leftPct != null
                      ? "pointer-events-none absolute flex items-center justify-center"
                      : "pointer-events-none absolute left-2 right-2 flex items-center justify-center sm:left-4 sm:right-4"
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
                  {/**
                    * The faint dashed rect marks Printful's printable area (a
                    * static guide). The artwork is rendered twice in the same
                    * position relative to it — once dimmed (30 %) unclipped so
                    * overhang reads as "will be cropped", and again clipped at
                    * full opacity showing exactly what prints. Dragging anywhere
                    * here moves the art (pan); the bright selection box below
                    * tracks the art and its corners scale it proportionally.
                    */}
                  <div
                    ref={printRectRef}
                    onPointerDown={beginMove}
                    className="pointer-events-auto relative max-h-full cursor-grab touch-none select-none overflow-visible rounded-sm border-2 border-dashed border-cyan-400/70 active:cursor-grabbing"
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

                    {/* Solid frame above = printable area; this dashed box
                        tracks the artwork. Corner handles scale it
                        proportionally (uniform — never distorts). */}
                    <div
                      className="pointer-events-none absolute rounded-sm border border-dashed border-white/90"
                      style={{
                        left: `${overlay.design.leftPct}%`,
                        top: `${overlay.design.topPct}%`,
                        width: `${overlay.design.widthPct}%`,
                        height: `${overlay.design.heightPct}%`,
                      }}
                    >
                      {[
                        { className: "-top-1 -left-1 cursor-nwse-resize" },
                        { className: "-top-1 -right-1 cursor-nesw-resize" },
                        { className: "-bottom-1 -left-1 cursor-nesw-resize" },
                        { className: "-bottom-1 -right-1 cursor-nwse-resize" },
                      ].map((p) => (
                        <span
                          key={p.className}
                          onPointerDown={beginResize}
                          aria-label="Resize artwork"
                          className={`pointer-events-auto absolute h-2 w-2 touch-none rounded-full bg-cyan-400 ring-1 ring-white ${p.className}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="px-2 py-2 text-center text-[10px] leading-snug text-muted-foreground/90">
              Drag the art to move it • Drag a corner dot to resize • Arrow keys nudge (Shift = bigger) • Solid frame = printable area; the dashed box is your art
            </p>
          </div>
        )}

        <DesignPrintSizeIndicator
          designInches={overlay.designInches}
          printAreaInches={overlay.printAreaInches}
        />

        {!hideBatchPlacementNote && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            This framing is the batch default for every merch type you publish next — you can fine-tune individual
            items on the product picker or later from your dashboard.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/80 p-4">
        <p className="text-xs text-muted-foreground">
          Drag the art to move • drag a corner to resize
        </p>
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
          Reset position & size
        </Button>
      </div>
    </div>
  );
}
