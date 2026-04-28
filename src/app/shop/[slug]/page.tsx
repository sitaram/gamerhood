import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, Award } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ProductCard } from "@/components/storefront/product-card";
import { createClient } from "@/lib/supabase/server";
import { getProfileBySlug, getPublishedProductsByProfile } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CreatorStorefront({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: profile } = await getProfileBySlug(supabase, slug);
  if (!profile) notFound();

  const products = await getPublishedProductsByProfile(supabase, profile.id);

  const level: number = profile.level ?? 1;
  const xp: number = profile.xp ?? 0;
  const xpToNext = (level + 1) * 500;
  const xpProgress = Math.min(100, Math.round((xp / xpToNext) * 100));

  const avatarUrl =
    profile.avatar_url ||
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${profile.id}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border/50 bg-card p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary">
            <Image
              src={avatarUrl}
              alt={profile.display_name}
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold">{profile.display_name}</h1>
            {profile.bio && (
              <p className="mt-2 text-muted-foreground max-w-lg">{profile.bio}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 text-neon-orange fill-neon-orange" />
                <span className="font-semibold">Level {level}</span>
                <span className="text-muted-foreground">({xp} XP)</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm text-muted-foreground">{products.length} products</span>
            </div>

            <div className="mt-4 max-w-xs">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Level {level}</span>
                <span>Level {level + 1}</span>
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
