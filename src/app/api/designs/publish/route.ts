import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  insertDesign,
  insertProduct,
  getDefaultProfileForAuthUser,
  getStorefrontById,
  listStorefrontsByOwner,
} from "@/lib/supabase/queries";
import { getCatalogConfig, printfulCatalogVariantEnvName } from "@/lib/printful/catalog";
import { isPrintfulConfigured } from "@/lib/printful/client";
import { generateListingMockupUrl } from "@/lib/printful/mockups";
import { augmentMerchFromPrintfulCatalog } from "@/lib/printful/catalog-meta";
import {
  getOrGenerateBlankForVariantId,
  listColorVariantsForCatalogProduct,
} from "@/lib/printful/blank-mockup";
import {
  apparelSizes,
  storefrontColors,
  publishTypeTitle,
  MERCH_SIZED_TYPES,
} from "@/lib/merch/product-options";
import { getDefaultProductCostBasis } from "@/lib/pricing/product-costs";
import {
  bytesToBase64DataUrl,
  capRasterIfHuge,
  isSvgMime,
  rasterizeSvgForPrinting,
} from "@/lib/print/normalize-upload";
import { uploadDesignImage, decodeDesignDataUrl } from "@/lib/storage";
import { moderateImageBase64 } from "@/lib/moderation";
import { parseTagsInput, normalizeProductCategoryInput } from "@/lib/slug-utils";
import { awardXp, pickXpToastPayload, type XpAwardResult } from "@/lib/xp/award";
import {
  PRODUCT_DESCRIPTION_MIN_CHARS,
  PRODUCT_TAGS_MIN_COUNT,
} from "@/lib/xp/rules";
import {
  DEFAULT_STORED,
  parseStoredPlacement,
  placementForProductType,
  type StoredPrintPlacement,
} from "@/lib/print/placement";
import type { ProductType, PrintfulCatalogMeta } from "@/lib/types";

function parsePlacementOverrides(
  raw: unknown,
): Partial<Record<ProductType, StoredPrintPlacement>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Partial<Record<ProductType, StoredPrintPlacement>> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseStoredPlacement(val);
    if (parsed) out[key as ProductType] = parsed;
  }
  return Object.keys(out).length ? out : undefined;
}

// Per-merch-type list price in USD cents. These are wholesale-ish numbers that
// the platform charges to the buyer; markup is set to 30% on top, returned to
// the creator after Stripe + platform fees. Tune once we have real Printful
// cost data per SKU.
const BASE_PRICES_CENTS: Record<string, number> = {
  hoodie: 4200,
  "kids-hoodie": 3800,
  "kids-heavyweight-tee": 2600,
  "kids-long-sleeve": 2400,
  "kids-sports-tee": 2000,
  "kids-tshirt": 2200,
  tshirt: 2600,
  poster: 1500,
  mug: 1800,
  sticker: 600,
  pillow: 2400,
  blanket: 3900,
  "pet-sweater": 2900,
  backpack: 3700,
  "tote-bag": 1600,
  "phone-case": 2200,
  joggers: 4400,
  ornament: 450,
  puzzle: 1200,
  "embroidered-patch": 750,
  "hardcover-journal": 750,
};

function mockupThrottle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

