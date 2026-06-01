"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ListingStorefrontOption {
  id: string;
  slug: string;
  displayName: string;
  isDefault: boolean;
}

export function ListingStorefrontSelect({
  productId,
  storefronts,
  currentStorefrontId,
  compact = false,
  onMoved,
}: {
  productId: string;
  storefronts: ListingStorefrontOption[];
  currentStorefrontId: string | null;
  /** Smaller trigger for listing cards in the grid. */
  compact?: boolean;
  onMoved?: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>(
    currentStorefrontId ?? storefronts[0]?.id ?? "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTarget(currentStorefrontId ?? storefronts[0]?.id ?? "");
  }, [currentStorefrontId, storefronts]);

  if (storefronts.length === 0) return null;

  if (storefronts.length === 1) {
    const only = storefronts[0]!;
    return (
      <p className="text-xs text-muted-foreground">
        Storefront:{" "}
        <span className="font-medium text-foreground">{only.displayName}</span>
        <span className="ml-1 text-[10px]">/shop/{only.slug}</span>
      </p>
    );
  }

  async function assign(nextId: string) {
    if (!nextId || nextId === (currentStorefrontId ?? "")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontId: nextId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Could not update storefront");
      }
      const movedTo = storefronts.find((s) => s.id === nextId);
      toast.success(
        movedTo
          ? `Now on "${movedTo.displayName}"`
          : "Storefront updated",
      );
      onMoved?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update storefront");
      setTarget(currentStorefrontId ?? storefronts[0]?.id ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Which storefront should buyers see this on?
        </p>
      )}
      <div className="flex items-center gap-2">
        <Select
          value={target}
          onValueChange={(v) => {
            if (!v) return;
            setTarget(v);
            void assign(v);
          }}
          disabled={saving}
        >
          <SelectTrigger
            className={
              compact ? "h-8 w-full text-xs" : "h-9 w-full sm:w-72"
            }
          >
            <SelectValue placeholder="Choose storefront" />
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
        {saving && (
          <Loader2
            className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
            aria-label="Saving"
          />
        )}
      </div>
    </div>
  );
}
