"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Heart, Share2, ArrowLeft, Truck, Shield, RotateCcw, Check } from "lucide-react";
import { getProductById } from "@/lib/mock-data";
import { useCartStore } from "@/lib/store";
import { notFound } from "next/navigation";
import { toast } from "sonner";

interface Props {
  params: Promise<{ id: string }>;
}

export default function ProductPage({ params }: Props) {
  const { id } = use(params);
  const maybeProduct = getProductById(id);
  if (!maybeProduct) notFound();
  const product = maybeProduct;

  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[2] || "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const hasClothing = !!product.sizes;

  function handleAddToCart() {
    for (let i = 0; i < quantity; i++) {
      addItem(product, selectedColor, selectedSize || undefined);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleLike() {
    setLiked(!liked);
    toast(liked ? "Removed from favorites" : "Added to favorites");
  }

  async function handleShare() {
    const url = window.location.href;
    const shareData = { title: product.title, text: product.description, url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard!");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/shop">
        <Button variant="ghost" size="sm" className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Shop
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/50 bg-card">
          <div className="relative aspect-square">
            <Image
              src={product.mockupUrl}
              alt={product.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </Card>

        <div className="space-y-6">
          <div>
            {product.creator && (
              <Link href={`/shop/${product.creator.slug}`}>
                <Badge variant="outline" className="mb-3 border-primary/30 text-primary hover:bg-primary/10">
                  by {product.creator.displayName}
                </Badge>
              </Link>
            )}
            <h1 className="text-3xl font-bold">{product.title}</h1>
            <p className="mt-2 text-muted-foreground">{product.description}</p>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold">${product.price.toFixed(2)}</span>
            {product.salesCount > 5 && (
              <span className="text-sm text-neon-green">{product.salesCount} sold</span>
            )}
          </div>

          <Separator className="bg-border/50" />

          {product.colors.length > 1 && product.colors[0] !== "N/A" && (
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Color: <span className="text-muted-foreground font-normal">{selectedColor}</span>
              </label>
              <div className="flex gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                      selectedColor === color
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasClothing && product.sizes && (
            <div>
              <label className="text-sm font-semibold mb-2 block">Size</label>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[48px] rounded-lg border px-3 py-2 text-sm transition-all ${
                      selectedSize === size
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold mb-2 block">Quantity</label>
            <Select value={String(quantity)} onValueChange={(v) => setQuantity(Number(v))}>
              <SelectTrigger className="w-24 bg-card border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              onClick={handleAddToCart}
              className={`flex-1 gap-2 transition-all ${added ? "bg-neon-green hover:bg-neon-green/90 text-black" : "bg-primary hover:bg-primary/90"}`}
            >
              {added ? (
                <>
                  <Check className="h-5 w-5" />
                  Added!
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  Add to Cart — ${(product.price * quantity).toFixed(2)}
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleLike}
              className={`border-border/50 ${liked ? "text-red-500 border-red-500/30" : ""}`}
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            </Button>
            <Button size="lg" variant="outline" onClick={handleShare} className="border-border/50">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          <Card className="border-border/50 bg-card/50 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Truck className="h-4 w-4 text-neon-cyan shrink-0" />
                <span className="text-muted-foreground">Free shipping on orders over $50</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-neon-green shrink-0" />
                <span className="text-muted-foreground">Premium quality print-on-demand</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <RotateCcw className="h-4 w-4 text-neon-orange shrink-0" />
                <span className="text-muted-foreground">30-day satisfaction guarantee</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
