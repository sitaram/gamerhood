"use client";

import { Plus, Star, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  type CreatorStorefrontNav,
  isViewingShop,
} from "@/lib/dashboard/storefront-nav";
import {
  SELLER_DASHBOARD_NAV,
  sellerNavItemActive,
  type SellerNavItem,
} from "@/lib/dashboard/seller-nav";
import { cn } from "@/lib/utils";

export const CREATE_STOREFRONT_HREF = "/dashboard/settings?newStorefront=1";

type MenuProps = {
  storefronts: CreatorStorefrontNav[];
  pathname: string;
  onNavigate: (href: string) => void;
  /** Extra creator-tool links (legacy single-shop view). */
  legacyShopSlug?: string | null;
};

function MenuItemButton({
  active,
  icon: Icon,
  label,
  sublabel,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "bg-primary/5 text-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <span className="flex w-full items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        {active && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Here
          </span>
        )}
      </span>
      {sublabel && (
        <span
          className={cn(
            "pl-6 font-mono text-[11px]",
            active ? "text-foreground/80" : "text-muted-foreground",
          )}
        >
          {sublabel}
        </span>
      )}
    </button>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function renderToolItem(
  item: SellerNavItem,
  pathname: string,
  onNavigate: (href: string) => void,
) {
  const active = sellerNavItemActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <MenuItemButton
      key={item.href}
      active={active}
      icon={Icon}
      label={item.label}
      onClick={() => onNavigate(item.href)}
    />
  );
}

function CreateStorefrontButton({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => onNavigate(CREATE_STOREFRONT_HREF)}
      className="flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
    >
      <Plus className="h-4 w-4 shrink-0" aria-hidden />
      Create another storefront
    </button>
  );
}

/** Desktop + mobile shared body for the navbar Storefront dropdown. */
export function StorefrontDropdownMenu({
  storefronts,
  pathname,
  onNavigate,
  legacyShopSlug,
}: MenuProps) {
  const hasStorefronts = storefronts.length > 0;

  return (
    <div className="flex max-h-[min(70vh,32rem)] flex-col">
      {/* Always visible — was previously at the bottom and easy to miss when scrolling. */}
      <div className="shrink-0 border-b border-border/40 px-2 py-2">
        <CreateStorefrontButton onNavigate={onNavigate} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {hasStorefronts ? (
          <NavSection title="Your shops">
            {storefronts.map((s) => {
              const href = `/shop/${s.slug}`;
              const active = isViewingShop(pathname, s.slug);
              return (
                <MenuItemButton
                  key={s.id}
                  active={active}
                  icon={Store}
                  label={s.displayName}
                  sublabel={`/shop/${s.slug}${s.isDefault ? " · default" : ""}`}
                  onClick={() => onNavigate(href)}
                />
              );
            })}
          </NavSection>
        ) : legacyShopSlug ? (
          <NavSection title="Your shop">
            <MenuItemButton
              active={isViewingShop(pathname, legacyShopSlug)}
              icon={Star}
              label="View my shop"
              sublabel={`/shop/${legacyShopSlug}`}
              onClick={() => onNavigate(`/shop/${legacyShopSlug}`)}
            />
          </NavSection>
        ) : null}

        <div className="my-1 border-t border-border/40" />

        <NavSection title="Creator tools">
          {SELLER_DASHBOARD_NAV.map((item) =>
            renderToolItem(item, pathname, onNavigate),
          )}
        </NavSection>
      </div>
    </div>
  );
}
