"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SELLER_DASHBOARD_NAV,
  sellerNavItemActive,
} from "@/lib/dashboard/seller-nav";

/** Horizontal creator-tool links shown across dashboard pages. */
export function DashboardSellerNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Creator tools"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {SELLER_DASHBOARD_NAV.map((item) => {
        const active = sellerNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
