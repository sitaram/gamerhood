"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Copy, ExternalLink, Store } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { siteUrl } from "@/lib/site";
import {
  type CreatorStorefrontNav,
  defaultStorefront,
  isViewingShop,
  readActiveStorefrontId,
  slugFromShopPathname,
  storefrontBySlug,
  writeActiveStorefrontId,
} from "@/lib/dashboard/storefront-nav";
import { cn } from "@/lib/utils";

export function ActiveStorefrontBar({
  storefronts,
  className,
}: {
  storefronts: CreatorStorefrontNav[];
  className?: string;
}) {
  const pathname = usePathname();
  const [manualActiveId, setManualActiveId] = useState<string | null>(null);

  const viewingSlug = slugFromShopPathname(pathname);
  const viewingStorefront = viewingSlug
    ? storefrontBySlug(storefronts, viewingSlug)
    : undefined;

  const fallback = defaultStorefront(storefronts);

  const activeId = useMemo(() => {
    if (viewingStorefront) return viewingStorefront.id;
    if (manualActiveId) return manualActiveId;
    const stored = readActiveStorefrontId();
    const fromStorage = stored
      ? storefronts.find((s) => s.id === stored)
      : undefined;
    return (fromStorage ?? fallback)?.id ?? "";
  }, [viewingStorefront, manualActiveId, storefronts, fallback]);

  useEffect(() => {
    if (viewingStorefront) {
      writeActiveStorefrontId(viewingStorefront.id);
    }
  }, [viewingStorefront]);

  const active = useMemo(
    () => storefronts.find((s) => s.id === activeId) ?? fallback,
    [storefronts, activeId, fallback],
  );

  if (!active || storefronts.length === 0) return null;

  const shopUrl = `${siteUrl()}/shop/${active.slug}`;
  const onPublicShop = isViewingShop(pathname, active.slug);
  const showSwitcher = storefronts.length > 1;

  function handleSelect(id: string) {
    setManualActiveId(id);
    writeActiveStorefrontId(id);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(shopUrl);
      toast.success("Shop URL copied");
    } catch {
      toast.error("Could not copy — try selecting the link manually");
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm transition-colors",
        onPublicShop
          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
          : "border-border/60 bg-muted/30",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Store
            className={cn(
              "h-4 w-4 shrink-0",
              onPublicShop ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden
          />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {onPublicShop ? "Viewing storefront" : "Working storefront"}
          </span>
          {showSwitcher ? (
            <Select value={active.id} onValueChange={(v) => v && handleSelect(v)}>
              <SelectTrigger className="h-8 min-w-[10rem] max-w-[14rem] border-border/60 bg-background text-sm font-semibold">
                <SelectValue>{active.displayName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {storefronts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.displayName}
                    {s.isDefault ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-semibold">{active.displayName}</span>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <code
            className={cn(
              "truncate rounded-md px-2 py-1 text-xs",
              onPublicShop
                ? "bg-primary/15 font-medium text-foreground"
                : "bg-background/80 text-muted-foreground",
            )}
          >
            /shop/{active.slug}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => void copyUrl()}
            aria-label="Copy shop URL"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            render={
              <Link
                href={`/shop/${active.slug}`}
                target={onPublicShop ? undefined : "_blank"}
                rel={onPublicShop ? undefined : "noopener"}
              />
            }
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 shrink-0 gap-1 text-xs",
              onPublicShop && "border-primary/40 bg-primary/5",
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {onPublicShop ? "You are here" : "Open shop"}
          </Button>
        </div>
      </div>
    </div>
  );
}
