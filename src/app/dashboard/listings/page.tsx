import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getProductsByProfile,
  listStorefrontsByOwner,
  type ProductRow,
} from "@/lib/supabase/queries";
import { ListingsManager, type ManagedListingRow, type ManagedStorefrontOption } from "@/components/dashboard/listings-manager";
import { parseStoredPlacement } from "@/lib/print/placement";
import type { ProductType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) redirect("/dashboard");

  const [productsRes, storefronts] = await Promise.all([
    getProductsByProfile(supabase, profile.id),
    listStorefrontsByOwner(supabase, profile.id),
  ]);

  const rows = (productsRes.data ?? []) as ProductRow[];
  const defaultStorefront =
    storefronts.find((s) => s.is_default) ?? storefronts[0] ?? null;

  const storefrontOptions: ManagedStorefrontOption[] = storefronts.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.display_name,
    isDefault: s.is_default,
  }));

  const listings: ManagedListingRow[] = rows.map((p) => {
    // Legacy products (pre multi-storefront) have a null storefront_id.
    // Treat them as living on the owner's default storefront so the badge
    // and filter still resolve to a meaningful shop.
    const resolvedStorefrontId = p.storefront_id ?? defaultStorefront?.id ?? null;
    const storefront = storefronts.find((s) => s.id === resolvedStorefrontId) ?? null;
    return {
      id: p.id,
      title: p.title,
      productType: p.product_type as ProductType,
      mockupUrl: p.mockup_url ?? null,
      designImageUrl: p.designs?.image_url ?? null,
      priceCents: p.base_price_cents + p.markup_cents,
      isPublished: p.is_published,
      salesCount: p.sales_count ?? 0,
      createdAt: p.created_at,
      storefrontId: resolvedStorefrontId,
      storefrontSlug: storefront?.slug ?? null,
      storefrontDisplayName: storefront?.display_name ?? null,
      printPlacement: parseStoredPlacement(p.print_placement),
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Dashboard
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your listings</h1>
          <p className="mt-2 text-muted-foreground">
            Every product you&apos;ve published, across all your storefronts. Edit
            price, photos, tags, and placement — or move a listing between
            shops.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <ListingsManager
          listings={listings}
          storefronts={storefrontOptions}
        />
      </div>
    </div>
  );
}
