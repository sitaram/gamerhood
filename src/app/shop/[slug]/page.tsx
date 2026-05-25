import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star, Award } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ProductCard } from "@/components/storefront/product-card";
import { CreatorStorefrontHero } from "@/components/storefront/creator-storefront-hero";
import { createClient } from "@/lib/supabase/server";
import { getProfileBySlug, getPublishedProductsByProfile } from "@/lib/supabase/queries";
import { siteUrl } from "@/lib/site";
import { getStorefrontAvatar, profileInitials } from "@/lib/profile-avatar";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

function normalizeBrowseToken(s: string): string {
  return s.trim().toLowerCase();
}

/** Category chips reuse the same buckets as the filter (saved category or any tag). */
function storefrontBrowseTokens(product: Product): string[] {
  const out: string[] = [];
  if (product.category?.trim()) out.push(normalizeBrowseToken(product.category));
  for (const t of product.tags ?? []) {
    const n = normalizeBrowseToken(String(t));
    if (n) out.push(n);
  }
  return out;
}

function productMatchesStorefrontBrowse(product: Product, categoryNorm: string): boolean {
  const cat = product.category?.trim() ? normalizeBrowseToken(product.category) : "";
  if (cat === categoryNorm) return true;
  return (product.tags ?? []).some((t) => normalizeBrowseToken(String(t)) === categoryNorm);
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: profile } = await getProfileBySlug(supabase, slug);
  if (!profile) {
    return { title: "Shop not found" };
  }

  const title =
    (profile as { store_seo_title?: string | null }).store_seo_title?.trim() ||
    `${profile.display_name}'s shop — Gamerhood`;
  const description =
    (profile as { store_seo_description?: string | null }).store_seo_description?.trim() ||
    profile.bio?.trim() ||
    `Custom merch and designs by ${profile.display_name} on Gamerhood.`;

  const tags = (profile as { store_tags?: string[] | null }).store_tags;
  const keywords = Array.isArray(tags) && tags.length ? tags.join(", ") : undefined;
  const canonical = `${siteUrl()}/shop/${slug}`;
  const hero = (profile as { storefront_hero_image_url?: string | null }).storefront_hero_image_url;
  const ogAvatar =
    (profile as { storefront_avatar_url?: string | null }).storefront_avatar_url ||
    profile.avatar_url;

  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: hero
        ? [{ url: hero }]
        : ogAvatar
          ? [{ url: ogAvatar }]
          : undefined,
    },
    twitter: {
      card: hero ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function CreatorStorefront({ params, searchParams }: Props) {
  const { slug } = await params;
  const { category: categoryFilter } = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await getProfileBySlug(supabase, slug);
  if (!profile) notFound();

  const allProducts = await getPublishedProductsByProfile(supabase, profile.id);
  const categoryNorm = categoryFilter?.trim().toLowerCase() ?? "";
  const products = categoryNorm
    ? allProducts.filter((p) => productMatchesStorefrontBrowse(p, categoryNorm))
    : allProducts;

  const level: number = profile.level ?? 1;
  const xp: number = profile.xp ?? 0;
  const xpToNext = (level + 1) * 500;
  const xpProgress = Math.min(100, Math.round((xp / xpToNext) * 100));

  const avatarUrl = getStorefrontAvatar({
    id: profile.id,
    avatar_url: profile.avatar_url,
    storefront_avatar_url: (profile as { storefront_avatar_url?: string | null })
      .storefront_avatar_url,
  });
  const avatarInitials = profileInitials(profile.display_name);
  const catchphrase = profile.catchphrase?.trim() || null;

  const hasHero = Boolean(
    (profile as { storefront_hero_image_url?: string | null }).storefront_hero_image_url,
  );
  const bannerUrl =
    (profile as { storefront_banner_url?: string | null }).storefront_banner_url || null;

  const categories = Array.from(new Set(allProducts.flatMap((p) => storefrontBrowseTokens(p)))).sort();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: profile.display_name,
    url: `${siteUrl()}/shop/${slug}`,
    description:
      (profile as { store_seo_description?: string | null }).store_seo_description?.trim() ||
      profile.bio?.trim() ||
      undefined,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CreatorStorefrontHero
        profile={
          profile as Parameters<typeof CreatorStorefrontHero>[0]["profile"]
        }
      />

      <div
        className={`relative overflow-hidden rounded-2xl border border-border/50 ${
          bannerUrl ? "p-0" : "bg-card p-8"
        }`}
      >
        {bannerUrl && (
          <>
            <Image
              src={bannerUrl}
              alt=""
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover"
              unoptimized
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20"
            />
          </>
        )}
        <div
          className={`relative flex flex-col items-center gap-6 sm:flex-row sm:items-start ${
            bannerUrl ? "p-8" : ""
          }`}
        >
          <div
            className={`relative flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-full text-4xl font-semibold sm:h-44 sm:w-44 ${
              bannerUrl
                ? "border-2 border-white/40 bg-white/10 text-white shadow-xl shadow-black/40 ring-2 ring-white/30 ring-offset-2 ring-offset-black/20"
                : "border-2 border-primary/30 bg-primary/10 text-primary shadow-xl shadow-primary/20 ring-2 ring-primary/30 ring-offset-2 ring-offset-card"
            }`}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.display_name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              avatarInitials
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            {!hasHero && (
              <h1
                className={`text-3xl font-bold ${
                  bannerUrl ? "text-white drop-shadow-md" : ""
                }`}
              >
                {profile.display_name}
              </h1>
            )}
            {hasHero && (
              <p
                className={`text-lg font-semibold ${
                  bannerUrl ? "text-white/90 drop-shadow" : "text-muted-foreground"
                }`}
              >
                {profile.display_name}
              </p>
            )}
            {catchphrase && (
              <p
                className={`mt-1 text-base font-medium ${
                  bannerUrl ? "text-white drop-shadow" : "text-primary"
                }`}
              >
                {catchphrase}
              </p>
            )}
            {profile.bio && !hasHero && (
              <p
                className={`mt-2 max-w-lg ${
                  bannerUrl ? "text-white/90 drop-shadow" : "text-muted-foreground"
                }`}
              >
                {profile.bio}
              </p>
            )}
            {profile.bio && hasHero && (
              <p
                className={`mt-1 max-w-lg text-sm ${
                  bannerUrl ? "text-white/90 drop-shadow" : "text-muted-foreground"
                }`}
              >
                {profile.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
              <div
                className={`flex items-center gap-1.5 text-sm ${
                  bannerUrl ? "text-white drop-shadow" : ""
                }`}
              >
                <Star className="h-4 w-4 text-neon-orange fill-neon-orange" />
                <span className="font-semibold">Level {level}</span>
                <span className={bannerUrl ? "text-white/80" : "text-muted-foreground"}>
                  ({xp} XP)
                </span>
              </div>
              <Separator
                orientation="vertical"
                className={`h-4 ${bannerUrl ? "bg-white/40" : ""}`}
              />
              <span
                className={`text-sm ${
                  bannerUrl ? "text-white/90 drop-shadow" : "text-muted-foreground"
                }`}
              >
                {products.length} products
              </span>
            </div>

            <div className="mt-4 max-w-xs">
              <div
                className={`mb-1 flex items-center justify-between text-xs ${
                  bannerUrl ? "text-white/80 drop-shadow" : "text-muted-foreground"
                }`}
              >
                <span>Level {level}</span>
                <span>Level {level + 1}</span>
              </div>
              <div
                className={`h-2 overflow-hidden rounded-full ${
                  bannerUrl ? "bg-white/20" : "bg-secondary"
                }`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Browse:</span>
          <Link
            href={`/shop/${slug}`}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              !categoryNorm
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/60 hover:border-primary/40"
            }`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/shop/${slug}?category=${encodeURIComponent(c)}`}
              className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                categoryNorm === c
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              {c.replace(/-/g, " ")}
            </Link>
          ))}
        </div>
      )}

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
            <p className="mt-4 text-lg font-semibold text-muted-foreground">No products in this view</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {categoryNorm ? "Try another category or view all products." : "This creator is just getting started!"}
            </p>
            {categoryNorm && (
              <Link href={`/shop/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
                View all products
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
