"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import { Banknote, Info, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  hasRenderableListingMockup,
  PRODUCT_TYPE_LABELS,
} from "@/components/storefront/product-card-utils";
import {
  computeBaseCost,
  computeMarkupForPrice,
  computePriceForMarkup,
  computeTakeHome,
} from "@/lib/pricing/take-home";
import { formatUsd } from "@/lib/pricing/format";
import { DEFAULT_STORED, type StoredPrintPlacement } from "@/lib/print/placement";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/types";

export interface PriceListingRow {
  id: string;
  title: string;
  productType: string;
  priceCents: number;
  wholesaleCents: number;
  shippingCents: number;
  /** "default" → cost basis is a fallback, not the listing's own snapshot. */
  costBasisSource: "persisted" | "default";
  mockupUrl?: string | null;
  designImageUrl?: string | null;
  printPlacement?: StoredPrintPlacement | null;
}

const MARKUP_MIN = 0;
const MARKUP_MAX = 100;
const RAZOR_THIN_PERCENT = 5;
const BOLD_PRICE_PERCENT = 50;
const AMBER_THRESHOLD_CENTS = 100;
const AUTO_SAVE_MS = 700;

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.max(MARKUP_MIN, Math.min(MARKUP_MAX, Math.round(n)));
}

function initialMarkupPercent(row: PriceListingRow, baseCostCents: number): number {
  if (baseCostCents <= 0) return 10;
  const ratio = computeMarkupForPrice({
    priceCents: row.priceCents,
    itemWholesaleCents: row.wholesaleCents,
    shippingCents: row.shippingCents,
  });
  return clampPercent(Math.round(ratio * 100));
}

export function ListingPriceEditor({ listings }: { listings: PriceListingRow[] }) {
  const [rows, setRows] = useState(listings);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Publish at least one product from Create — then you can tune the price here.
      </p>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {rows.map((row, i) => (
          <ListingPriceCard key={row.id} row={row} rowIndex={i} setRows={setRows} />
        ))}
      </div>
    </TooltipProvider>
  );
}

