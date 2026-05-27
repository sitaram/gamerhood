"use client";

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Compact badge that surfaces the alpha-channel check from
 * `detectDesignTransparency` (sharp). The values mirror the `has_transparency`
 * column on `public.designs`:
 *
 *   - `true`  → green check, "Transparent background"
 *   - `false` → amber warning, "Solid background"
 *   - `null`  → neutral "?", "Checking transparency…" (lazy backfill)
 *
 * The "what does this mean" tooltip is opt-in via `showInfoIcon` so the
 * surface that contains the explanation in surrounding copy (e.g. the
 * create-flow preview card) can keep the badge minimal. Use `size="md"` on
 * larger preview surfaces.
 */
export function TransparencyBadge({
  hasTransparency,
  size = "sm",
  showInfoIcon = true,
}: {
  hasTransparency: boolean | null | undefined;
  size?: "sm" | "md";
  showInfoIcon?: boolean;
}) {
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

  let variant: {
    label: string;
    Icon: typeof CheckCircle2;
    classes: string;
    tooltip: string;
  };

  if (hasTransparency === true) {
    variant = {
      label: "Transparent background",
      Icon: CheckCircle2,
      classes:
        "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      tooltip:
        "Your design has a true transparent (alpha) background — it'll print only the artwork, with the garment color showing through everywhere else.",
    };
  } else if (hasTransparency === false) {
    variant = {
      label: "Solid background",
      Icon: AlertTriangle,
      classes:
        "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      tooltip:
        "Your design has a solid background — it'll print as a colored rectangle on the shirt. If you wanted only the artwork to print, re-upload with a transparent background (PNG with alpha, or use the AI generator).",
    };
  } else {
    variant = {
      label: "Checking transparency…",
      Icon: HelpCircle,
      classes: "border-border/60 bg-muted/40 text-muted-foreground",
      tooltip:
        "We're inspecting your design's alpha channel — open the design page if this hasn't updated in a moment.",
    };
  }

  const { label, Icon, classes, tooltip } = variant;

  const transparencyAttr =
    hasTransparency === true ? "yes" : hasTransparency === false ? "no" : "unknown";

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizing.wrap} ${classes}`}
              data-transparency={transparencyAttr}
            >
              <Icon className={sizing.icon} aria-hidden />
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
          <p className="mt-1 text-[10px] opacity-80">
            We check the alpha channel — what Printful actually sees. The
            checkered preview some tools show is just a visual aid; it
            doesn&apos;t print.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
