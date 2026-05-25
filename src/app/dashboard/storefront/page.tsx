import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getProductsByProfile,
  type ProfileRow,
  type ProductRow,
} from "@/lib/supabase/queries";
import { StorefrontSettingsForm } from "@/components/dashboard/storefront-settings-form";
import { ListingSeoEditor } from "@/components/dashboard/listing-seo-editor";
import { ListingPlacementPanel } from "@/components/dashboard/listing-placement-panel";
import { ListingPriceEditor } from "@/components/dashboard/listing-price-editor";
import { parseStoredPlacement } from "@/lib/print/placement";
import { resolveCostBasis } from "@/lib/pricing/cost-basis";
import type { ProductType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StorefrontDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) redirect("/dashboard");

  const { data: products } = await getProductsByProfile(supabase, profile.id);
  const rows = (products ?? []) as ProductRow[];
  const listings = rows.map((p) => ({
    id: p.id,
    title: p.title,
    tags: (p.tags ?? []).join(", "),
    category: p.category ?? "",
    description: p.seo_description ?? p.description ?? "",
    mockupUrl: p.mockup_url ?? "",
    printfulCatalogVariantId: p.printful_catalog_variant_id,
  }));

  const placementListings = rows.map((p) => ({
    id: p.id,
    title: p.title,
    productType: p.product_type as ProductType,
    designImageUrl: p.designs?.image_url ?? null,
    mockupUrl: p.mockup_url ?? null,
    printPlacement: parseStoredPlacement(p.print_placement),
  }));

  const priceListings = rows.map((p) => {
    const basis = resolveCostBasis({
      productType: p.product_type,
      wholesalePriceCents: p.wholesale_price_cents,
      shippingEstimateCents: p.shipping_estimate_cents,
    });
    return {
      id: p.id,
      title: p.title,
      productType: p.product_type,
      priceCents: p.base_price_cents + p.markup_cents,
      wholesaleCents: basis.wholesaleCents,
      shippingCents: basis.shippingCents,
      costBasisSource: basis.source,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Your storefront</h1>
      <p className="mt-2 text-muted-foreground">
        Customize your public shop URL, homepage banner, listing photos, and how you appear in search results.
      </p>

      <div className="mt-10">
        <StorefrontSettingsForm initial={profile as ProfileRow} shopPath={`/shop/${profile.slug}`} />
      </div>

      <div className="mt-12 border-t border-border/50 pt-10">
        <h2 className="text-xl font-semibold">Pricing</h2>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Set the price for each listing. We&apos;ll show you exactly how much you take
          home per sale after item cost, shipping, the platform fee, and credit-card
          processing.
        </p>
        <ListingPriceEditor listings={priceListings} />
      </div>

      <div className="mt-12 border-t border-border/50 pt-10">
        <h2 className="text-xl font-semibold">Print placement per product</h2>
        <p className="mt-1 text-sm text-muted-foreground mb-6">
          Preview how your artwork sits on each merch silhouette. Saved placement is used for fulfillment and shop
          thumbnails when no custom listing photo is set.
        </p>
        <ListingPlacementPanel listings={placementListings} />
      </div>

      <div className="mt-12 border-t border-border/50 pt-10">
        <h2 className="text-xl font-semibold">Listing tags, photos & categories</h2>
        <p className="mt-1 text-sm text-muted-foreground mb-6">
          Upload a storefront image per product (optional — otherwise we show the artwork from when you published).
          You can also tune tags when you first publish from Create.
        </p>
        <ListingSeoEditor listings={listings} />
      </div>
    </div>
  );
}
