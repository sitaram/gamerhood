"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gamepad2, Menu, Sparkles, ShoppingCart, User, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { createBrowserClient } from "@supabase/ssr";

const NAV_LINKS = [
  { href: "/shop", label: "Browse", icon: Gamepad2 },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/dashboard", label: "Dashboard", icon: User },
];

export type NavUser = {
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export function Navbar({ initialUser }: { initialUser: NavUser | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<NavUser | null>(initialUser);
  const totalItems = useCartStore((s) => s.totalItems);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

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
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email ?? null,
          displayName:
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.email?.split("@")[0] ||
            "Creator",
          avatarUrl: session.user.user_metadata?.avatar_url ?? null,
        });
      } else {
        setUser(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const cartCount = mounted ? totalItems() : 0;
  const initials = user?.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary transition-colors group-hover:bg-primary/30">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight gradient-text">
            Gamerhood
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <link.icon className="h-4 w-4" />
                {link.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
                className="inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-border/50 transition hover:ring-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Avatar className="h-9 w-9">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                  <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-border/50 bg-popover text-popover-foreground shadow-lg">
                  <div className="border-b border-border/50 px-4 py-3">
                    <p className="text-sm font-medium leading-tight">{user.displayName}</p>
                    {user.email && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                    )}
                  </div>
                  <div className="py-1">
                    <MenuLink
                      icon={<LayoutDashboard className="h-4 w-4" />}
                      label="Dashboard"
                      href="/dashboard"
                      active={pathname === "/dashboard"}
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
              <SheetTitle className="gradient-text">Gamerhood</SheetTitle>

              {user && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-border/50 bg-card p-3">
                  <Avatar className="h-10 w-10">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                    <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.displayName}</p>
                    {user.email && (
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    )}
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

function MenuLink({
  icon,
  label,
  href,
  active,
  onNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      aria-current={active ? "page" : undefined}
      className={`relative flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
        active ? "bg-primary/5 text-foreground" : ""
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
        />
      )}
      {icon}
      {label}
    </button>
  );
}
