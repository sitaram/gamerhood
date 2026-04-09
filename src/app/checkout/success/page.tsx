"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Package, ArrowRight, ShoppingBag, AlertCircle } from "lucide-react";
import { useCartStore } from "@/lib/store";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const clearCart = useCartStore((s) => s.clearCart);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setVerifyError(true);
      return;
    }

    fetch(`/api/orders?session_id=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("invalid session");
        return res.json();
      })
      .then(() => {
        setVerified(true);
        clearCart();
      })
      .catch(() => {
        setVerifyError(true);
      });
  }, [sessionId, clearCart]);

  if (verifyError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
        <Card className="border-border/50 bg-card p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Invalid Order</h1>
          <p className="mt-3 text-muted-foreground max-w-sm mx-auto">
            We couldn&apos;t verify this order. If you just completed a purchase,
            check your email for confirmation.
          </p>
          <div className="mt-8">
            <Link href="/shop">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <ShoppingBag className="h-5 w-5" />
                Browse Shop
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
        <Card className="border-border/50 bg-card p-8 sm:p-12 text-center">
          <Skeleton className="mx-auto h-20 w-20 rounded-full" />
          <Skeleton className="mx-auto mt-6 h-8 w-48" />
          <Skeleton className="mx-auto mt-3 h-4 w-72" />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <Card className="border-border/50 bg-card p-8 sm:p-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-neon-green/10">
          <CheckCircle className="h-10 w-10 text-neon-green" />
        </div>

        <h1 className="mt-6 text-3xl font-bold">Order Confirmed!</h1>
        <p className="mt-3 text-muted-foreground max-w-sm mx-auto">
          Your order has been placed and sent to our print partner.
          You&apos;ll receive a confirmation email with tracking information shortly.
        </p>

        <p className="mt-4 text-xs text-muted-foreground font-mono">
          Order ref: {sessionId!.slice(-12)}
        </p>

        <Separator className="my-8 bg-border/50" />

        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-background p-4 text-left">
            <Package className="h-8 w-8 text-neon-cyan shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">What happens next?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Your custom merch is being printed right now. Production takes 2-5 business days,
                then it ships directly to you. We&apos;ll email you tracking info as soon as it&apos;s on the way.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/shop">
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
              <ShoppingBag className="h-5 w-5" />
              Keep Shopping
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="gap-2 border-border/50">
              My Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
          <Card className="border-border/50 bg-card p-8 sm:p-12 text-center">
            <Skeleton className="mx-auto h-20 w-20 rounded-full" />
            <Skeleton className="mx-auto mt-6 h-8 w-48" />
            <Skeleton className="mx-auto mt-3 h-4 w-72" />
          </Card>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
