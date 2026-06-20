"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ListingStorefrontOption {
  id: string;
  slug: string;
  displayName: string;
  isDefault: boolean;
}

export function ListingStorefrontSelect({
  productId,
  storefronts,
  currentStorefrontIds,
  compact = false,
  onMoved,
}: {
  productId: string;
  storefronts: ListingStorefrontOption[];
  currentStorefrontIds: string[];
  /** Smaller trigger for listing cards in the grid. */
  compact?: boolean;
  onMoved?: () => void;
}) {
  const router = useRouter();
  const [targetIds, setTargetIds] = useState<string[]>(currentStorefrontIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTargetIds(currentStorefrontIds);
  }, [currentStorefrontIds]);

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

  async function assign(nextIds: string[]) {
    const normalized = Array.from(new Set(nextIds));
    const same =
      normalized.length === currentStorefrontIds.length &&
      normalized.every((id) => currentStorefrontIds.includes(id));
    if (same) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storefrontIds: normalized }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Could not update storefront");
      }
      toast.success(
        normalized.length === 1
          ? `Now on "${storefronts.find((s) => s.id === normalized[0])?.displayName ?? "1 shop"}"`
          : `Now on ${normalized.length} shops`,
      );
      onMoved?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update storefront");
      setTargetIds(currentStorefrontIds);
    } finally {
      setSaving(false);
    }
  }

  const selectedNames = storefronts
    .filter((s) => targetIds.includes(s.id))
    .map((s) => s.displayName);
  const buttonLabel =
    selectedNames.length === 0
      ? "Choose storefronts"
      : selectedNames.length === 1
        ? selectedNames[0]!
        : `${selectedNames.length} shops`;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Which storefronts should buyers see this on?
        </p>
      )}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={saving}
            render={
              <Button
                variant="outline"
                size={compact ? "sm" : "default"}
                className={compact ? "h-8 w-full justify-between text-xs" : "h-9 w-full justify-between sm:w-72"}
              >
                <span className="truncate">{buttonLabel}</span>
                {targetIds.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {targetIds.length}
                  </span>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Choose storefronts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {storefronts.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.id}
                checked={targetIds.includes(s.id)}
                disabled={saving}
                onCheckedChange={(checked) => {
                  const next = new Set(targetIds);
                  if (checked) {
                    next.add(s.id);
                  } else {
                    if (next.size <= 1) {
                      toast.error("A listing must stay on at least one shop");
                      return;
                    }
                    next.delete(s.id);
                  }
                  const nextIds = Array.from(next);
                  setTargetIds(nextIds);
                  void assign(nextIds);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{s.displayName}</span>
                  {s.isDefault && <Star className="h-3 w-3 text-primary" aria-hidden />}
                  <span className="text-[10px] text-muted-foreground">/shop/{s.slug}</span>
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
              {targetIds.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Showing on {targetIds.length} shop{targetIds.length === 1 ? "" : "s"}
                </span>
              ) : (
                "Pick at least one storefront"
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
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
