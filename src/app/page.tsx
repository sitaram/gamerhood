import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturedProducts } from "@/components/landing/featured-products";
import { CreatorSpotlight, type SpotlightCreator } from "@/components/landing/creator-spotlight";
import { CTA } from "@/components/landing/cta";
import { createClient } from "@/lib/supabase/server";
import { getPublishedProducts, getTrendingProfiles } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const [allProducts, profilesResult] = await Promise.all([
    getPublishedProducts(supabase, 8),
    getTrendingProfiles(supabase, 4),
  ]);

  const featured = allProducts.slice(0, 4);

  const creators: SpotlightCreator[] = (profilesResult.data ?? []).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    slug: p.slug,
    avatarUrl: p.avatar_url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${p.id}`,
    bio: p.bio ?? "",
    level: p.level ?? 1,
  }));

  return (
    <>
      <Hero />
      <FeaturedProducts products={featured} />
      <HowItWorks />
      <CreatorSpotlight creators={creators} />
      <CTA />
    </>
  );
}
