"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { useCartStore } from "@/lib/store";

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const totalItems = useCartStore((s) => s.totalItems);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.product.id,
            printifyProductId: item.product.printifyProductId,
            printifyVariantId: item.product.printifyVariantId,
            title: item.product.title,
            price: item.product.price,
            quantity: item.quantity,
            imageUrl: item.product.mockupUrl,
            selectedColor: item.selectedColor,
            selectedSize: item.selectedSize,
            creatorStripeAccountId: item.product.creatorStripeAccountId,
          })),
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/cart`,
        }),
      });

      if (!res.ok) {
        setCheckingOut(false);
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckingOut(false);
      }
    } catch {
      setCheckingOut(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h1 className="mt-6 text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-3 text-muted-foreground">
          Looks like you haven&apos;t added anything yet. Go discover some amazing creator merch!
        </p>
        <Link href="/shop" className="mt-8 inline-block">
          <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
            <ShoppingCart className="h-5 w-5" />
            Browse the Shop
          </Button>
        </Link>
      </div>
    );
  }

  const shipping = totalPrice() >= 50 ? 0 : 5.99;
  const total = totalPrice() + shipping;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Your <span className="gradient-text">Cart</span>
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearCart}
          className="text-muted-foreground hover:text-destructive"
        >
          Clear All
        </Button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card
              key={`${item.product.id}-${item.selectedColor}-${item.selectedSize}`}
              className="border-border/50 bg-card p-4"
            >
              <div className="flex gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  <Image
                    src={item.product.mockupUrl}
                    alt={item.product.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <Link href={`/product/${item.product.id}`}>
                      <h3 className="font-semibold hover:text-primary transition-colors">
                        {item.product.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.selectedColor}
                      {item.selectedSize && ` / ${item.selectedSize}`}
                    </p>
                    {item.product.creator && (
                      <p className="text-xs text-muted-foreground">
                        by {item.product.creator.displayName}
                      </p>
                    )}
                  </div>

                    <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.selectedColor, item.selectedSize, item.quantity - 1)
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.selectedColor, item.selectedSize, item.quantity + 1)
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeItem(item.product.id, item.selectedColor, item.selectedSize)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          <Link href="/shop">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground mt-2">
              <ArrowLeft className="h-4 w-4" />
              Continue Shopping
            </Button>
          </Link>
        </div>

        <div>
          <Card className="border-border/50 bg-card p-6 sticky top-24">
            <h2 className="text-lg font-semibold">Order Summary</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Subtotal ({totalItems()} item{totalItems() !== 1 ? "s" : ""})
                </span>
                <span>${totalPrice().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {shipping === 0 ? (
                    <span className="text-neon-green">Free</span>
                  ) : (
                    `$${shipping.toFixed(2)}`
                  )}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-muted-foreground">
                  Free shipping on orders over $50
                </p>
              )}
            </div>

            <Separator className="my-4 bg-border/50" />

            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="mt-6 w-full gap-2 bg-primary hover:bg-primary/90"
              size="lg"
            >
              {checkingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to Checkout...
                </>
              ) : (
                <>
                  Checkout
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Secure checkout powered by Stripe
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
