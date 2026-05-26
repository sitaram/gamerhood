"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Star, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MoverStorefront {
  id: string;
  slug: string;
  displayName: string;
  isDefault: boolean;
}

export function ListingStorefrontMover({
  productId,
  storefronts,
  currentStorefrontId,
}: {
  productId: string;
  storefronts: MoverStorefront[];
  currentStorefrontId: string | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>(
    currentStorefrontId ?? storefronts[0]?.id ?? "",
  );
  const [saving, setSaving] = useState(false);

  if (storefronts.length < 2) return null;

  const unchanged = target === (currentStorefrontId ?? "");

  async function move() {
    if (!target || unchanged) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontId: target }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Could not move listing");
      }
      const movedTo = storefronts.find((s) => s.id === target);
      toast.success(
        movedTo
          ? `Moved to "${movedTo.displayName}"`
          : "Listing moved to a different storefront",
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <StoreIcon className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Storefront</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Pick which of your storefronts this listing lives on. Buyers will see
        it on that shop&apos;s URL only.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={target}
          onValueChange={(v) => v && setTarget(v)}
        >
          <SelectTrigger className="h-9 w-full sm:w-72">
            <SelectValue placeholder="Choose a storefront" />
          </SelectTrigger>
          <SelectContent>
            {storefronts.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="flex items-center gap-2">
                  <span className="truncate">{s.displayName}</span>
                  {s.isDefault && (
                    <Star className="h-3 w-3 text-primary" aria-hidden />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    /shop/{s.slug}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          onClick={() => void move()}
          disabled={saving || unchanged || !target}
          className="bg-primary hover:bg-primary/90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move"}
        </Button>
      </div>
    </div>
  );
}
