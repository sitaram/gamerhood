"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/lib/types";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import { DEFAULT_STORED } from "@/lib/print/placement";

interface ProductCardProps {
  product: Product;
}

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hoodie: "Hoodie",
  "kids-hoodie": "Kids hoodie",
  "kids-tshirt": "Kids tee",
  "kids-heavyweight-tee": "Kids heavyweight tee",
  "kids-long-sleeve": "Kids long sleeve",
  "kids-sports-tee": "Kids sports tee",
  tshirt: "Tee",
  joggers: "Joggers",
  mug: "Mug",
  poster: "Poster",
  backpack: "Backpack",
  "phone-case": "Phone Case",
  sticker: "Sticker",
  pillow: "Shaped pillow",
  blanket: "Sherpa blanket",
  "pet-sweater": "Pet sweater",
  "tote-bag": "Eco tote",
  ornament: "Metal ornament",
  puzzle: "Jigsaw puzzle",
  "embroidered-patch": "Embroidered patch",
  "hardcover-journal": "Hardcover journal",
};

/**
 * `mockup_url` is "renderable as the listing photo" when the publish flow (or
 * a creator's custom upload) actually wrote a real image — i.e. it's not
 * empty, not a `data:` blob, and not the fallback where the publish route
 * stamped the bare design URL because Printful mockup-tasks failed/was unset.
 *
 * When this returns true we render `<Image src={mockup_url}>` directly: that's
 * either a Printful-CDN photo of the design composited on the actual garment,
 * or a creator-uploaded custom listing photo from Supabase Storage. Otherwise
 * we fall back to the in-browser `MerchPlacementPreview` (design composited
 * on the blank Printful flat photo + dashed print-area markers).
 */
export function hasRenderableListingMockup(
  mockupUrl: string | null | undefined,
  designImageUrl: string | null | undefined,
): boolean {
  const m = mockupUrl?.trim();
  if (!m) return false;
  if (m.startsWith("data:")) return false;
  const d = designImageUrl?.trim();
  if (d && m === d) return false;
  return true;
}

export function ProductCard({ product }: ProductCardProps) {
  const showRealMockup = hasRenderableListingMockup(
    product.mockupUrl,
    product.designImageUrl,
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
              unoptimized
            />
          ) : product.designImageUrl?.trim() ? (
            <MerchPlacementPreview
              imageUrl={product.designImageUrl}
              productType={product.productType}
              placement={product.printPlacement ?? DEFAULT_STORED}
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
            {PRODUCT_TYPE_LABELS[product.productType] || product.productType}
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
