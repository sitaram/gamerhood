import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, Award } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { getCreatorBySlug, getProductsByCreator } from "@/lib/mock-data";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CreatorStorefront({ params }: Props) {
  const { slug } = await params;
  const creator = getCreatorBySlug(slug);
  if (!creator) notFound();

  const products = getProductsByCreator(creator.id);

  const xpToNext = (creator.level + 1) * 500;
  const xpProgress = Math.round((creator.xp / xpToNext) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border/50 bg-card p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary">
            <Image
              src={creator.avatarUrl}
              alt={creator.displayName}
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold">{creator.displayName}</h1>
            <p className="mt-2 text-muted-foreground max-w-lg">{creator.bio}</p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 text-neon-orange fill-neon-orange" />
                <span className="font-semibold">Level {creator.level}</span>
                <span className="text-muted-foreground">({creator.xp} XP)</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm text-muted-foreground">{creator.totalDesigns} designs</span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm text-muted-foreground">{creator.totalSales} sales</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {creator.badges.map((badge) => (
                <Badge
                  key={badge.id}
                  variant="outline"
                  className="border-border/50 text-xs gap-1"
                  title={badge.description}
                >
                  <span>{badge.icon}</span>
                  {badge.name}
                </Badge>
              ))}
            </div>

            <div className="mt-4 max-w-xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Level {creator.level}</span>
                <span>Level {creator.level + 1}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Products</h2>
          <span className="text-sm text-muted-foreground">{products.length} items</span>
        </div>

        {products.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center py-16 rounded-xl border border-dashed border-border/50">
            <Award className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-semibold text-muted-foreground">No products yet</p>
            <p className="mt-1 text-sm text-muted-foreground">This creator is just getting started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
