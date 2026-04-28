import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-grid">
        <TooltipProvider>
          <Navbar initialUser={initialUser} />
          <main className="flex-1">{children}</main>
          <Footer />
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
