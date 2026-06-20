"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/lib/types";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import { DEFAULT_STORED } from "@/lib/print/placement";
import {
  hasRenderableListingMockup,
  formatProductTypeLabel,
  PRODUCT_TYPE_LABELS,
} from "@/components/storefront/product-card-utils";

interface ProductCardProps {
  product: Product;
}

/**
 * Re-exported here so existing client-side importers keep working while
 * we migrate to the no-directive utils module. New server-component
 * callers MUST import directly from `product-card-utils` — a re-export
 * from this `"use client"` module is still a client reference and would
 * trip the same "Attempted to call X from the server" runtime error
 * that this split was created to fix.
 */
export { hasRenderableListingMockup, PRODUCT_TYPE_LABELS };

export function ProductCard({ product }: ProductCardProps) {
  const previewDesignUrl = `/api/designs/${product.designId}/image?v=${encodeURIComponent(product.createdAt)}&pv=1&rev=20260608b`;
  const hasDesignImage = Boolean(product.designId);
  /**
   * Storefront grid should paint instantly: when a publish-time mockup exists,
   * prefer it over live client-side composition (which waits on blank-photo +
   * sanitized design fetches and can look like a plain garment for seconds).
   */
  const showRealMockup = hasRenderableListingMockup(
    product.mockupUrl,
    product.designImageUrl,
    {
      designUploadedAsSvg: product.designUploadedAsSvg,
      designHasTransparency: product.designHasTransparency ?? null,
    },
  );

  return (
    <Link href={`/product/${product.id}`}>
      <div className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:glow-border-purple">
        <div className="relative aspect-square overflow-hidden bg-secondary">
          {showRealMockup ? (
            <Image
              src={product.mockupUrl}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : hasDesignImage ? (
            <MerchPlacementPreview
              imageUrl={previewDesignUrl}
              productType={product.productType}
              placement={product.printPlacement ?? DEFAULT_STORED}
              showPrintAreaFrame={false}
              transparentBlankBackdrop
              className="transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted p-6 text-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-all group-hover:opacity-100">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <Badge className="absolute top-3 left-3 bg-background/80 text-foreground border-0 text-xs">
            {formatProductTypeLabel(product.productType)}
          </Badge>
          {product.category && (
            <Badge
              variant="secondary"
              className="absolute top-3 right-3 border-border/50 bg-background/80 text-[10px] capitalize max-w-[40%] truncate"
            >
              {product.category.replace(/-/g, " ")}
            </Badge>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {product.title}
          </h3>
          {product.creator && (
            <p className="mt-1 text-xs text-muted-foreground">
              by {product.creator.displayName}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-foreground">
              ${product.price.toFixed(2)}
            </span>
            {product.salesCount > 10 && (
              <span className="text-xs text-neon-green">
                {product.salesCount} sold
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
