"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product-card";
import type { Product, ProductType } from "@/lib/types";

const PRODUCT_TYPES: { value: ProductType | "all"; label: string }[] = [
  { value: "all", label: "All Products" },
  { value: "hoodie", label: "Hoodies" },
  { value: "tshirt", label: "Tees" },
  { value: "poster", label: "Posters" },
  { value: "mug", label: "Mugs" },
  { value: "sticker", label: "Stickers" },
  { value: "backpack", label: "Backpacks" },
  { value: "phone-case", label: "Phone Cases" },
];

type SortOption = "newest" | "popular" | "price-low" | "price-high";

export function ShopBrowser({ products }: { products: Product[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProductType | "all">("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const filtered = useMemo(() => {
    let result = [...products];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.creator?.displayName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((p) => p.productType === typeFilter);
    }

    switch (sort) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "popular":
        result.sort((a, b) => b.salesCount - a.salesCount);
        break;
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
    }

    return result;
  }, [products, search, typeFilter, sort]);

  if (products.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/50 px-6 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold">No products yet</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The shop is just getting started. Be among the first creators — design something fresh and publish it for the world to see.
        </p>
        <Link href="/create" className="mt-6">
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            Start Creating
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search designs, creators..."
            className="pl-9 bg-card border-border/50"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-wrap gap-2">
            {PRODUCT_TYPES.map((type) => (
              <Badge
                key={type.value}
                variant={typeFilter === type.value ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${
                  typeFilter === type.value
                    ? "bg-primary text-primary-foreground"
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTypeFilter(type.value)}
              >
                {type.label}
              </Badge>
            ))}
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[140px] bg-card border-border/50">
              <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="price-low">Price: Low</SelectItem>
              <SelectItem value="price-high">Price: High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="mt-20 text-center">
          <p className="text-xl font-semibold text-muted-foreground">No products found</p>
          <p className="mt-2 text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </>
  );
}
