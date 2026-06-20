import Link from "next/link";
import { Images, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  listStorefrontsByOwner,
} from "@/lib/supabase/queries";
import { toCreatorStorefrontNav } from "@/lib/dashboard/managed-listings";
import { redirect } from "next/navigation";
import { DesignLibraryInfiniteGrid } from "@/components/designs/design-library-infinite-grid";
import { DashboardSellerNav } from "@/components/dashboard/dashboard-seller-nav";

export const dynamic = "force-dynamic";

export default async function MyDesignsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/dashboard/designs");

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  const storefrontNav = profile
    ? toCreatorStorefrontNav(
        await listStorefrontsByOwner(supabase, profile.id),
      )
    : [];

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
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Images className="h-5 w-5" />
            <span className="text-sm font-medium">Your library</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">My Images &amp; Uploads</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every AI-generated design and uploaded artwork you create is saved here automatically.
            Pick any image to put it on merch again or publish a new listing.
          </p>
        </div>
        <Button
          render={<Link href="/create" />}
          className="shrink-0 gap-2 bg-primary hover:bg-primary/90"
        >
          <Wand2 className="h-4 w-4" />
          Create new
        </Button>
      </div>

      <div className="mt-10">
        <DesignLibraryInfiniteGrid enabled mode="manage" />
      </div>
    </div>
  );
}
