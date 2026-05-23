"use client";

import type { PrintfulCatalogMeta } from "@/lib/types";

export function PrintfulCatalogDetails({ meta }: { meta: PrintfulCatalogMeta }) {
  const subtitle = [meta.brand, meta.model].filter(Boolean).join(" · ") || meta.productName;

  return (
    <div className="mt-12 space-y-8 border-t border-border/50 pt-10">
      <div>
        <h2 className="text-xl font-bold tracking-tight">About this blank</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {meta.printfulType && (
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{meta.printfulType}</p>
        )}
      </div>

      {meta.blankDescription.trim().length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/40 p-5">
          <h3 className="text-sm font-semibold text-foreground">Printful product details</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {meta.blankDescription}
          </p>
        </div>
      )}

      {meta.sizeGuides.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Size guide</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Measurements come from Printful&apos;s supplier data. Values may vary slightly by batch.
          </p>

          {meta.sizeGuides.map((guide, gi) => {
            const sizeCols =
              meta.availableSizes.length > 0
                ? meta.availableSizes
                : Array.from(
                    new Set(
                      guide.rows.flatMap((r) => Object.keys(r.valuesBySize)),
                    ),
                  ).sort();

            return (
              <details
                key={`${guide.guideType}-${guide.unit}-${gi}`}
                className="group rounded-xl border border-border/50 bg-card/30 open:bg-card/50"
                open={gi === 0}
              >
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    <span className="capitalize">{guide.guideType.replace(/_/g, " ")}</span>
                    {guide.unit && guide.unit !== "none" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {guide.unit}
                      </span>
                    )}
                  </span>
                </summary>
                <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-4">
                  {guide.introPlain.length > 0 && (
                    <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {guide.introPlain}
                    </p>
                  )}
                  {guide.imageUrl && (
                    <div className="relative mx-auto max-w-md overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Printful CDN host varies */}
                      <img
                        src={guide.imageUrl}
                        alt="How to measure"
                        className="h-auto w-full object-contain"
                      />
                    </div>
                  )}
                  {guide.measurementHelpPlain.length > 0 && (
                    <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {guide.measurementHelpPlain}
                    </p>
                  )}
                  {guide.rows.length > 0 && sizeCols.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-border/40">
                      <table className="w-full min-w-[280px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border/50 bg-muted/40">
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Measurement
                            </th>
                            {sizeCols.map((sz) => (
                              <th
                                key={sz}
                                className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground"
                              >
                                {sz}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {guide.rows.map((row) => (
                            <tr key={row.dimension} className="border-b border-border/30 last:border-0">
                              <td className="px-3 py-2 font-medium text-foreground">{row.dimension}</td>
                              {sizeCols.map((sz) => (
                                <td key={sz} className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                                  {row.valuesBySize[sz] ?? "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
