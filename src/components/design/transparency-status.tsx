"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export function TransparencyStatus({
  hasTransparency,
  uploadedAsSvg = false,
  imageSource,
}: {
  hasTransparency: boolean | null | undefined;
  uploadedAsSvg?: boolean;
  imageSource: "ai" | "upload";
}) {
  if (hasTransparency === true) {
    return (
      <div
        className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
        data-transparency-state="transparent"
      >
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <strong className="font-semibold">Transparency detected.</strong> The checkerboard
            area is just preview context and will not print.
            {uploadedAsSvg
              ? " We still rasterize SVG before fulfillment, so tiny edge details can shift slightly."
              : ""}
          </p>
        </div>
      </div>
    );
  }

  if (hasTransparency === false) {
    return (
      <div
        className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
        data-transparency-state="opaque"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <strong className="font-semibold">No transparency detected.</strong> Any visible
            background in this file will print.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      data-transparency-state="pending"
    >
      <div className="flex items-start gap-2">
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
        <p>
          <strong className="font-semibold text-foreground">Transparency analysis pending.</strong>{" "}
          {imageSource === "upload"
            ? "We are still checking your upload."
            : "We are still checking this design."}
        </p>
      </div>
    </div>
  );
}
