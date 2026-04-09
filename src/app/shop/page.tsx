"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { ProductType } from "@/lib/types";

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

export default function ShopPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProductType | "all">("all");
  const [sort, setSort] = useState<SortOption>("popular");

  const filtered = useMemo(() => {
    let products = [...MOCK_PRODUCTS];

    if (search.trim()) {
      const q = search.toLowerCase();
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.creator?.displayName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      );
    }

    if (typeFilter !== "all") {
      products = products.filter((p) => p.productType === typeFilter);
    }

    switch (sort) {
      case "newest":
        products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "popular":
        products.sort((a, b) => b.salesCount - a.salesCount);
        break;
      case "price-low":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        products.sort((a, b) => b.price - a.price);
        break;
    }

    return products;
  }, [search, typeFilter, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">
          Browse the <span className="gradient-text">Shop</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Discover unique merch created by young designers from around the world
        </p>
      </div>

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
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
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
    </div>
  );
}
