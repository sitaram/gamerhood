"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, ChevronUp, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import { MERCH_CATEGORIES, isSingleVariantCategory } from "@/lib/merch/categories";
import type { MerchCategory } from "@/lib/merch/categories";
import { PRODUCT_TYPE_LABELS } from "@/components/storefront/product-card";
import type { ProductType } from "@/lib/types";
import type { StoredPrintPlacement } from "@/lib/print/placement";

interface Props {
  imageUrl: string;
  selected: Set<ProductType>;
  onToggle: (type: ProductType) => void;
  basePlacement: StoredPrintPlacement;
  placementOverrides: Partial<Record<ProductType, StoredPrintPlacement>>;
  onTune: (type: ProductType) => void;
}

const VARIANT_LABEL_OVERRIDES: Partial<Record<ProductType, string>> = {
  hoodie: "Adult unisex hoodie",
  "kids-hoodie": "Kids pullover hoodie",
  tshirt: "Adult unisex tee",
  "kids-tshirt": "Youth staple tee",
  "kids-heavyweight-tee": "Youth heavyweight tee",
  "kids-long-sleeve": "Youth long-sleeve tee",
  "kids-sports-tee": "Youth sports tee (DTF)",
};

function variantLabel(type: ProductType): string {
  return VARIANT_LABEL_OVERRIDES[type] ?? PRODUCT_TYPE_LABELS[type] ?? type;
}

/**
 * Two-level merch picker: outer category cards (Hoodies, Tees, …) expand inline
 * to reveal the specific Printful blanks. Single-variant categories behave as a
 * single checkbox (no expander).
 */
export function CategoryProductPicker({
  imageUrl,
  selected,
  onToggle,
  basePlacement,
  placementOverrides,
  onTune,
}: Props) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(() => "hoodies");
  const [pulseCategoryId, setPulseCategoryId] = useState<string | null>(null);
  /** Map of category id → expansion panel ref so we can scroll the just-opened
   *  panel into view. Without this, tapping `Accessories` quietly expands
   *  below the fold on phones and looks like nothing happened. */
  const expansionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedCountByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    for (const cat of MERCH_CATEGORIES) {
      result[cat.id] = cat.variants.filter((v) => selected.has(v)).length;
    }
    return result;
  }, [selected]);

  useEffect(() => {
    if (!openCategoryId) return;
    const node = expansionRefs.current[openCategoryId];
    if (!node) return;
    const id = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    return () => window.clearTimeout(id);
  }, [openCategoryId]);

  useEffect(() => {
    if (!pulseCategoryId) return;
    const id = window.setTimeout(() => setPulseCategoryId(null), 600);
    return () => window.clearTimeout(id);
  }, [pulseCategoryId]);

  return (
    <div className="space-y-3">
      {MERCH_CATEGORIES.map((cat) => {
        const isSingle = isSingleVariantCategory(cat);
        const onlyVariant = isSingle ? cat.variants[0] : null;
        const singleSelected =
          isSingle && onlyVariant ? selected.has(onlyVariant) : false;
        const open = openCategoryId === cat.id;
        const selectedCount = selectedCountByCategory[cat.id] ?? 0;
        const totalCount = cat.variants.length;
        const pulse = pulseCategoryId === cat.id;

        return (
          <div
            key={cat.id}
            className={`rounded-2xl border transition-all duration-200 ${
              (isSingle ? singleSelected : selectedCount > 0)
                ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                : "border-border/60 bg-card"
            } ${pulse ? "ring-2 ring-primary/40" : ""}`}
          >
            <button
              type="button"
              onClick={() => {
                if (isSingle && onlyVariant) {
                  const wasSelected = selected.has(onlyVariant);
                  onToggle(onlyVariant);
                  setPulseCategoryId(cat.id);
                  toast.success(
                    wasSelected
                      ? `Removed ${cat.label.toLowerCase()} from your batch`
                      : `Added ${cat.label.toLowerCase()} to your batch`,
                  );
                } else {
                  setOpenCategoryId((cur) => (cur === cat.id ? null : cat.id));
                }
              }}
              className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary"
              aria-expanded={isSingle ? undefined : open}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {cat.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{cat.blurb}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSingle ? (
                  <SingleVariantBadge selected={singleSelected} />
                ) : (
                  <>
                    {selectedCount > 0 ? (
                      <span className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground shadow-sm tabular-nums">
                        <Check className="h-3.5 w-3.5" />
                        {selectedCount} selected
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {totalCount} styles
                      </span>
                    )}
                    {open ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </>
                )}
              </div>
            </button>

            {!isSingle && open && (
              <div
                ref={(el) => {
                  expansionRefs.current[cat.id] = el;
                }}
                className="border-t border-border/60 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cat.variants.map((type) => (
                    <VariantTile
                      key={type}
                      type={type}
                      imageUrl={imageUrl}
                      placement={placementOverrides[type] ?? basePlacement}
                      selected={selected.has(type)}
                      onToggle={() => onToggle(type)}
                      onTune={() => onTune(type)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <SelectionSummary categories={MERCH_CATEGORIES} selected={selected} />
    </div>
  );
}

function SingleVariantBadge({ selected }: { selected: boolean }) {
  return selected ? (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
      <Check className="h-3.5 w-3.5" />
      Added
    </span>
  ) : (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 text-[11px] font-medium text-primary">
      <Plus className="h-3 w-3" />
      Tap to add
    </span>
  );
}

function VariantTile({
  type,
  imageUrl,
  placement,
  selected,
  onToggle,
  onTune,
}: {
  type: ProductType;
  imageUrl: string;
  placement: StoredPrintPlacement;
  selected: boolean;
  onToggle: () => void;
  onTune: () => void;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border p-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border/50 bg-card hover:border-border"
      }`}
    >
      {selected && (
        <div className="pointer-events-none absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </div>
      )}
      <div className="relative mx-auto mb-3 h-28 w-full max-w-[11rem] overflow-hidden rounded-lg bg-secondary sm:h-32">
        <MerchPlacementPreview
          imageUrl={imageUrl}
          productType={type}
          placement={placement}
          /**
           * For frame-bearing create tiles, always use the default variant path.
           * Per-color catalog photos don't carry authoritative template pixel
           * rects, which makes the guide box drift off-garment.
           */
          blankColorName={null}
          showPrintAreaFrame={false}
        />
      </div>
      <div className="pointer-events-none text-center">
        <h4 className="text-sm font-semibold leading-tight">{variantLabel(type)}</h4>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="relative z-10 mt-2 w-full pointer-events-auto gap-1.5 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          onTune();
        }}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Fine-tune
      </Button>
    </div>
  );
}

function SelectionSummary({
  categories,
  selected,
}: {
  categories: MerchCategory[];
  selected: Set<ProductType>;
}) {
  const total = selected.size;
  if (total === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
        Pick at least one item to publish — start with a hoodie or tee.
      </p>
    );
  }
  const groups: string[] = [];
  for (const cat of categories) {
    const count = cat.variants.filter((v) => selected.has(v)).length;
    if (count > 0) groups.push(`${cat.label} (${count})`);
  }
  return (
    <p className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
      Publishing <span className="font-semibold text-foreground">{total} item{total === 1 ? "" : "s"}</span>
      {" — "}
      {groups.join(" · ")}
    </p>
  );
}
