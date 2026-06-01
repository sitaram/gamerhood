"use client";

import { Store as StoreIcon } from "lucide-react";
import {
  ListingStorefrontSelect,
  type ListingStorefrontOption,
} from "@/components/dashboard/listing-storefront-select";

export type MoverStorefront = ListingStorefrontOption;

export function ListingStorefrontMover({
  productId,
  storefronts,
  currentStorefrontId,
}: {
  productId: string;
  storefronts: MoverStorefront[];
  currentStorefrontId: string | null;
}) {
  if (storefronts.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-card/50 p-5">
      <div className="flex items-center gap-2">
        <StoreIcon className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Storefront</h3>
      </div>
      <ListingStorefrontSelect
        productId={productId}
        storefronts={storefronts}
        currentStorefrontId={currentStorefrontId}
      />
    </div>
  );
}
