import type { Metadata } from "next";
import { Fredoka, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getParentByAuthUserId,
} from "@/lib/supabase/queries";
import "./globals.css";

// One rounded brand family site-wide (matches wordmark). Mono kept for code.
const fontBrand = Fredoka({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gamerhood — Design it. Wear it. Sell it.",
  description:
    "The kid-powered marketplace where young creators turn their ideas into real merch. AI-assisted design, quality print-on-demand, and a community that celebrates creativity.",
  keywords: ["kids merch", "custom hoodies", "gaming merch", "print on demand", "kid entrepreneur", "AI design"],
  // Order matters: browsers pick the first format they support. We list .ico
  // first so 16/32px tab favicons use the multi-res raster (which was
  // hand-tuned at small sizes) instead of an SVG that shrinks to a fuzzy
  // gradient blob. The `?v=` query busts browser/CDN caches when we update
  // the asset — bump it when the icon changes.
  icons: {
    icon: [
      { url: "/favicon.ico?v=7", sizes: "any" },
      { url: "/icon.png?v=7", type: "image/png", sizes: "192x192" },
    ],
    shortcut: [{ url: "/favicon.ico?v=7" }],
    apple: [{ url: "/apple-icon.png?v=7", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Gamerhood — Design it. Wear it. Sell it.",
    description: "Where young creators turn ideas into real merch.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const initialUser = user
    ? {
        email: user.email ?? null,
        displayName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Creator",
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      }
    : null;

  let creatorShopSlug: string | null = null;
  // `null` = unknown (not signed in, no parent row yet, or fetch failed).
  // The navbar treats `false` as "show the amber Connect nudge" and any
  // other value as "no nudge" — so leaving it null on errors keeps the UI
  // calm rather than flashing a false alarm.
  let stripeOnboarded: boolean | null = null;
  if (user) {
    const [{ data: profile }, { data: parent }] = await Promise.all([
      getDefaultProfileForAuthUser(supabase, user.id),
      getParentByAuthUserId(supabase, user.id),
    ]);
    creatorShopSlug = profile?.slug ?? null;
    if (parent) {
      stripeOnboarded = Boolean(parent.stripe_onboarding_complete);
    }
  }

  return (
    <html
      lang="en"
      className={`${fontBrand.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Explicit links so embedded preview tabs (e.g. Cursor) still resolve
            the tab icon even when Next.js Metadata isn't parsed. Order matches
            `metadata.icons` above so browsers pick the same favicon both ways. */}
        <link rel="icon" href="/favicon.ico?v=7" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon.png?v=7" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=7" />
      </head>
      <body className="min-h-full flex flex-col bg-grid">
        <TooltipProvider>
          <Navbar
            initialUser={initialUser}
            creatorShopSlug={creatorShopSlug}
            stripeOnboarded={stripeOnboarded}
          />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