export async function POST(request: NextRequest) {
  let body: {
    imageUrl: string;
    // "ai"     → from /api/designs/generate, already moderated
    // "upload" → user-supplied file, must be moderated here before publish
    imageSource?: "ai" | "upload";
    prompt: string | null;
    style: string;
    productTypes: ProductType[];
    title?: string;
    designId?: string;
    /** Optional shopper-facing copy; also used for SEO on product pages when set. */
    listingDescription?: string | null;
    /** Comma / hashtag separated tags, e.g. "gaming, anime" */
    productTags?: string | null;
    /** Single category slug, e.g. "streetwear" */
    productCategory?: string | null;
    /** Print area framing (zoom/pan) — batch default for every item unless overridden. */
    printPlacement?: unknown;
    /** Per–product-type overrides; merged with `printPlacement` when inserting rows. */
    printPlacementsByType?: Record<string, unknown>;
    /**
     * Which storefront to publish to. Optional — when omitted (or null)
     * we resolve to the user's default storefront. Single-storefront
     * users never see the picker, so this comes through unset for them.
     */
    storefrontId?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.imageUrl || typeof body.imageUrl !== "string") {
    return NextResponse.json({ error: "Missing imageUrl" }, { status: 400 });
  }

  // blob: URLs only resolve in the originating browser tab. We catch them
  // explicitly because Printful (which fetches the image server-side at
  // order time) would otherwise see a generic "fetch failed" once the
  // buyer pays — way too late for a useful error message.
  if (body.imageUrl.startsWith("blob:")) {
    return NextResponse.json(
      { error: "Image upload didn't complete — please pick the file again." },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "No creator profile found" }, { status: 400 });
    }
    const profileId = profile.id;

    // ── Resolve which storefront these listings attach to ──────────────
    // The picker on `/create` only renders when there's more than one
    // storefront; otherwise the client omits `storefrontId` and we fall
    // back to the user's default. We re-verify ownership here so a
    // hand-crafted POST can't publish into someone else's shop.
    let storefrontId: string | null = null;
    if (typeof body.storefrontId === "string" && body.storefrontId.length > 0) {
      const requested = await getStorefrontById(supabase, body.storefrontId);
      if (!requested || requested.owner_profile_id !== profileId) {
        return NextResponse.json(
          { error: "That storefront isn't yours to publish to." },
          { status: 403 },
        );
      }
      storefrontId = requested.id;
    } else {
      const owned = await listStorefrontsByOwner(supabase, profileId);
      const def = owned.find((s) => s.is_default) ?? owned[0] ?? null;
      storefrontId = def?.id ?? null;
    }

    // ── Canonical image bytes for uploads: decode ALL data URLs (including
    // UTF-8 SVG from `FileReader`), rasterize SVG → high‑res PNG so Printful's
    // fetcher always gets a crispy raster + transparent background when the
    // vector has alpha, Vision moderates raster pixels instead of bogus XML,
    // and oversized PNG/JPEG gets capped (never upscaled).
    let imageForPersist = body.imageUrl;

    if (body.imageSource === "upload") {
      if (!body.imageUrl.startsWith("data:")) {
        return NextResponse.json(
          { error: "Upload must be provided as inline image data." },
          { status: 400 },
        );
      }
      const decoded = decodeDesignDataUrl(body.imageUrl);
      if (!decoded) {
        return NextResponse.json(
          {
            error:
              "Couldn't read your image encoding. Try exporting SVG as PNG, or upload PNG/JPG.",
          },
          { status: 400 },
        );
      }

      let uploadBytes = decoded.bytes;
      let uploadMime = decoded.mimeType.split(";")[0].trim().toLowerCase();

      const allowedUpload = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;
      if (!allowedUpload.test(uploadMime)) {
        return NextResponse.json(
          {
            error: "Unsupported file type — use PNG, JPG, WebP, GIF, or SVG.",
          },
          { status: 400 },
        );
      }

      try {
        if (isSvgMime(uploadMime)) {
          uploadBytes = await rasterizeSvgForPrinting(uploadBytes);
          uploadMime = "image/png";
        } else {
          const capped = await capRasterIfHuge(uploadBytes, uploadMime);
          uploadBytes = capped.buffer;
          uploadMime = capped.mimeOut;
        }
      } catch (err) {
        const tag = err instanceof Error ? err.message : "";
        console.error("[Publish] Upload normalization failed:", err);
        const msg =
          tag === "INVALID_SVG"
            ? "Couldn't process this SVG — check that it's valid, or export as PNG."
            : "Couldn't process uploaded image.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      imageForPersist = bytesToBase64DataUrl(uploadBytes, uploadMime);

      const moderation = await moderateImageBase64(imageForPersist);
      if (!moderation.safe) {
        return NextResponse.json(
          {
            error:
              "That image didn't pass our content check. Please try a different one.",
            flags: moderation.flags,
          },
          { status: 400 },
        );
      }
    }

    const designTitle = body.title || body.prompt?.slice(0, 50) || "My Design";

    // ── Persist the design row first so we get a stable id to use as the
    // storage object key. We start with the original (data) URL and update
    // to the public URL after upload — the row is private to the creator
    // until they publish a product against it, so the brief data-URL state
    // isn't user-visible.
    let resolvedDesignId = body.designId;
    if (!resolvedDesignId) {
      const { data: design, error: designErr } = await insertDesign(supabase, {
        profile_id: profileId,
        title: designTitle,
        image_url: imageForPersist,
        prompt: body.prompt,
        style: body.style,
        // Generation route already moderated; uploads were moderated above.
        status: "approved",
        content_safe: true,
      });

      if (designErr || !design) {
        console.error("[Publish] Design insert error:", designErr);
        return NextResponse.json({ error: "Failed to save design" }, { status: 500 });
      }
      resolvedDesignId = design.id;
    }
    if (!resolvedDesignId) {
      return NextResponse.json({ error: "Failed to resolve design" }, { status: 500 });
    }
    const designId = resolvedDesignId;

    // ── Upload to Supabase Storage. Printful needs a publicly-fetchable
    // URL; we also use this as the design's canonical `image_url` going
    // forward so the storefront stops serving multi-MB data URLs.
    let publicImageUrl: string;
    try {
      publicImageUrl = await uploadDesignImage(designId, imageForPersist);
    } catch (err) {
      console.error("[Publish] Storage upload failed:", err);
      return NextResponse.json(
        { error: "Couldn't store your design — please try again." },
        { status: 500 },
      );
    }

    // Replace the data URL with the public URL on the design row so future
    // reads (dashboard, gallery, etc.) get the small URL, not the giant
    // base64 blob. Best-effort — if the update fails the design is still
    // valid, just slower to render.
    if (publicImageUrl !== imageForPersist) {
      await supabase
        .from("designs")
        .update({ image_url: publicImageUrl })
        .eq("id", designId)
        .then(({ error }) => {
          if (error) console.warn("[Publish] image_url rewrite failed:", error);
        });
    }

    const listingDesc =
      typeof body.listingDescription === "string" && body.listingDescription.trim()
        ? body.listingDescription.trim().slice(0, 4000)
        : null;
    const productTags = parseTagsInput(
      typeof body.productTags === "string" ? body.productTags : "",
    );
    const productCategory = normalizeProductCategoryInput(body.productCategory);

    const masterPlacementRaw =
      body.printPlacement != null && typeof body.printPlacement === "object"
        ? parseStoredPlacement(body.printPlacement)
        : null;
    const masterPlacement = masterPlacementRaw ?? DEFAULT_STORED;
    const placementOverrides = parsePlacementOverrides(body.printPlacementsByType);

    const products: {
      type: string;
      id: string;
      printfulCatalogVariantId: number | null;
    }[] = [];

    /**
     * Catalog product ids of the SKUs we just published. Used by the
     * post-response `after()` block to warm per-color blank photos for
     * every color variant — so the buyer's color picker shows real
     * photographic blanks instead of the abstract silhouette fallback.
     * Deduped by catalog_product_id so two products with the same blueprint
     * (e.g. two hoodies) only trigger one Printful warm round.
     */
    const warmTargets = new Map<number, ProductType>();

    const publishFailures: { productType: string; message: string }[] = [];

    for (const productType of body.productTypes) {
      const basePrice = BASE_PRICES_CENTS[productType] ?? 2000;
      const markup = Math.round(basePrice * 0.3);
      const sellingPrice = basePrice + markup;

      // Resolve the Printful catalog SKU for this product type. With Printful
      // we don't pre-create products — the variant id alone is enough at
      // order time. If env config is missing we still write the product row
      // so the storefront works; checkout will skip fulfillment for items
      // without a variant id and we log a warning at order time.
      const catalog = getCatalogConfig(productType);
      if (!catalog) {
        console.warn(
          `[Publish] No ${printfulCatalogVariantEnvName(productType)} set — ` +
            `${productType} product will be storefront-only (no fulfillment).`,
        );
      }

      const shortDescription = listingDesc ?? body.prompt ?? designTitle;

      let sizesForRow = MERCH_SIZED_TYPES.has(productType) ? apparelSizes(productType) : null;
      let colorsForRow = storefrontColors(productType);
      let printfulCatalogProductId: number | null = null;
      let printfulCatalogMetaRow: PrintfulCatalogMeta | null = null;

      if (catalog?.catalogVariantId && isPrintfulConfigured()) {
        const aug = await augmentMerchFromPrintfulCatalog(catalog.catalogVariantId, productType);
        if (aug?.meta) {
          printfulCatalogProductId = aug.catalogProductId;
          printfulCatalogMetaRow = aug.meta;
          if (aug.sizes?.length) sizesForRow = aug.sizes;
          if (aug.colors?.length) colorsForRow = aug.colors;
        }
      }

      const storedPlacementForRow = placementForProductType(
        masterPlacement,
        placementOverrides,
        productType,
      );

      let listingMockupUrl = publicImageUrl;
      // Printful fetches the design by URL, so we can only call mockup generation
      // when `publicImageUrl` is a real http(s) URL — not when we fell back to an
      // inline data URL because Storage wasn't configured.
      const designUrlIsFetchable =
        publicImageUrl.startsWith("http://") || publicImageUrl.startsWith("https://");
      if (
        isPrintfulConfigured() &&
        catalog?.catalogVariantId &&
        printfulCatalogProductId &&
        catalog &&
        designUrlIsFetchable
      ) {
        const pfListing = await generateListingMockupUrl({
          catalogProductId: printfulCatalogProductId,
          catalogVariantId: catalog.catalogVariantId,
          productType,
          catalog,
          designUrl: publicImageUrl,
          storedPlacement: storedPlacementForRow,
        });
        if (pfListing) listingMockupUrl = pfListing;
        await mockupThrottle();
      }

      // Snapshot a cost basis so the post-publish price editor can show a stable
      // floor + take-home math without an extra Printful round-trip per edit.
      // Defaults come from product-costs.ts (per-product-type US-domestic
      // conservative estimates); creators can re-sync from Printful later.
      const costBasis = getDefaultProductCostBasis(productType);

      const { data: product, error: productErr } = await insertProduct(supabase, {
        design_id: designId,
        profile_id: profileId,
        storefront_id: storefrontId,
        title: `${designTitle} ${publishTypeTitle(productType)}`,
        description: shortDescription,
        product_type: productType,
        base_price_cents: basePrice,
        markup_cents: markup,
        mockup_url: listingMockupUrl,
        colors: colorsForRow,
        sizes: sizesForRow,
        is_published: true,
        printful_catalog_variant_id: catalog?.catalogVariantId ?? null,
        printful_catalog_product_id: printfulCatalogProductId,
        printful_catalog_meta: printfulCatalogMetaRow,
        tags: productTags.length > 0 ? productTags : null,
        category: productCategory,
        seo_description: listingDesc,
        print_placement: storedPlacementForRow,
        wholesale_price_cents: costBasis.wholesaleCents,
        shipping_estimate_cents: costBasis.shippingCents,
      });

      if (productErr || !product) {
        console.error(`[Publish] Product insert error for ${productType}:`, productErr);
        publishFailures.push({
          productType,
          message: productErr?.message ?? "could not insert product row",
        });
        continue;
      }

      // sellingPrice is intentionally unused here — it's the public-facing
      // price set by `base_price_cents + markup_cents`. Kept as a local for
      // readability of the markup math; pricing decisions happen once,
      // here, for both the DB and the future Printful order.
      void sellingPrice;

      products.push({
        type: productType,
        id: product.id,
        printfulCatalogVariantId: catalog?.catalogVariantId ?? null,
      });
      if (printfulCatalogProductId) {
        warmTargets.set(printfulCatalogProductId, productType);
      }
    }

    // ── XP awards ────────────────────────────────────────────────
    // Done after the publish loop so we only award for rows that
    // actually landed. Repeatable rules dedupe per product id, so
    // re-running publish on the same product is a no-op.
    // FIRST_PRODUCT_PUBLISHED also fires here when this is the very
    // first product on the profile — gated by counting existing
    // published rows BEFORE this batch.
    const xpResults: XpAwardResult[] = [];
    if (products.length > 0) {
      let preBatchPublishedCount: number | null = null;
      try {
        const { count } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("profile_id", profileId)
          .eq("is_published", true);
        // The newly-inserted rows are already in the table, so subtract
        // this batch to know the count BEFORE we published.
        preBatchPublishedCount = Math.max(0, (count ?? 0) - products.length);
      } catch (e) {
        console.warn("[Publish] product count for FIRST_PRODUCT_PUBLISHED failed:", e);
      }

      if (preBatchPublishedCount === 0) {
        xpResults.push(
          await awardXp({
            profileId,
            ruleKey: "FIRST_PRODUCT_PUBLISHED",
            metadata: { product_ids: products.map((p) => p.id) },
          }),
        );
      }

      const descLongEnough =
        (listingDesc?.length ?? 0) >= PRODUCT_DESCRIPTION_MIN_CHARS;
      const hasEnoughTags = productTags.length >= PRODUCT_TAGS_MIN_COUNT;

      for (const p of products) {
        xpResults.push(
          await awardXp({
            profileId,
            ruleKey: "PRODUCT_PUBLISHED",
            dedupeSuffix: `product:${p.id}`,
            metadata: { product_id: p.id, product_type: p.type },
          }),
        );
        if (descLongEnough) {
          xpResults.push(
            await awardXp({
              profileId,
              ruleKey: "PRODUCT_DESCRIPTION",
              dedupeSuffix: `product_desc:${p.id}`,
              metadata: { product_id: p.id },
            }),
          );
        }
        if (hasEnoughTags) {
          xpResults.push(
            await awardXp({
              profileId,
              ruleKey: "PRODUCT_TAGS",
              dedupeSuffix: `product_tags:${p.id}`,
              metadata: { product_id: p.id, tag_count: productTags.length },
            }),
          );
        }
      }
    }

    /**
     * Fire-and-forget per-color blank warmer. By the time the buyer reaches
     * the product page (~seconds after publish), every color swatch has a
     * real photographic blank in the cache so `ProductMockupImage` can
     * render the photo instead of the abstract silhouette. We never await
     * this — `after()` runs after the response is flushed; failures are
     * logged but never bubble up to the publish call.
     */
    if (isPrintfulConfigured() && warmTargets.size > 0) {
      after(async () => {
        for (const [catalogProductId, productType] of warmTargets) {
          try {
            const variants = await listColorVariantsForCatalogProduct(catalogProductId);
            console.log("[Publish.warm] starting", {
              productType,
              catalogProductId,
              variantCount: variants.length,
            });
            for (const v of variants) {
              try {
                await getOrGenerateBlankForVariantId(v.variantId, productType, {
                  colorName: v.colorName,
                  colorHex: v.colorHex,
                });
              } catch (e) {
                console.warn("[Publish.warm] variant failed", {
                  productType,
                  variantId: v.variantId,
                  color: v.colorName,
                  error: e instanceof Error ? e.message : String(e),
                });
              }
            }
            console.log("[Publish.warm] finished", { productType, catalogProductId });
          } catch (err) {
            console.warn("[Publish.warm] product type failed", {
              productType,
              catalogProductId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      });
    }

    return NextResponse.json({
      designId,
      products,
      count: products.length,
      ...(publishFailures.length ? { failures: publishFailures } : {}),
      xpAwards: pickXpToastPayload(xpResults),
    });
  } catch (err) {
    console.error("[Publish] Error:", err);
    return NextResponse.json(
      { error: "Failed to publish products" },
      { status: 500 },
    );
  }
}