function ListingPriceCard({
  row,
  rowIndex,
  setRows,
}: {
  row: PriceListingRow;
  rowIndex: number;
  setRows: Dispatch<SetStateAction<PriceListingRow[]>>;
}) {
  const { baseCostCents } = useMemo(
    () =>
      computeBaseCost({
        itemWholesaleCents: row.wholesaleCents,
        shippingCents: row.shippingCents,
      }),
    [row.wholesaleCents, row.shippingCents],
  );

  const [markupPercent, setMarkupPercent] = useState(() =>
    initialMarkupPercent(row, baseCostCents),
  );
  const [priceCents, setPriceCents] = useState(row.priceCents);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedPriceRef = useRef(row.priceCents);

  useEffect(() => {
    savedPriceRef.current = row.priceCents;
    setPriceCents(row.priceCents);
    setMarkupPercent(initialMarkupPercent(row, baseCostCents));
  }, [row.priceCents, row.wholesaleCents, row.shippingCents, baseCostCents]);

  const takeHome = useMemo(
    () =>
      computeTakeHome({
        priceCents,
        itemWholesaleCents: row.wholesaleCents,
        shippingCents: row.shippingCents,
      }),
    [priceCents, row.wholesaleCents, row.shippingCents],
  );

  const isZero = markupPercent === 0;
  const isRazorThin = !isZero && markupPercent < RAZOR_THIN_PERCENT;
  const isBold = markupPercent > BOLD_PRICE_PERCENT;
  const nearFloor =
    !isZero &&
    takeHome.takeHomeCents >= 0 &&
    takeHome.takeHomeCents <= AMBER_THRESHOLD_CENTS;
  const dirty = priceCents !== savedPriceRef.current;

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function persist(nextPriceCents: number) {
    if (nextPriceCents < baseCostCents) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: nextPriceCents }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        product?: { base_price_cents?: number; markup_cents?: number };
      };
      if (!res.ok) {
        throw new Error(j.error || "Could not update price");
      }
      const persisted =
        (j.product?.base_price_cents ?? 0) + (j.product?.markup_cents ?? 0);
      savedPriceRef.current = persisted;
      setRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], priceCents: persisted };
        return next;
      });
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 1800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update price");
    } finally {
      setSaving(false);
    }
  }

  function scheduleSave(nextPriceCents: number) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (nextPriceCents !== savedPriceRef.current) {
        void persist(nextPriceCents);
      }
    }, AUTO_SAVE_MS);
  }

  function handleSlider(vals: number | readonly number[]) {
    const v = Array.isArray(vals) ? vals[0] : (vals as number);
    const pct = clampPercent(Math.round(v));
    const nextPrice = computePriceForMarkup({
      itemWholesaleCents: row.wholesaleCents,
      shippingCents: row.shippingCents,
      markupRatio: pct / 100,
    });
    setMarkupPercent(pct);
    setPriceCents(nextPrice);
    scheduleSave(nextPrice);
  }

  const productLabel =
    PRODUCT_TYPE_LABELS[row.productType] ?? row.productType.replace(/-/g, " ");
  const showRealMockup = hasRenderableListingMockup(
    row.mockupUrl,
    row.designImageUrl,
  );
  const placement = row.printPlacement ?? DEFAULT_STORED;

  const costsAndFeesCents = Math.max(0, priceCents - takeHome.takeHomeCents);
  const earningsSharePct =
    priceCents > 0
      ? Math.max(0, Math.min(100, (takeHome.takeHomeCents / priceCents) * 100))
      : 0;
  const costsSharePct = 100 - earningsSharePct;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 p-1.5 sm:p-2",
        "border-emerald-500/70 bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900",
        "shadow-lg shadow-emerald-950/30",
      )}
    >
      <div className="rounded-xl bg-card p-5 text-card-foreground sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
              <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Your earnings
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Slide to set your price — watch your take-home grow. We&apos;ll
              list the price where you leave the slider.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : savedPulse ? (
              <span className="text-emerald-600 dark:text-emerald-400">Saved!</span>
            ) : dirty ? (
              <span>Updating…</span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
          <div className="flex gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-background sm:h-24 sm:w-24">
              {showRealMockup && row.mockupUrl ? (
                <Image
                  src={row.mockupUrl}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
              ) : row.designImageUrl ? (
                <MerchPlacementPreview
                  imageUrl={row.designImageUrl}
                  productType={row.productType as ProductType}
                  placement={placement}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                  No preview
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {productLabel}
              </Badge>
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                {row.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pricing for this listing
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                You take home per sale
              </p>
              <p
                className={cn(
                  "text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl",
                  isZero
                    ? "text-destructive"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {formatUsd(takeHome.takeHomeCents)}
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">How fan price breaks down</span>
                <span className="font-semibold tabular-nums text-foreground">
                  Fans pay {formatUsd(priceCents)}
                </span>
              </div>

              <div
                className="flex h-3 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${formatUsd(costsAndFeesCents)} costs and fees, ${formatUsd(takeHome.takeHomeCents)} you keep`}
              >
                <div
                  className="h-full bg-zinc-400 transition-[width] duration-200 dark:bg-zinc-600"
                  style={{ width: `${costsSharePct}%` }}
                />
                <div
                  className={cn(
                    "h-full transition-[width] duration-200",
                    isZero ? "bg-destructive/60" : "bg-emerald-500",
                  )}
                  style={{ width: `${earningsSharePct}%` }}
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Costs & fees
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 font-semibold tabular-nums text-foreground">
                    {formatUsd(costsAndFeesCents)}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Link
                            href="/faq#pricing"
                            aria-label="Why these fees? Read more"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Info className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        }
                      />
                      <TooltipContent>
                        Item, shipping, platform, and card fees. Break-even
                        floor is {formatUsd(baseCostCents)}.
                      </TooltipContent>
                    </Tooltip>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    From {formatUsd(baseCostCents)} break-even
                  </p>
                </div>

                <span
                  aria-hidden
                  className="flex items-center justify-center text-lg font-bold text-muted-foreground sm:px-1"
                >
                  +
                </span>

                <div className="flex-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                    You keep
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-lg font-bold tabular-nums",
                      isZero
                        ? "text-destructive"
                        : "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    +{formatUsd(takeHome.takeHomeCents)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Grows as you slide right
                  </p>
                </div>

                <span
                  aria-hidden
                  className="flex items-center justify-center text-lg font-bold text-muted-foreground sm:px-1"
                >
                  =
                </span>

                <div className="flex-1 rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Fans pay
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                    {formatUsd(priceCents)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    What buyers see
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                Markup above costs
              </span>
              <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {markupPercent}%
              </span>
            </div>

            <div className="mt-4">
              <Slider
                min={MARKUP_MIN}
                max={MARKUP_MAX}
                step={1}
                value={[markupPercent]}
                onValueChange={handleSlider}
                aria-label="Listing markup percent"
                className="[&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500 [&_[data-slot=slider-thumb]]:ring-emerald-500/40"
              />
              <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {row.costBasisSource === "default" && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            We&apos;re using our standard cost estimate for this product type
            because this listing doesn&apos;t have a per-variant cost on file yet.
          </p>
        )}

        {isZero && (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            Slide up — at 0% you&apos;d take home $0 per sale.
          </p>
        )}
        {isRazorThin && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
            Razor-thin margin — most creators pick at least 10–20%.
          </p>
        )}
        {isBold && (
          <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Bold price! Make sure your design justifies it.
          </p>
        )}
        {nearFloor && !isZero && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-200">
            You&apos;d take home {formatUsd(takeHome.takeHomeCents)} per sale.
            Most creators price higher to earn more.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/faq#pricing-tips"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
          >
            <Lightbulb className="h-3.5 w-3.5" aria-hidden />
            Not sure what to charge? Pricing tips →
          </Link>
          <Link
            href="/faq#fastest-money"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 transition-colors hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
          >
            <Lightbulb className="h-3.5 w-3.5" aria-hidden />
            Fastest way to make money? →
          </Link>
        </div>
      </div>
    </div>
  );
}
