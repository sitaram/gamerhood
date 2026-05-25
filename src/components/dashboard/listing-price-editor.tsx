"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Info, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeBaseCost, computeTakeHome } from "@/lib/pricing/take-home";
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

const AMBER_THRESHOLD_CENTS = 100;

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
  const [draftDollars, setDraftDollars] = useState(() =>
    (row.priceCents / 100).toFixed(2),
  );
  const [saving, setSaving] = useState(false);

  const { baseCostCents } = useMemo(
    () =>
      computeBaseCost({
        itemWholesaleCents: row.wholesaleCents,
        shippingCents: row.shippingCents,
      }),
    [row.wholesaleCents, row.shippingCents],
  );

  const minDollars = useMemo(() => (baseCostCents / 100).toFixed(2), [baseCostCents]);

  const draftCents = useMemo(() => {
    const parsed = Number.parseFloat(draftDollars);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [draftDollars]);

  const inputInvalid = draftCents === null;
  const belowFloor = draftCents !== null && draftCents < baseCostCents;
  const takeHome = useMemo(() => {
    if (draftCents === null) return null;
    return computeTakeHome({
      priceCents: draftCents,
      itemWholesaleCents: row.wholesaleCents,
      shippingCents: row.shippingCents,
    });
  }, [draftCents, row.wholesaleCents, row.shippingCents]);

  const nearFloor =
    takeHome !== null &&
    !belowFloor &&
    takeHome.takeHomeCents >= 0 &&
    takeHome.takeHomeCents <= AMBER_THRESHOLD_CENTS;

  const unchanged = draftCents === row.priceCents;
  const saveDisabled = saving || inputInvalid || belowFloor || unchanged;

  async function save() {
    if (draftCents === null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: draftCents }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        product?: { base_price_cents?: number; markup_cents?: number };
      };
      if (!res.ok) {
        throw new Error(j.error || "Could not update price");
      }
      const nextPriceCents =
        (j.product?.base_price_cents ?? 0) + (j.product?.markup_cents ?? 0);
      setRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], priceCents: nextPriceCents };
        return next;
      });
      setDraftDollars((nextPriceCents / 100).toFixed(2));
      toast.success("Price updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update price");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/50 bg-card/50 p-4">
      <p className="text-sm font-medium line-clamp-2">{row.title}</p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor={`price-${row.id}`}
            className="text-xs text-muted-foreground"
          >
            Listing price (USD)
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`price-${row.id}`}
              type="number"
              inputMode="decimal"
              step="0.50"
              min={minDollars}
              value={draftDollars}
              onChange={(e) => setDraftDollars(e.target.value)}
              className="pl-7"
              aria-invalid={belowFloor || inputInvalid}
            />
          </div>
          <Link
            href="/faq#pricing-tips"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lightbulb className="h-3 w-3" aria-hidden />
            Not sure what to charge? Pricing tips →
          </Link>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={saveDisabled}
          className="bg-primary hover:bg-primary/90 sm:self-end"
        >
          {saving ? "Saving…" : "Save price"}
        </Button>
      </div>

      {row.costBasisSource === "default" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          We&apos;re using our standard cost estimate for this product type because this
          listing doesn&apos;t have a per-variant cost on file yet.
        </p>
      )}

      {inputInvalid ? (
        <p className="mt-3 text-xs text-destructive">
          Enter a valid price in dollars (e.g. 24.99).
        </p>
      ) : belowFloor ? (
        <p className="mt-3 text-xs font-medium text-destructive">
          Price must be at least {formatUsd(baseCostCents)} to cover costs.
        </p>
      ) : null}

      {takeHome && !belowFloor && !inputInvalid && (
        <PriceBreakdownCard
          priceCents={draftCents!}
          baseCostCents={baseCostCents}
          takeHomeCents={takeHome.takeHomeCents}
          near={nearFloor}
        />
      )}
    </Card>
  );
}

function PriceBreakdownCard({
  priceCents,
  baseCostCents,
  takeHomeCents,
  near,
}: {
  priceCents: number;
  baseCostCents: number;
  takeHomeCents: number;
  near: boolean;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/60 p-3 text-sm">
      <BreakdownRow label="Listing price" value={formatUsd(priceCents)} />
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
      <div className="mt-2 flex items-baseline justify-between border-t border-border/40 pt-2">
        <span className="text-sm font-medium">You take home</span>
        <span
          className={cn(
            "text-lg font-bold",
            takeHomeCents > 0 ? "text-emerald-500" : "text-muted-foreground",
          )}
        >
          {formatUsd(takeHomeCents)}
        </span>
      </div>
      {near && (
        <p className="mt-2 text-xs text-amber-500">
          You&apos;d take home {formatUsd(takeHomeCents)} per sale. Most creators
          price higher to earn more.
        </p>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
