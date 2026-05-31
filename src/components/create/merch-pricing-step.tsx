"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  Info,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PRODUCT_TYPE_LABELS } from "@/components/storefront/product-card";
import { getDefaultProductCostBasis } from "@/lib/pricing/product-costs";
import {
  computeBaseCost,
  computeMarkupForPrice,
  computePriceForMarkup,
  computeTakeHome,
} from "@/lib/pricing/take-home";
import { formatUsd } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/lib/types";

const MARKUP_MIN = 0;
const MARKUP_MAX = 100;
/** Default markup applied to brand-new publishers (10% above base cost). */
export const DEFAULT_MARKUP_PERCENT = 10;
const RAZOR_THIN_PERCENT = 5;
const BOLD_PRICE_PERCENT = 50;

export interface MerchPricingRow {
  productType: ProductType;
  /** Whole percent (0–100). Storefront default if set, else 10. */
  markupPercent: number;
  /** Cents — what we'll send to the publish endpoint. */
  priceCents: number;
}

interface Props {
  productTypes: ProductType[];
  /**
   * Per–product-type markup percent + computed listing price. Mirrors what
   * `/create/page.tsx` will POST to `/api/designs/publish` so the wiring
   * is straightforward.
   */
  pricing: Record<string, MerchPricingRow>;
  onPricingChange: (next: Record<string, MerchPricingRow>) => void;
  /**
   * Whole-percent starting point. Pulled from the storefront's
   * `default_markup_percent` (migration 035) when set, else 10.
   */
  defaultMarkupPercent?: number;
}

/**
 * In-flow "Set your price" card. Lives above the listing-details card on
 * `/create` so creators see the price + take-home math BEFORE they get
 * distracted by description / tag inputs. Each product type in the batch
 * gets its own slider; we never auto-disable Publish from here — the
 * parent watches `markupPercent === 0` rows and gates the button itself.
 */
