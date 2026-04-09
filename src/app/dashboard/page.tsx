"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Eye,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Package,
  Palette,
  LogIn,
} from "lucide-react";
import { MOCK_CREATORS, MOCK_PRODUCTS, MOCK_DESIGNS } from "@/lib/mock-data";
import { createBrowserClient } from "@supabase/ssr";

const creator = MOCK_CREATORS[2];
const myProducts = MOCK_PRODUCTS.filter((p) => p.creatorId === creator.id);
const myDesigns = MOCK_DESIGNS.filter((d) => d.creatorId === creator.id);

const STATS = [
  {
    label: "Total Earnings",
    value: "$1,247.50",
    change: "+$182 this month",
    icon: DollarSign,
    color: "text-neon-green",
    bg: "bg-neon-green/10",
  },
  {
    label: "Total Sales",
    value: String(creator.totalSales),
    change: "+12 this month",
    icon: ShoppingBag,
    color: "text-neon-cyan",
    bg: "bg-neon-cyan/10",
  },
  {
    label: "Store Views",
    value: "2,841",
    change: "+340 this week",
    icon: Eye,
    color: "text-neon-purple",
    bg: "bg-neon-purple/10",
  },
  {
    label: "Designs",
    value: String(creator.totalDesigns),
    change: `${myProducts.length} products live`,
    icon: Palette,
    color: "text-neon-pink",
    bg: "bg-neon-pink/10",
  },
];

const RECENT_ORDERS = [
  { id: "ORD-001", product: "Neon Skyline Hoodie", buyer: "Alex M.", total: 43, status: "shipped" as const, date: "Apr 5" },
  { id: "ORD-002", product: "Neon Skyline Mug", buyer: "Jordan K.", total: 18, status: "processing" as const, date: "Apr 4" },
  { id: "ORD-003", product: "Neon Skyline Hoodie", buyer: "Sam T.", total: 43, status: "delivered" as const, date: "Apr 1" },
  { id: "ORD-004", product: "Neon Skyline Mug", buyer: "Riley P.", total: 18, status: "delivered" as const, date: "Mar 28" },
];

const STATUS_COLORS: Record<string, string> = {
  processing: "bg-neon-orange/20 text-neon-orange",
  shipped: "bg-neon-cyan/20 text-neon-cyan",
  delivered: "bg-neon-green/20 text-neon-green",
};

export default function DashboardPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
      setAuthChecked(true);
    });
  }, []);

  const xpToNext = (creator.level + 1) * 500;
  const xpProgress = Math.round((creator.xp / xpToNext) * 100);

  if (authChecked && !isLoggedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
          <LogIn className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Sign in to your Dashboard</h1>
        <p className="mt-3 text-muted-foreground">
          Log in with your parent account to manage designs, view sales, and track orders.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/auth/login">
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
              <LogIn className="h-5 w-5" />
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button size="lg" variant="outline" className="gap-2 border-border/50">
              Create Account
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Demo mode: showing sample data below. Sign in to see your real dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary">
            <Image src={creator.avatarUrl} alt={creator.displayName} fill className="object-cover" unoptimized />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{creator.displayName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 text-neon-orange fill-neon-orange" />
              Level {creator.level} &bull; {creator.xp} / {xpToNext} XP
            </div>
            <Progress value={xpProgress} className="mt-1 h-1.5 w-32" />
          </div>
        </div>

        <Link href="/create">
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Sparkles className="h-4 w-4" />
            New Design
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-neon-green" />
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="orders" className="mt-8">
        <TabsList className="bg-card border border-border/50">
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
          <TabsTrigger value="designs">My Designs</TabsTrigger>
          <TabsTrigger value="products">My Products</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <Card className="border-border/50 bg-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="px-6 py-3 text-left font-medium">Order</th>
                      <th className="px-6 py-3 text-left font-medium">Product</th>
                      <th className="px-6 py-3 text-left font-medium">Buyer</th>
                      <th className="px-6 py-3 text-left font-medium">Total</th>
                      <th className="px-6 py-3 text-left font-medium">Status</th>
                      <th className="px-6 py-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_ORDERS.map((order) => (
                      <tr key={order.id} className="border-b border-border/30 last:border-0">
                        <td className="px-6 py-4 font-mono text-xs">{order.id}</td>
                        <td className="px-6 py-4">{order.product}</td>
                        <td className="px-6 py-4 text-muted-foreground">{order.buyer}</td>
                        <td className="px-6 py-4 font-semibold">${order.total}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="designs" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myDesigns.map((design) => (
              <Card key={design.id} className="overflow-hidden border-border/50 bg-card">
                <div className="relative aspect-square">
                  <Image src={design.imageUrl} alt={design.title} fill className="object-cover" unoptimized />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{design.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground truncate">{design.prompt}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">{design.style}</Badge>
                    <Badge variant="outline" className="text-xs border-neon-green/30 text-neon-green">{design.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden border-border/50 bg-card">
                <div className="relative aspect-square">
                  <Image src={product.mockupUrl} alt={product.title} fill className="object-cover" unoptimized />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{product.title}</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-bold">${product.price.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{product.salesCount} sold</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Card className="mt-8 border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creator.badges.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background p-3"
              >
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{badge.name}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
