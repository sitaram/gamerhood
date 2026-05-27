"use client";

import { Ruler } from "lucide-react";
import { formatInchesLabel } from "@/lib/print/overlay-geometry";

/**
 * Surfaces the design's physical print dimensions next to the placement
 * editor / listing edit panel / product detail page so creators (and
 * curious shoppers) can verify before publishing/buying. The values come
 * from `computeDesignOverlayBox().designInches` and Printful's print
 * area — so if the rendering is off, this indicator is off too, which is
 * exactly what we want creators to catch.
 */
export function DesignPrintSizeIndicator({
  designInches,
  printAreaInches,
  className,
  tone = "default",
}: {
  designInches: { width: number; height: number };
  printAreaInches: { width: number; height: number };
  className?: string;
  /**
   * `default` = card-style chip suitable inline next to the editor.
   * `compact` = single-line label suitable for the PDP details accordion.
   */
  tone?: "default" | "compact";
}) {
  const designW = formatInchesLabel(designInches.width);
  const designH = formatInchesLabel(designInches.height);
  const areaW = formatInchesLabel(printAreaInches.width);
  const areaH = formatInchesLabel(printAreaInches.height);

  if (tone === "compact") {
    return (
      <p className={`text-xs text-muted-foreground ${className ?? ""}`.trim()}>
        <Ruler className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
        Design prints at ~{designW}&nbsp;wide × {designH}&nbsp;tall (Printful&apos;s print area
        is {areaW} × {areaH}).
      </p>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground ${className ?? ""}`.trim()}
    >
      <Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/70" aria-hidden />
      <p className="leading-snug">
        Will print at approximately{" "}
        <span className="font-medium text-foreground">
          {designW} wide × {designH} tall
        </span>{" "}
        — Printful&apos;s print area is {areaW} × {areaH}.
      </p>
    </div>
  );
}
