"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Pencil, ExternalLink, Sparkles, Wand2, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import {
  hasRenderableListingMockup,
  PRODUCT_TYPE_LABELS,
} from "@/components/storefront/product-card";
import { DEFAULT_STORED, type StoredPrintPlacement } from "@/lib/print/placement";
import { formatUsd } from "@/lib/pricing/format";
import type { ProductType } from "@/lib/types";

export interface ManagedStorefrontOption {
  id: string;
  slug: string;
  displayName: string;
  isDefault: boolean;
}

export interface ManagedListingRow {
  id: string;
  title: string;
  productType: ProductType;
  mockupUrl: string | null;
  designImageUrl: string | null;
  priceCents: number;
  isPublished: boolean;
  salesCount: number;
  createdAt: string;
  storefrontId: string | null;
  storefrontSlug: string | null;
  storefrontDisplayName: string | null;
  printPlacement: StoredPrintPlacement | null;
}

type StatusFilter = "all" | "live" | "hidden";
type SortKey = "newest" | "oldest" | "price-asc" | "price-desc" | "title-asc";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "price-asc": "Price ↑",
  "price-desc": "Price ↓",
  "title-asc": "Title A–Z",
};

export function ListingsManager({
  listings,
  storefronts,
}: {
  listings: ManagedListingRow[];
  storefronts: ManagedStorefrontOption[];
}) {
  const hasMultipleStorefronts = storefronts.length > 1;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [storefrontFilter, setStorefrontFilter] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let next = listings.filter((row) => {
      if (statusFilter === "live" && !row.isPublished) return false;
      if (statusFilter === "hidden" && row.isPublished) return false;
      if (storefrontFilter.size > 0) {
        const key = row.storefrontId ?? "__none__";
        if (!storefrontFilter.has(key)) return false;
      }
      if (needle && !row.title.toLowerCase().includes(needle)) return false;
      return true;
    });

    switch (sort) {
      case "oldest":
        next = [...next].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "price-asc":
        next = [...next].sort((a, b) => a.priceCents - b.priceCents);
        break;
      case "price-desc":
        next = [...next].sort((a, b) => b.priceCents - a.priceCents);
        break;
      case "title-asc":
        next = [...next].sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
        );
        break;
      case "newest":
      default:
        next = [...next].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
    }
    return next;
  }, [listings, search, statusFilter, storefrontFilter, sort]);

  if (listings.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasMultipleStorefronts && (
            <StorefrontFilterDropdown
              storefronts={storefronts}
              selected={storefrontFilter}
              onChange={setStorefrontFilter}
            />
          )}

          <Select
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="h-9 min-w-[8.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="live">Live only</SelectItem>
              <SelectItem value="hidden">Hidden only</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(v) => v && setSort(v as SortKey)}
          >
            <SelectTrigger className="h-9 min-w-[8.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {listings.length} listing
        {listings.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-border/50 bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No listings match those filters. Try clearing the search or storefront
          picker.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <ListingCard
              key={row.id}
              row={row}
              showStorefrontBadge={hasMultipleStorefronts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StorefrontFilterDropdown({
  storefronts,
  selected,
  onChange,
}: {
  storefronts: ManagedStorefrontOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const label =
    selected.size === 0
      ? "All storefronts"
      : selected.size === 1
        ? (storefronts.find((s) => selected.has(s.id))?.displayName ??
          "1 storefront")
        : `${selected.size} storefronts`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            {label}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-[16rem]">
        <DropdownMenuLabel>Filter by storefront</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {storefronts.map((s) => (
          <DropdownMenuCheckboxItem
            key={s.id}
            checked={selected.has(s.id)}
            onCheckedChange={() => toggle(s.id)}
          >
            <span className="truncate">{s.displayName}</span>
            {s.isDefault && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                Default
              </span>
            )}
          </DropdownMenuCheckboxItem>
        ))}
        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              Clear filter
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListingCard({
  row,
  showStorefrontBadge,
}: {
  row: ManagedListingRow;
  showStorefrontBadge: boolean;
}) {
  const showRealMockup = hasRenderableListingMockup(
    row.mockupUrl,
    row.designImageUrl,
  );
  const productLabel =
    PRODUCT_TYPE_LABELS[row.productType] || row.productType;

  return (
    <Card className="flex flex-col overflow-hidden border-border/50 bg-card transition-colors hover:border-primary/30">
      <div className="relative aspect-square bg-secondary">
        {showRealMockup ? (
          <Image
            src={row.mockupUrl!}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : row.designImageUrl ? (
          <MerchPlacementPreview
            imageUrl={row.designImageUrl}
            productType={row.productType}
            placement={row.printPlacement ?? DEFAULT_STORED}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted p-6 text-center text-xs text-muted-foreground">
            No preview
          </div>
        )}
        <Badge className="absolute left-2 top-2 bg-background/85 text-foreground border-0 text-[10px]">
          {productLabel}
        </Badge>
        <div className="absolute right-2 top-2">
          <StatusPill isPublished={row.isPublished} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold">{row.title}</h3>
        {showStorefrontBadge && row.storefrontDisplayName && (
          <p className="text-xs text-muted-foreground">
            on{" "}
            <span className="font-medium text-foreground">
              {row.storefrontDisplayName}
            </span>
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-bold tabular-nums">
            {formatUsd(row.priceCents)}
          </span>
          {row.salesCount > 0 && (
            <span className="text-[11px] text-emerald-500">
              {row.salesCount} sold
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/dashboard/listings/${row.id}/edit`}
            className="flex-1"
            aria-label={`Edit ${row.title}`}
          >
            <Button
              size="sm"
              variant="secondary"
              className="w-full gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </Link>
          <Link
            href={`/product/${row.id}`}
            target="_blank"
            rel="noopener"
            aria-label={`Open ${row.title} on the public shop`}
          >
            <Button size="sm" variant="ghost" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              View
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function StatusPill({ isPublished }: { isPublished: boolean }) {
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500 ring-1 ring-emerald-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border/60">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
      Hidden
    </span>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center border-dashed border-border/50 bg-card/50 p-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold">No published listings yet</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Once you publish a design from the Create flow, it&apos;ll show up here so
        you can tune price, placement, tags, and visibility.
      </p>
      <Link href="/create" className="mt-6">
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <Wand2 className="h-4 w-4" />
          Design your first product
        </Button>
      </Link>
    </Card>
  );
}
