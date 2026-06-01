"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { BrandNavLogo } from "@/components/brand/brand-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Gamepad2,
  Menu,
  Sparkles,
  ShoppingCart,
  LogIn,
  LogOut,
  LayoutDashboard,
  LayoutGrid,
  Store,
  ChevronDown,
  ExternalLink,
  Tags,
  Pencil,
  UserRound,
  Images,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { getAnonDesigns, clearAnonDesigns } from "@/lib/anon-designs";
import { cn } from "@/lib/utils";
import { profileInitials } from "@/lib/profile-avatar";

const NAV_LINKS = [
  { href: "/shop", label: "Browse", icon: Gamepad2 },
  { href: "/create", label: "Create", icon: Sparkles },
];

function buildStorefrontNavItems(shopSlug: string | null): { href: string; label: string; icon: LucideIcon }[] {
  const items: { href: string; label: string; icon: LucideIcon }[] = [];
  if (shopSlug) {
    items.push({ href: `/shop/${shopSlug}`, label: "View my shop (public view)", icon: ExternalLink });
  }
  items.push(
    { href: "/dashboard/designs", label: "My Images & Uploads", icon: Images },
    { href: "/dashboard/listings", label: "Manage listings", icon: LayoutGrid },
    { href: "/dashboard/storefront", label: "Storefront settings", icon: Store },
    { href: "/dashboard/categories", label: "SEO categories", icon: Tags },
  );
  return items;
}

function isUnderStorefrontNav(pathname: string, shopSlug: string | null): boolean {
  if (pathname === "/dashboard") return false;
  if (pathname.startsWith("/dashboard/")) return true;
  if (shopSlug && pathname.startsWith(`/shop/${shopSlug}`)) return true;
  return false;
}

function storefrontNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

function sellerDashboardNavActive(pathname: string): boolean {
  return pathname === "/dashboard";
}

export type NavUser = {
  email: string | null;
  displayName: string;
  /**
   * Already resolved to a renderable url by the server (uploaded photo
   * if any, otherwise a stable default-axolotl pick). The navbar still
   * keeps an initials `AvatarFallback` for the brief window before the
   * image decodes.
   */
  avatarUrl: string;
};

