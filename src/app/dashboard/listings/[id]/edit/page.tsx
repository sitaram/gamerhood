import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  listProductStorefrontIdsByProductIds,
  listStorefrontsByOwner,
  type ProductRow,
  type StorefrontRow,
} from "@/lib/supabase/queries";
import { ListingSeoEditor } from "@/components/dashboard/listing-seo-editor";
import { ListingPriceEditor } from "@/components/dashboard/listing-price-editor";
import { ListingPlacementPanel } from "@/components/dashboard/listing-placement-panel";
import { ListingStorefrontMover } from "@/components/dashboard/listing-storefront-mover";
import { ListingDangerZone } from "@/components/dashboard/listing-danger-zone";
import { DashboardSellerNav } from "@/components/dashboard/dashboard-seller-nav";
import { toCreatorStorefrontNav } from "@/lib/dashboard/managed-listings";
import {
  hasRenderableListingMockup,
  PRODUCT_TYPE_LABELS,
} from "@/components/storefront/product-card-utils";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import { TransparencyBadge } from "@/components/design/transparency-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { detectDesignTransparencyFromAnySource } from "@/lib/print/transparency";
import { getServiceClient } from "@/lib/supabase/admin";
import { resolveCostBasis, type ResolvedCostBasis } from "@/lib/pricing/cost-basis";
import {
  parseStoredPlacement,
  DEFAULT_STORED,
  type StoredPrintPlacement,
} from "@/lib/print/placement";
import type { ProductType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Wrap a sync helper that COULD throw on a malformed row (e.g. a corrupt
 * `print_placement` JSON blob, or `resolveCostBasis` choking on an unknown
 * product_type). We never want a single bad column to swap the whole page
 * out for the global "A server error occurred" boundary — log loudly and
 * fall back to a safe default so the rest of the editor still renders.
 */
function safeSync<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.error(`[edit-listing] ${label} threw:`, err);
    return fallback;
  }
}

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile, error: profileErr } = await getDefaultProfileForAuthUser(
    supabase,
    user.id,
  );
  if (profileErr) {
    console.error("[edit-listing] profile lookup failed", {
      authUserId: user.id,
      message: profileErr.message,
      code: (profileErr as { code?: string }).code,
    });
  }
  if (!profile) redirect("/dashboard");

  // Fetch the product joined with the source design so we can render the
  // placement preview when no Printful mockup landed. RLS plus the explicit
  // `profile_id` check below makes someone-else's-product → 404. We also
  // pull `has_transparency` here so the alpha-channel badge has data on the
  // initial render without a follow-up request.
  const { data, error: productErr } = await supabase
    .from("products")
    .select("*, designs ( id, image_url, has_transparency, uploaded_as_svg )")
    .eq("id", id)
    .maybeSingle();

  if (productErr) {
    console.error("[edit-listing] product fetch failed", {
      productId: id,
      profileId: profile.id,
      message: productErr.message,
      code: productErr.code,
    });
    notFound();
  }
  if (!data) notFound();
  const product = data as ProductRow;
  if (product.profile_id !== profile.id) notFound();

  // listStorefrontsByOwner already swallows query errors and returns [],
  // but if Supabase env is misconfigured the underlying client construction
  // could still throw. Defend anyway — a missing storefront list should
  // never be fatal to the editor.
  let storefronts: StorefrontRow[] = [];
  try {
    storefronts = await listStorefrontsByOwner(supabase, profile.id);
  } catch (err) {
    console.error("[edit-listing] listStorefrontsByOwner threw", {
      profileId: profile.id,
      err: err instanceof Error ? err.message : err,
    });
  }
  const defaultStorefront =
    storefronts.find((s) => s.is_default) ?? storefronts[0] ?? null;
  let linkedStorefrontIds: string[] = [];
  try {
    const storefrontIdsByProductId = await listProductStorefrontIdsByProductIds(
      supabase,
      [product.id],
    );
    linkedStorefrontIds = storefrontIdsByProductId.get(product.id) ?? [];
  } catch (err) {
    console.warn("[edit-listing] storefront link lookup failed", {
      productId: product.id,
      err: err instanceof Error ? err.message : err,
    });
    linkedStorefrontIds = [];
  }
  const fallbackStorefrontId = product.storefront_id ?? defaultStorefront?.id ?? null;
  const resolvedStorefrontIds = linkedStorefrontIds.length
    ? linkedStorefrontIds
    : fallbackStorefrontId
      ? [fallbackStorefrontId]
      : [];

  const productLabel =
    PRODUCT_TYPE_LABELS[product.product_type] || product.product_type;

  const placement: StoredPrintPlacement = safeSync(
    "parseStoredPlacement(header)",
    () => parseStoredPlacement(product.print_placement) ?? DEFAULT_STORED,
    DEFAULT_STORED,
  );
  const designImageUrl = product.designs?.image_url ?? null;
  const previewDesignUrl = product.design_id
    ? `/api/designs/${product.design_id}/image?v=${encodeURIComponent(product.created_at)}&pv=1`
    : designImageUrl;
  const showRealMockup = hasRenderableListingMockup(product.mockup_url, designImageUrl, {
    designUploadedAsSvg: Boolean(product.designs?.uploaded_as_svg),
  });

  /**
   * Alpha-channel badge data. We prefer the persisted column (set by the
   * publish/generate routes after migration 031), but fall back to a
   * one-shot sharp inspection of the design's public URL when the column
   * is null — legacy designs predate the column. The backfill is best-
   * effort and uses the service-role client so the WRITE bypasses the
   * read-only RLS policy when needed; rendering never blocks on it.
   */
  const uploadedAsSvg = Boolean(product.designs?.uploaded_as_svg);
  const persistedTransparency = product.designs?.has_transparency;
  let hasTransparency: boolean | null =
    typeof persistedTransparency === "boolean" ? persistedTransparency : null;
  const persistedDesignId = product.designs?.id ?? product.design_id ?? null;
  if (hasTransparency === null && designImageUrl) {
    const computed = await detectDesignTransparencyFromAnySource(designImageUrl);
    if (computed) {
      hasTransparency = computed.transparent;
      if (persistedDesignId) {
        try {
          const admin = getServiceClient();
          const { error: updErr } = await admin
            .from("designs")
            .update({ has_transparency: hasTransparency })
            .eq("id", persistedDesignId);
          if (updErr) {
            console.warn(
              "[edit-listing] has_transparency backfill failed:",
              updErr.message,
            );
          }
        } catch (err) {
          console.warn(
            "[edit-listing] service client unavailable for transparency backfill:",
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }

  const seoListings = [
    {
      id: product.id,
      title: product.title,
      tags: (product.tags ?? []).join(", "),
      category: product.category ?? "",
      description: product.seo_description ?? product.description ?? "",
      mockupUrl: product.mockup_url ?? "",
      printfulCatalogVariantId: product.printful_catalog_variant_id,
    },
  ];

  /**
   * `resolveCostBasis` ships safe defaults for every productType in the
   * union (and a generic FALLBACK), but legacy rows with an unrecognised
   * product_type would silently take the FALLBACK — log it once so we
   * notice if creators routinely land on the floor we picked.
   */
  const basis: ResolvedCostBasis = safeSync(
    "resolveCostBasis",
    () =>
      resolveCostBasis({
        productType: product.product_type,
        wholesalePriceCents: product.wholesale_price_cents,
        shippingEstimateCents: product.shipping_estimate_cents,
      }),
    { wholesaleCents: 1500, shippingCents: 499, source: "default" },
  );
  const priceListings = [
    {
      id: product.id,
      title: product.title,
      productType: product.product_type,
      priceCents:
        (Number.isFinite(product.base_price_cents) ? product.base_price_cents : 0) +
        (Number.isFinite(product.markup_cents) ? product.markup_cents : 0),
      wholesaleCents: basis.wholesaleCents,
      shippingCents: basis.shippingCents,
      costBasisSource: basis.source,
      mockupUrl: previewDesignUrl ? null : product.mockup_url ?? null,
      designImageUrl: previewDesignUrl,
      printPlacement: placement,
    },
  ];

  const placementListings = [
    {
      id: product.id,
      title: product.title,
      productType: product.product_type as ProductType,
      designImageUrl: previewDesignUrl,
      mockupUrl: previewDesignUrl ? null : product.mockup_url ?? null,
      printPlacement: safeSync(
        "parseStoredPlacement(panel)",
        () => parseStoredPlacement(product.print_placement),
        null,
      ),
    },
  ];

  const moverStorefronts = storefronts.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.display_name,
    isDefault: s.is_default,
  }));
  const storefrontNav = toCreatorStorefrontNav(storefronts);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/listings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to listings
      </Link>

      <div className="mt-4">
        <DashboardSellerNav storefronts={storefrontNav} />
      </div>

      <section className="mt-6">
        <ListingPriceEditor listings={priceListings} />
      </section>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/50 p-5 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary">
          {showRealMockup && product.mockup_url ? (
            <Image
              src={product.mockup_url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : previewDesignUrl ? (
            <MerchPlacementPreview
              imageUrl={previewDesignUrl}
              productType={product.product_type as ProductType}
              placement={placement}
              showPrintAreaFrame={false}
              transparentBlankBackdrop
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
              No preview
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {productLabel}
            </Badge>
            {product.is_published ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 text-[10px]">
                Published
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Hidden
              </Badge>
            )}
            {/**
             * Warn only for transparent SVG uploads — solid backgrounds and
             * AI PNGs stay silent.
             */}
            <TransparencyBadge
              hasTransparency={hasTransparency}
              uploadedAsSvg={uploadedAsSvg}
            />
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">
            {product.title}
          </h1>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Link
              href={`/product/${product.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              View public listing
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Tags, photo & description</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Tune how shoppers find and recognise this listing.
        </p>
        <ListingSeoEditor listings={seoListings} hideDestructiveActions />
      </section>

      <section className="mt-12 border-t border-border/50 pt-10">
        <h2 className="text-lg font-semibold">Print placement</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Adjust where the artwork sits on the product. Saved placement is used
          for fulfillment and the auto-generated listing thumbnail.
        </p>
        <ListingPlacementPanel
          listings={placementListings}
          hideDestructiveActions
        />
      </section>

      {storefronts.length > 0 && (
        <section className="mt-12 border-t border-border/50 pt-10">
          <h2 className="text-lg font-semibold">Storefronts</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Choose which shop URLs this listing appears on. Buyers only see it
            on the storefronts selected here.
          </p>
          <ListingStorefrontMover
            productId={product.id}
            storefronts={moverStorefronts}
            currentStorefrontIds={resolvedStorefrontIds}
          />
        </section>
      )}

      <section className="mt-12 border-t border-border/50 pt-10">
        <ListingDangerZone
          productId={product.id}
          productTitle={product.title}
          initialIsPublished={product.is_published}
        />
      </section>

      <div className="mt-10">
        <Button
          render={<Link href="/dashboard/listings" />}
          variant="ghost"
          size="sm"
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to listings
        </Button>
      </div>
    </div>
  );
}
