"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Warn for SVG uploads because the pipeline rasterizes SVG before print.
 * We show it immediately on upload (before transparency analysis finishes),
 * then keep the stronger "Transparent SVG" wording when alpha is confirmed.
 */
export function TransparencyBadge({
  hasTransparency,
  uploadedAsSvg = false,
  size = "sm",
  showInfoIcon = true,
}: {
  hasTransparency: boolean | null | undefined;
  /** True when the design was originally uploaded as SVG (not AI/raster). */
  uploadedAsSvg?: boolean;
  size?: "sm" | "md";
  showInfoIcon?: boolean;
}) {
  if (!uploadedAsSvg) {
    return null;
  }

  const sizing =
    size === "md"
      ? {
          wrap: "px-2.5 py-1 text-xs",
          icon: "h-3.5 w-3.5",
        }
      : {
          wrap: "px-2 py-0.5 text-[11px]",
          icon: "h-3 w-3",
        };

  const transparencyKnown = typeof hasTransparency === "boolean";
  const isTransparentSvg = hasTransparency === true;
  const label = isTransparentSvg ? "Transparent SVG" : "SVG upload";
  const tooltip = isTransparentSvg
    ? "This design was uploaded as a transparent SVG. What you see on screen may look a bit different from the final print — we convert SVG to a print file before it goes to the manufacturer, and fine edges or transparency can shift slightly."
    : transparencyKnown
      ? "This design was uploaded as an SVG. We convert SVG to a print file before it goes to the manufacturer, so fine edges can render a little differently than the live preview."
      : "This design was uploaded as an SVG. We convert SVG to a print file before it goes to the manufacturer, so fine edges can render a little differently than the live preview. Transparency analysis is still in progress.";

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 font-medium text-amber-700 dark:text-amber-300 ${sizing.wrap}`}
              data-transparency="svg-transparent"
            >
              <AlertTriangle className={sizing.icon} aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
              {showInfoIcon && (
                <HelpCircle
                  className={`${sizing.icon} opacity-60`}
                  aria-label="More info"
                />
              )}
            </span>
          }
        />
        <TooltipContent className="max-w-xs leading-snug">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