export function Navbar({
  initialUser,
  creatorShopSlug,
  stripeOnboarded: initialStripeOnboarded = null,
}: {
  initialUser: NavUser | null;
  /** Default profile slug — powers “View my shop (public view)” in the Storefront menu. */
  creatorShopSlug?: string | null;
  /**
   * Server-resolved Stripe Connect onboarding status. `false` triggers the
   * amber "finish payouts" nudge in the seller-dashboard surfaces; `true`
   * or `null` keep the navbar quiet. Passing it server-side prevents a
   * client fetch flicker on first paint.
   */
  stripeOnboarded?: boolean | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storefrontOpen, setStorefrontOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<NavUser | null>(initialUser);
  const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(
    initialStripeOnboarded,
  );
  const cartItemCount = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.quantity, 0),
  );
  const menuRef = useRef<HTMLDivElement | null>(null);
  const storefrontRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!storefrontOpen) return;
    function onClick(e: MouseEvent) {
      if (storefrontRef.current && !storefrontRef.current.contains(e.target as Node)) {
        setStorefrontOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setStorefrontOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [storefrontOpen]);

  useEffect(() => {
    setStorefrontOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Migrate any designs the user created while anonymous, and run
        // /api/auth/bootstrap so the parent + child-profile rows exist
        // before the dashboard renders.
        //   - SIGNED_IN fires for client-side flows (email/password,
        //     including the first sign-in after a user clicks the email
        //     confirmation link).
        //   - INITIAL_SESSION fires for OAuth — sign-in happens in the
        //     server-side /auth/callback before the navbar ever mounts,
        //     so by the time the browser hydrates, the session already
        //     exists and only INITIAL_SESSION is emitted. /auth/callback
        //     also calls bootstrapAccount itself; the duplicate fire
        //     here is harmless because bootstrap is idempotent.
        // Both helpers short-circuit on an empty workload, so firing on
        // every page load is cheap.
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          void migrateAnonDesignsIfAny();
          void bootstrapAccountIfNeeded();
          // Refresh the Stripe onboarding flag after auth events so the
          // amber nudge clears as soon as the user comes back from a
          // successful Connect flow. The initial paint uses the
          // server-rendered value (no flicker); this only ever flips
          // the indicator off after a real auth state change.
          void refreshStripeOnboarded(setStripeOnboarded);
        }
        // Don't compute an avatar from `session.user.id` here — that's the
        // auth user id, not the `profiles.id` UUID we deterministically
        // hash against everywhere else (dashboard, storefront, settings).
        // Using the wrong seed would pick a *different* default axolotl
        // than the rest of the site, which is the exact "inconsistent
        // profile pic" bug we're avoiding. On a real sign-in transition
        // we ask the server to re-render the layout so `initialUser`
        // (and its profile-id-seeded avatar) is fetched fresh; on
        // INITIAL_SESSION the server already rendered it.
        if (event === "SIGNED_IN") {
          router.refresh();
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setStripeOnboarded(null);
        router.refresh();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
    await supabase.auth.signOut();
    setOpen(false);
    setStorefrontOpen(false);
    router.push("/");
    router.refresh();
  }

  const cartCount = mounted ? cartItemCount : 0;
  const initials = profileInitials(user?.displayName ?? "");

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:min-h-16 sm:px-6 lg:gap-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center overflow-visible py-0.5 pr-2"
        >
          <BrandNavLogo className="brightness-[1.02] transition-opacity group-hover:opacity-95" priority />
        </Link>

        <nav className="hidden flex-1 justify-center gap-1 md:flex md:items-center">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <link.icon className="h-4 w-4" />
                {link.label}
              </Button>
            </Link>
          ))}
          {user && (
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                title={
                  stripeOnboarded === false
                    ? "Connect your bank account to start earning"
                    : undefined
                }
                className={cn(
                  "gap-2 text-muted-foreground hover:text-foreground",
                  sellerDashboardNavActive(pathname) && "text-foreground",
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Seller Dashboard
                {stripeOnboarded === false && (
                  <span
                    aria-hidden
                    className="ml-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400"
                  />
                )}
              </Button>
            </Link>
          )}
          {user && (
            <div ref={storefrontRef} className="relative">
              <button
                type="button"
                aria-label="Storefront menu"
                aria-expanded={storefrontOpen}
                aria-haspopup="menu"
                onClick={() => setStorefrontOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  storefrontOpen && "bg-accent text-accent-foreground",
                  !storefrontOpen &&
                    isUnderStorefrontNav(pathname, creatorShopSlug ?? null) &&
                    "text-foreground",
                  !storefrontOpen &&
                    !isUnderStorefrontNav(pathname, creatorShopSlug ?? null) &&
                    "text-muted-foreground",
                )}
              >
                <Store className="h-4 w-4 shrink-0" aria-hidden />
                Storefront
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 transition-transform duration-200", storefrontOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {storefrontOpen && (
                <div
                  role="menu"
                  className="absolute left-1/2 top-full z-50 mt-1 min-w-[14rem] -translate-x-1/2 rounded-lg border border-border/50 bg-popover py-1 text-popover-foreground shadow-lg md:left-0 md:translate-x-0"
                >
                  {buildStorefrontNavItems(creatorShopSlug ?? null).map((item) => {
                    const active = storefrontNavItemActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setStorefrontOpen(false);
                          router.push(item.href);
                        }}
                        className={cn(
                          "relative flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                          active && "bg-primary/5 text-foreground",
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
                          />
                        )}
                        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
          </Link>

          {user ? (
            <div ref={menuRef} className="relative hidden sm:block">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full ring-2 ring-primary/30 shadow-md shadow-primary/10 transition hover:ring-primary/60 hover:shadow-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Avatar className="h-12 w-12">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                  <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-border/50 bg-popover text-popover-foreground shadow-lg">
                  <div className="border-b border-border/50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/30 shadow-lg shadow-primary/20">
                          {user.avatarUrl && (
                            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                          )}
                          <AvatarFallback className="bg-primary/20 text-base font-semibold text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-tight">{user.displayName}</p>
                          {user.email && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                          )}
                        </div>
                      </div>
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setMenuOpen(false)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Edit profile"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </div>
                  </div>
                  <div className="py-1">
                    <MenuLink
                      icon={<UserRound className="h-4 w-4" />}
                      label="Edit profile"
                      href="/dashboard/settings"
                      active={pathname === "/dashboard/settings"}
                      onNavigate={(href) => {
                        setMenuOpen(false);
                        router.push(href);
                      }}
                    />
                    <MenuLink
                      icon={<LayoutDashboard className="h-4 w-4" />}
                      label="Seller Dashboard"
                      subtitle={
                        stripeOnboarded === false
                          ? "Connect your bank account for profits"
                          : "Manage products & payouts"
                      }
                      href="/dashboard"
                      active={sellerDashboardNavActive(pathname)}
                      onNavigate={(href) => {
                        setMenuOpen(false);
                        router.push(href);
                      }}
                    />
                    <MenuLink
                      icon={<Sparkles className="h-4 w-4" />}
                      label="Start Creating"
                      href="/create"
                      active={pathname === "/create"}
                      onNavigate={(href) => {
                        setMenuOpen(false);
                        router.push(href);
                      }}
                    />
                  </div>
                  <div className="border-t border-border/50 py-1">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}

          {!user && (
            <Link href="/create" className="hidden sm:block">
              <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
                <Sparkles className="h-4 w-4" />
                Start Creating
              </Button>
            </Link>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border">
              <SheetTitle className="sr-only">Gamerhood navigation</SheetTitle>
              <Link href="/" onClick={() => setOpen(false)} className="block w-[min(100%,28rem)] pr-10">
                <BrandNavLogo priority />
              </Link>

              {user && (
                <div className="mt-6 rounded-lg border border-border/50 bg-card p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/30 shadow-lg shadow-primary/20">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                      <AvatarFallback className="bg-primary/20 text-base font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{user.displayName}</p>
                      {user.email && (
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      )}
                    </div>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setOpen(false)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Edit profile"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </div>
                </div>
              )}

              <nav className="mt-6 flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
                      <link.icon className="h-5 w-5" />
                      {link.label}
                    </Button>
                  </Link>
                ))}
                {user && (
                  <div className="flex flex-col">
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3",
                          sellerDashboardNavActive(pathname) ? "bg-primary/5 text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <LayoutDashboard className="h-5 w-5 shrink-0" />
                        Seller Dashboard
                      </Button>
                    </Link>
                    {stripeOnboarded === false && (
                      <p className="-mt-1 pl-12 pr-3 pb-1 text-xs text-muted-foreground">
                        Connect your bank account for profits
                      </p>
                    )}
                  </div>
                )}
                {user && (
                  <div className="mt-4 border-t border-border/40 pt-4">
                    <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Storefront
                    </p>
                    <div className="flex flex-col gap-1">
                      {buildStorefrontNavItems(creatorShopSlug ?? null).map((item) => {
                        const Icon = item.icon;
                        const active = storefrontNavItemActive(pathname, item.href);
                        return (
                          <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                            <Button
                              variant="ghost"
                              className={cn(
                                "w-full justify-start gap-3",
                                active ? "bg-primary/5 text-foreground" : "text-muted-foreground",
                              )}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              {item.label}
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Link href="/cart" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
                    <ShoppingCart className="h-5 w-5" />
                    Cart{cartCount > 0 && ` (${cartCount})`}
                  </Button>
                </Link>
                {user ? (
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </Button>
                ) : (
                  <Link href="/auth/login" onClick={() => setOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
                      <LogIn className="h-5 w-5" />
                      Sign In
                    </Button>
                  </Link>
                )}
                <Link href="/create" onClick={() => setOpen(false)}>
                  <Button className="mt-4 w-full gap-2 bg-primary">
                    <Sparkles className="h-4 w-4" />
                    Start Creating
                  </Button>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

/**
 * Fire the idempotent `/api/auth/bootstrap` endpoint so a fresh user has
 * their parent + default child-profile rows. This used to be called
 * inline from the email signup page, but Supabase's email-confirmation
 * flow means signUp doesn't actually start a session — the user has to
 * click the confirmation link first, and only *then* do they sign in
 * (which fires SIGNED_IN here). Doing it here also self-heals legacy
 * users whose rows were never provisioned.
 */
async function bootstrapAccountIfNeeded() {
  try {
    await fetch("/api/auth/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Best-effort: a failing bootstrap will be retried on the next
    // SIGNED_IN / INITIAL_SESSION event.
  }
}

async function migrateAnonDesignsIfAny() {
  const designs = getAnonDesigns();
  if (designs.length === 0) return;

  try {
    const res = await fetch("/api/designs/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designs: designs.map((d) => ({
          prompt: d.prompt,
          style: d.style,
          imageUrl: d.imageUrl,
          createdAt: d.createdAt,
        })),
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const migrated: number = data.migrated ?? 0;

    if (migrated > 0) {
      clearAnonDesigns();
      toast.success(
        `Saved ${migrated} design${migrated === 1 ? "" : "s"} to your gallery`,
      );
    }
  } catch {
    // Quiet failure — designs remain in localStorage and we can retry on next sign-in.
  }
}

function MenuLink({
  icon,
  label,
  subtitle,
  href,
  active,
  onNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  /**
   * Optional smaller, muted line shown beneath the label. Used by the
   * Seller Dashboard entry to nudge creators toward Stripe Connect.
   */
  subtitle?: string;
  href: string;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      aria-current={active ? "page" : undefined}
      className={`relative flex w-full items-start gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
        active ? "bg-primary/5 text-foreground" : ""
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="leading-snug">{label}</span>
        {subtitle && (
          <span className="text-[11px] leading-tight text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * Pull the latest Connect onboarding flag from the API and feed it into
 * the navbar's local state. Treated as best-effort: network / auth errors
 * simply leave the previous value in place (the server-rendered initial
 * paint is already authoritative for the first frame).
 */
async function refreshStripeOnboarded(
  setStripeOnboarded: (next: boolean | null) => void,
): Promise<void> {
  try {
    const res = await fetch("/api/stripe/connect", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { onboarded?: unknown };
    if (typeof data?.onboarded === "boolean") {
      setStripeOnboarded(data.onboarded);
    }
  } catch {
    // Quiet failure — keep the existing value.
  }
}
