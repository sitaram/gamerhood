import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  type ProfileRow,
} from "@/lib/supabase/queries";
import { StorefrontSettingsForm } from "@/components/dashboard/storefront-settings-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function StorefrontDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Your storefront</h1>
      <p className="mt-2 text-muted-foreground">
        Customize your public shop URL, homepage banner, and how you appear in
        search results. Per-listing edits (price, photo, tags, placement) live
        on the listings page.
      </p>

      <div className="mt-10">
        <StorefrontSettingsForm initial={profile as ProfileRow} shopPath={`/shop/${profile.slug}`} />
      </div>

      <Card className="mt-12 flex flex-col gap-3 border-border/60 bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-base font-semibold">Manage your listings</h3>
            <p className="text-sm text-muted-foreground">
              Edit prices, photos, tags, placement, and visibility for every
              product you&apos;ve published — across all your storefronts.
            </p>
          </div>
        </div>
        <Link href="/dashboard/listings">
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            Open listings
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </Card>
    </div>
  );
}
