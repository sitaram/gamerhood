import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getProductsByProfile,
  listStorefrontsByOwner,
  type ProductRow,
} from "@/lib/supabase/queries";
import { ListingsManager } from "@/components/dashboard/listings-manager";
import {
  toManagedListings,
  toManagedStorefrontOptions,
} from "@/lib/dashboard/managed-listings";

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
  const storefrontOptions = toManagedStorefrontOptions(storefronts);
  const listings = toManagedListings(rows, storefronts);

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
