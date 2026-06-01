import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  listBrowseCategories,
  listStorefrontsByOwner,
} from "@/lib/supabase/queries";
import { toCreatorStorefrontNav } from "@/lib/dashboard/managed-listings";
import { BrowseCategoriesPanel } from "@/components/dashboard/browse-categories-panel";
import { DashboardSellerNav } from "@/components/dashboard/dashboard-seller-nav";

export const dynamic = "force-dynamic";

export default async function BrowseCategoriesDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, rows] = await Promise.all([
    getDefaultProfileForAuthUser(supabase, user.id),
    listBrowseCategories(supabase),
  ]);
  const storefrontNav = profile
    ? toCreatorStorefrontNav(
        await listStorefrontsByOwner(supabase, profile.id),
      )
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <div className="mt-4">
        <DashboardSellerNav storefronts={storefrontNav} />
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Browse SEO categories</h1>
      <p className="mt-2 text-muted-foreground">
        Define slugs that power <code className="rounded bg-muted px-1 py-0.5 text-xs">/category/product-type</code>{" "}
        pages with custom titles, descriptions, and search terms (for discovery — not HTML meta-keywords).
      </p>

      <div className="mt-10">
        <BrowseCategoriesPanel userId={user.id} initial={rows} />
      </div>
    </div>
  );
}
