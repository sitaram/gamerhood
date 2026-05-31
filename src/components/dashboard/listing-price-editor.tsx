"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Banknote, Info, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeBaseCost,
  computeMarkupForPrice,
  computePriceForMarkup,
  computeTakeHome,
} from "@/lib/pricing/take-home";
import { formatUsd } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";

export interface PriceListingRow {
  id: string;
  title: string;
  productType: string;
  priceCents: number;
  wholesaleCents: number;
  shippingCents: number;
  /** "default" → cost basis is a fallback, not the listing's own snapshot. */
  costBasisSource: "persisted" | "default";
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 p-5 sm:p-6",
        "border-emerald-400/50 bg-gradient-to-br from-emerald-500/25 via-emerald-400/15 to-lime-400/20",
        "shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-300/20",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-lime-400/15 blur-2xl"
      />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-emerald-950 dark:text-emerald-50">
              <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              Your earnings
            </h2>
            <p className="mt-1 max-w-md text-sm text-emerald-950/75 dark:text-emerald-50/80">
              Slide to set your price — watch your take-home grow. We save
              automatically when you stop.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800/80 dark:text-emerald-100/80">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : savedPulse ? (
              <span className="text-emerald-700 dark:text-emerald-200">Saved!</span>
            ) : dirty ? (
              <span className="text-emerald-800/60 dark:text-emerald-100/60">
                Updating…
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-400/40 bg-white/50 p-4 dark:bg-emerald-950/30 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">
            You take home per sale
          </p>
          <p
            className={cn(
              "mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl",
              isZero
                ? "text-destructive"
                : "text-emerald-600 dark:text-emerald-300",
            )}
          >
            {formatUsd(takeHome.takeHomeCents)}
          </p>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground/90">
            {row.title}
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-400/30 bg-white/40 p-4 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              Markup above costs
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              <strong className="text-lg font-bold text-emerald-600 dark:text-emerald-300">
                {markupPercent}%
              </strong>
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

          <div className="mt-4 space-y-1 border-t border-emerald-400/25 pt-3 text-sm">
            <BreakdownRow label="Fans pay" value={formatUsd(priceCents)} bold />
            <BreakdownRow
              label={
                <span className="inline-flex items-center gap-1.5">
                  Base cost
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
                    <TooltipContent>Why these fees? Read more</TooltipContent>
                  </Tooltip>
                </span>
              }
              value={formatUsd(baseCostCents)}
            />
          </div>
        </div>

        {row.costBasisSource === "default" && (
          <p className="mt-3 text-[11px] text-emerald-950/70 dark:text-emerald-100/70">
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
          <p className="mt-3 rounded-lg border border-emerald-400/30 bg-white/30 px-3 py-2 text-xs text-foreground/80 dark:bg-emerald-950/20">
            Bold price! Make sure your design justifies it.
          </p>
        )}
        {nearFloor && !isZero && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-200">
            You&apos;d take home {formatUsd(takeHome.takeHomeCents)} per sale.
            Most creators price higher to earn more.
          </p>
        )}

        <Link
          href="/faq#pricing-tips"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 transition-colors hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-emerald-50"
        >
          <Lightbulb className="h-3.5 w-3.5" aria-hidden />
          Not sure what to charge? Pricing tips →
        </Link>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  bold,
}: {
  label: React.ReactNode;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums text-foreground",
          bold && "text-sm font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  );
}
