import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getProductsByProfile,
  listProductStorefrontIdsByProductIds,
  listStorefrontsByOwner,
  type ProductRow,
} from "@/lib/supabase/queries";
import { ListingsManager } from "@/components/dashboard/listings-manager";
import {
  toCreatorStorefrontNav,
  toManagedListings,
  toManagedStorefrontOptions,
} from "@/lib/dashboard/managed-listings";
import { DashboardSellerNav } from "@/components/dashboard/dashboard-seller-nav";

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
  const storefrontIdsByProductId = await listProductStorefrontIdsByProductIds(
    supabase,
    rows.map((r) => r.id),
  );
  const storefrontOptions = toManagedStorefrontOptions(storefronts);
  const storefrontNav = toCreatorStorefrontNav(storefronts);
  const listings = toManagedListings(rows, storefronts, storefrontIdsByProductId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Dashboard
      </Link>
      <div className="mt-4">
        <DashboardSellerNav storefronts={storefrontNav} />
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your listings</h1>
          <p className="mt-2 text-muted-foreground">
            Every product you&apos;ve published, across all your storefronts. Edit
            price, photos, tags, and placement — or show a listing on multiple
            shops.
          </p>
        </div>
        <Button
          render={<Link href="/create" />}
          className="shrink-0 gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add merch
        </Button>
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
