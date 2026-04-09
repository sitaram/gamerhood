"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
}

const TYPE_LABELS: Record<string, string> = {
  hoodie: "Hoodie",
  tshirt: "Tee",
  joggers: "Joggers",
  mug: "Mug",
  poster: "Poster",
  backpack: "Backpack",
  "phone-case": "Phone Case",
  sticker: "Sticker",
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/product/${product.id}`}>
      <div className="group overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-primary/30 hover:glow-border-purple">
        <div className="relative aspect-square overflow-hidden bg-secondary">
          <Image
            src={product.mockupUrl}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-all group-hover:opacity-100">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <Badge className="absolute top-3 left-3 bg-background/80 text-foreground border-0 text-xs">
            {TYPE_LABELS[product.productType] || product.productType}
          </Badge>
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
