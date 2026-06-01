import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Wand2, ImageOff, Store, ExternalLink, LayoutGrid, Plus, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getDesignsByProfile,
  getProductsByProfile,
  listStorefrontsByOwner,
  type ProductRow,
} from "@/lib/supabase/queries";
import { StripeConnectCard } from "@/components/dashboard/stripe-connect-card";
import { DashboardDesignsGrid } from "@/components/dashboard/dashboard-designs-grid";
import { DashboardSellerNav } from "@/components/dashboard/dashboard-seller-nav";
import { ListingsManager } from "@/components/dashboard/listings-manager";
import {
  toManagedListings,
  toManagedStorefrontOptions,
} from "@/lib/dashboard/managed-listings";
import { XpRewardsPanel } from "@/components/dashboard/xp-rewards-panel";
import { TierBadge } from "@/components/xp/tier-badge";
import { DashboardQrCard } from "@/components/qr/dashboard-qr-card";
import { toDashboardDesignCard } from "@/lib/design-image-url";
import { getDisplayAvatar, profileInitials } from "@/lib/profile-avatar";
import { siteUrl } from "@/lib/site";
import { getEarnedOneShotRuleKeys } from "@/lib/xp/award";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Creator";

  const catchphrase = profile?.catchphrase?.trim() || null;
  const avatarUrl = getDisplayAvatar({
    id: profile?.id ?? user.id,
    avatar_url: profile?.avatar_url ?? null,
  });
  const initials = profileInitials(displayName);

  const [{ data: designs }, productsRes, storefronts] = profile
    ? await Promise.all([
        getDesignsByProfile(supabase, profile.id),
        getProductsByProfile(supabase, profile.id),
        listStorefrontsByOwner(supabase, profile.id),
      ])
    : [{ data: [] }, { data: null }, []];

  const designList = (designs ?? []).map(toDashboardDesignCard);

  const listingRows = profile
    ? toManagedListings((productsRes.data ?? []) as ProductRow[], storefronts)
    : [];
  const storefrontOptions = profile
    ? toManagedStorefrontOptions(storefronts)
    : [];

  const xp = profile?.xp ?? 0;
  const earnedXpRuleKeys = profile?.id
    ? await getEarnedOneShotRuleKeys(profile.id)
    : new Set<never>();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-28 w-28 shrink-0 ring-2 ring-primary/30 shadow-xl shadow-primary/20 sm:h-32 sm:w-32">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/20 text-3xl font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {displayName}
            </h1>
            {catchphrase && (
              <p className="mt-1 text-sm font-medium text-primary">{catchphrase}</p>
            )}
            {profile && (
              <div className="mt-2">
                <TierBadge xp={xp} size="md" showXp />
              </div>
            )}
          </div>
        </div>
        <Link href="/create">
          <Button size="lg" className="gap-2 bg-primary px-8 text-base hover:bg-primary/90">
            <Sparkles className="h-5 w-5" />
            Start Creating
          </Button>
        </Link>
      </div>

      {profile && (
        <div className="mt-8">
          <DashboardSellerNav />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {profile && (
          <>
            <Link href={`/shop/${profile.slug}`}>
              <Button variant="outline" className="gap-2" size="lg">
                <ExternalLink className="h-4 w-4" />
                View my shop
              </Button>
            </Link>
            <Link href="/dashboard/designs">
              <Button variant="secondary" className="gap-2" size="lg">
                <Images className="h-4 w-4" />
                My Images &amp; Uploads
              </Button>
            </Link>
            <Link href="/dashboard/listings">
              <Button variant="secondary" className="gap-2" size="lg">
                <LayoutGrid className="h-4 w-4" />
                Manage listings
              </Button>
            </Link>
            <Link href="/dashboard/storefront">
              <Button variant="outline" className="gap-2" size="lg">
                <Store className="h-4 w-4" />
                Storefront settings
              </Button>
            </Link>
            <Link href="/dashboard/categories">
              <Button variant="outline" className="gap-2" size="lg">
                SEO categories
              </Button>
            </Link>
          </>
        )}
      </div>

      <div className="mt-8">
        <StripeConnectCard siteOrigin={siteUrl()} />
      </div>

      <div className="mt-8">
        {profile?.slug ? (
          <DashboardQrCard
            url={`${siteUrl()}/shop/${profile.slug}`}
            slug={profile.slug}
          />
        ) : (
          <Card className="border-dashed border-border/50 bg-card/50 p-6">
            <h3 className="text-base font-semibold">Your shop QR code</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up your storefront to get your QR code. Once your shop URL
              is live you can download a printable PNG for stickers and
              posters.
            </p>
            <Link
              href="/dashboard/storefront"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Set up storefront →
            </Link>
          </Card>
        )}
      </div>

      {profile && (
        <div className="mt-8">
          <XpRewardsPanel xp={xp} earnedKeys={earnedXpRuleKeys} />
        </div>
      )}

      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">
              Your Designs
              {designList.length > 0 && (
                <span className="ml-3 text-sm font-normal text-muted-foreground">
                  {designList.length}
                </span>
              )}
            </h2>
            <Link
              href="/dashboard/designs"
              className="text-sm font-medium text-primary hover:underline"
            >
              My Images &amp; Uploads
            </Link>
          </div>
          <Link href="/create">
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <Wand2 className="h-4 w-4" />
              Create new image
            </Button>
          </Link>
        </div>

        {designList.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed border-border/50 bg-card/50 p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ImageOff className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">No designs yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Your creations will show up here. Start with a prompt and let the AI bring your idea to life.
            </p>
            <Link href="/create" className="mt-6">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Wand2 className="h-4 w-4" />
                Create your first design
              </Button>
            </Link>
          </Card>
        ) : (
          <DashboardDesignsGrid designs={designList} />
        )}
      </div>

      {profile && (
        <div className="mt-12">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">
              Your Listings
              {listingRows.length > 0 && (
                <span className="ml-3 text-sm font-normal text-muted-foreground">
                  {listingRows.length}
                </span>
              )}
            </h2>
            <div className="flex shrink-0 items-center gap-3">
              <Link href="/create">
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  Add an item
                </Button>
              </Link>
              <Link
                href="/dashboard/listings"
                className="text-sm font-medium text-primary hover:underline"
              >
                Manage all
              </Link>
            </div>
          </div>

          <ListingsManager
            listings={listingRows}
            storefronts={storefrontOptions}
          />
        </div>
      )}
    </div>
  );
}