export function MerchPricingStep({
  productTypes,
  pricing,
  onPricingChange,
  defaultMarkupPercent = DEFAULT_MARKUP_PERCENT,
}: Props) {
  // Sync state when productTypes set changes: seed any new type with the
  // creator's default markup, drop entries for unchecked types so the
  // summary total reflects exactly what's in the publish batch.
  useEffect(() => {
    const seedPct = clampPercent(defaultMarkupPercent);
    let changed = false;
    const next: Record<string, MerchPricingRow> = {};
    for (const t of productTypes) {
      const existing = pricing[t];
      if (existing) {
        next[t] = existing;
      } else {
        const cost = getDefaultProductCostBasis(t);
        next[t] = {
          productType: t,
          markupPercent: seedPct,
          priceCents: computePriceForMarkup({
            itemWholesaleCents: cost.wholesaleCents,
            shippingCents: cost.shippingCents,
            markupRatio: seedPct / 100,
          }),
        };
        changed = true;
      }
    }
    if (Object.keys(pricing).length !== Object.keys(next).length) {
      changed = true;
    }
    if (changed) onPricingChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productTypes, defaultMarkupPercent]);

  const updateRow = useCallback(
    (type: ProductType, patch: Partial<MerchPricingRow>) => {
      const existing = pricing[type];
      if (!existing) return;
      onPricingChange({ ...pricing, [type]: { ...existing, ...patch } });
    },
    [pricing, onPricingChange],
  );

  const totalTakeHomeCents = useMemo(() => {
    let sum = 0;
    for (const t of productTypes) {
      const row = pricing[t];
      if (!row) continue;
      const cost = getDefaultProductCostBasis(t);
      const { takeHomeCents } = computeTakeHome({
        priceCents: row.priceCents,
        itemWholesaleCents: cost.wholesaleCents,
        shippingCents: cost.shippingCents,
      });
      sum += takeHomeCents;
    }
    return sum;
  }, [productTypes, pricing]);

  if (productTypes.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Card className="border-primary/30 bg-card p-6 text-left">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Sparkles className="h-4 w-4 text-primary" />
              Set your price
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              How much will you charge — and how much will you make?
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 self-start">
            <Link
              href="/faq#pricing-tips"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <Lightbulb className="h-3 w-3" />
              Help me price this!
            </Link>
            <Link
              href="/faq#fastest-money"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <Lightbulb className="h-3 w-3" />
              Fastest way to make money?
            </Link>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {productTypes.map((t) => {
            const row = pricing[t];
            if (!row) return null;
            return (
              <PricingRow
                key={t}
                productType={t}
                row={row}
                onChange={(patch) => updateRow(t, patch)}
              />
            );
          })}
        </div>

        {productTypes.length > 1 && (
          <div className="mt-5 rounded-lg border border-border/60 bg-background/60 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Estimated earnings</span>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  totalTakeHomeCents > 0
                    ? "text-emerald-500"
                    : "text-muted-foreground",
                )}
              >
                {formatUsd(totalTakeHomeCents)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              If a fan buys one of each of these {productTypes.length} items, you
              take home this much total. Sanity check — not a goal.
            </p>
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
}

function PricingRow({
  productType,
  row,
  onChange,
}: {
  productType: ProductType;
  row: MerchPricingRow;
  onChange: (patch: Partial<MerchPricingRow>) => void;
}) {
  const cost = useMemo(
    () => getDefaultProductCostBasis(productType),
    [productType],
  );
  const { baseCostCents } = useMemo(
    () =>
      computeBaseCost({
        itemWholesaleCents: cost.wholesaleCents,
        shippingCents: cost.shippingCents,
      }),
    [cost],
  );
  const takeHome = useMemo(
    () =>
      computeTakeHome({
        priceCents: row.priceCents,
        itemWholesaleCents: cost.wholesaleCents,
        shippingCents: cost.shippingCents,
      }),
    [row.priceCents, cost],
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  /**
   * `null` while the input doesn't have focus — we render straight from
   * `row.priceCents` instead. The "Advanced" input only enters its own
   * draft state on focus, which avoids the cascading-render lint while
   * still letting the user type a transient value (e.g. "12.").
   */
  const [draftDollars, setDraftDollars] = useState<string | null>(null);
  const displayDollars =
    draftDollars ?? (row.priceCents / 100).toFixed(2);

  const label = PRODUCT_TYPE_LABELS[productType] ?? productType;

  const handleSlider = (vals: number | readonly number[]) => {
    const v = Array.isArray(vals) ? vals[0] : (vals as number);
    const pct = clampPercent(Math.round(v));
    onChange({
      markupPercent: pct,
      priceCents: computePriceForMarkup({
        itemWholesaleCents: cost.wholesaleCents,
        shippingCents: cost.shippingCents,
        markupRatio: pct / 100,
      }),
    });
  };

  const commitTypedPrice = () => {
    const raw = draftDollars ?? "";
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const cents = Math.max(baseCostCents, Math.round(parsed * 100));
      const ratio = computeMarkupForPrice({
        priceCents: cents,
        itemWholesaleCents: cost.wholesaleCents,
        shippingCents: cost.shippingCents,
      });
      const pct = clampPercent(Math.round(ratio * 100));
      onChange({ markupPercent: pct, priceCents: cents });
    }
    setDraftDollars(null);
  };

  const isZero = row.markupPercent === 0;
  const isRazorThin = !isZero && row.markupPercent < RAZOR_THIN_PERCENT;
  const isBold = row.markupPercent > BOLD_PRICE_PERCENT;

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          Markup{" "}
          <strong className="font-semibold text-foreground">
            {row.markupPercent}%
          </strong>{" "}
          above base cost
        </span>
      </div>

      <div className="mt-3">
        <Slider
          min={MARKUP_MIN}
          max={MARKUP_MAX}
          step={1}
          value={[row.markupPercent]}
          onValueChange={handleSlider}
          aria-label={`${label} markup percent`}
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Listing price</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatUsd(row.priceCents)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            Base cost
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="What's base cost?"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </button>
                }
              />
              <TooltipContent>
                Item + shipping + 8% platform + 2.9% + $0.30 card fee. The rest
                is yours.{" "}
                <Link
                  href="/faq#pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Full breakdown
                </Link>
              </TooltipContent>
            </Tooltip>
            <span className="text-[10px]">
              (item + shipping + 8% platform + processing)
            </span>
          </span>
          <span className="tabular-nums">{formatUsd(baseCostCents)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-border/40 pt-2">
          <span className="text-sm font-medium">You take home</span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              isZero ? "text-destructive" : "text-emerald-500",
            )}
          >
            {formatUsd(takeHome.takeHomeCents)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              per sale
            </span>
          </span>
        </div>
      </div>

      {isZero && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            You&apos;d take home <strong>$0 per sale</strong>. Slide up to start
            earning before publishing.
          </span>
        </div>
      )}
      {isRazorThin && (
        <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 dark:text-amber-200">
          Razor-thin margin — most creators pick at least 10–20%.
        </p>
      )}
      {isBold && (
        <p className="mt-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Bold price! Make sure your design and quality justify it.{" "}
          <Link
            href="/faq#pricing-tips"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            Pricing tips →
          </Link>
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            showAdvanced && "rotate-180",
          )}
          aria-hidden
        />
        Advanced: type a price directly
      </button>
      {showAdvanced && (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1 max-w-[10rem]">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.50"
              min={(baseCostCents / 100).toFixed(2)}
              value={displayDollars}
              onFocus={() => setDraftDollars(displayDollars)}
              onChange={(e) => setDraftDollars(e.target.value)}
              onBlur={commitTypedPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTypedPrice();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              className="pl-7 h-8 text-sm"
              aria-label={`${label} listing price in USD`}
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            Slider updates to match.
          </span>
        </div>
      )}
    </div>
  );
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MARKUP_PERCENT;
  return Math.max(MARKUP_MIN, Math.min(MARKUP_MAX, Math.round(n)));
}
