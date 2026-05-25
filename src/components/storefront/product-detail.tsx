"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Heart, ArrowLeft, Truck, Shield, RotateCcw, Check } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { PrintfulCatalogDetails } from "@/components/storefront/printful-catalog-details";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import { MerchGarmentSilhouette } from "@/components/create/merch-garment-silhouette";
import { ShareMenu } from "@/components/storefront/share-menu";
import { DEFAULT_STORED } from "@/lib/print/placement";
import { hasRenderableListingMockup } from "@/components/storefront/product-card";
import {
  resolveColorSwatch,
  isLightColor,
  type ColorSwatch,
} from "@/lib/printful/color-swatches";
import { getMerchPreviewLayout } from "@/lib/create/merch-preview-layout";
import { getPrintAreaInches } from "@/lib/printful/catalog";
import { normalizedPlacementToPrintful } from "@/lib/print/placement";

/** Lowercase + hyphenate + strip non-url-safe chars for QR PNG filenames. */
function slugifyForFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function ProductDetail({ product, shareUrl }: { product: Product; shareUrl: string }) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const hasClothing = !!product.sizes;
  /** First color = the variant the listing was published with → `mockupUrl` is in this color. */
  const defaultColor = product.colors[0];

  /** Snapshot from Printful catalog at publish time; preferred over the static fallback. */
  const swatches = useMemo(() => {
    const out: Record<string, ColorSwatch> = {};
    for (const name of product.colors) {
      out[name] = resolveColorSwatch(name, product.printfulCatalogMeta?.catalogColors ?? null);
    }
    return out;
  }, [product.colors, product.printfulCatalogMeta?.catalogColors]);

  const selectedSwatch = swatches[selectedColor] ?? { hex: null };
  const isDefaultColor = selectedColor === defaultColor;

  function handleAddToCart() {
    for (let i = 0; i < quantity; i++) {
      addItem(product, selectedColor, selectedSize || undefined);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleLike() {
    setLiked(!liked);
    toast(liked ? "Removed from favorites" : "Added to favorites");
  }

  const colorPickerVisible =
    product.colors.length > 1 && product.colors[0] !== "N/A";

  const creatorSlug = product.creator?.slug;
  const creatorName = product.creator?.displayName;
  const backHref = creatorSlug ? `/shop/${creatorSlug}` : "/shop";
  const backLabel = creatorName ? `Back to ${creatorName}'s shop` : "Back to shop";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href={backHref}>
        <Button variant="ghost" size="sm" className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/50 bg-card">
          <div className="relative aspect-square bg-muted">
            <ProductMockupImage
              product={product}
              isDefaultColor={isDefaultColor}
              swatch={selectedSwatch}
              selectedColor={selectedColor}
            />
          </div>
        </Card>

        <div className="space-y-6">
          <div>
            {product.creator && (
              <Link href={`/shop/${product.creator.slug}`}>
                <Badge variant="outline" className="mb-3 border-primary/30 text-primary hover:bg-primary/10">
                  by {product.creator.displayName}
                </Badge>
              </Link>
            )}
            <h1 className="text-3xl font-bold">{product.title}</h1>
            <p className="mt-2 text-muted-foreground">{product.description}</p>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold">${product.price.toFixed(2)}</span>
            {product.salesCount > 5 && (
              <span className="text-sm text-neon-green">{product.salesCount} sold</span>
            )}
          </div>

          <Separator className="bg-border/50" />

          {colorPickerVisible && (
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Color: <span className="text-muted-foreground font-normal">{selectedColor}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => {
                  const swatch = swatches[color] ?? { hex: null };
                  const active = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      aria-pressed={active}
                      aria-label={`Color: ${color}`}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <ColorSwatchDot swatch={swatch} selected={active} />
                      <span>{color}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasClothing && product.sizes && (
            <div>
              <label className="text-sm font-semibold mb-2 block">Size</label>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[48px] rounded-lg border px-3 py-2 text-sm transition-all ${
                      selectedSize === size
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold mb-2 block">Quantity</label>
            <Select value={String(quantity)} onValueChange={(v) => setQuantity(Number(v))}>
              <SelectTrigger className="w-24 bg-card border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              onClick={handleAddToCart}
              className={`flex-1 gap-2 transition-all ${added ? "bg-neon-green hover:bg-neon-green/90 text-black" : "bg-primary hover:bg-primary/90"}`}
            >
              {added ? (
                <>
                  <Check className="h-5 w-5" />
                  Added!
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  Add to Cart — ${(product.price * quantity).toFixed(2)}
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleLike}
              className={`border-border/50 ${liked ? "text-red-500 border-red-500/30" : ""}`}
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            </Button>
            <ShareMenu
              url={shareUrl}
              title={product.title}
              description={product.description}
              qrFilenameSlug={slugifyForFilename(product.title) || product.id}
            />
          </div>

          <Card className="border-border/50 bg-card/50 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Truck className="h-4 w-4 text-neon-cyan shrink-0" />
                <span className="text-muted-foreground">Free shipping on orders over $50</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-neon-green shrink-0" />
                <span className="text-muted-foreground">Premium quality print-on-demand</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <RotateCcw className="h-4 w-4 text-neon-orange shrink-0" />
                <span className="text-muted-foreground">30-day satisfaction guarantee</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {product.printfulCatalogMeta && (
        <PrintfulCatalogDetails meta={product.printfulCatalogMeta} />
      )}
    </div>
  );
}

/**
 * Circular color chip with optional heather split + light-color border +
 * tiny check overlay when selected. Background falls back to neutral grey
 * if no hex is known — never crashes.
 */
function ColorSwatchDot({
  swatch,
  selected,
}: {
  swatch: ColorSwatch;
  selected: boolean;
}) {
  const hex = swatch.hex;
  const hex2 = swatch.hex2;
  const needsBorder = !hex || isLightColor(hex);
  const background = hex2 && hex
    ? `linear-gradient(135deg, ${hex} 0%, ${hex} 50%, ${hex2} 50%, ${hex2} 100%)`
    : hex ?? "#9ca3af";

  return (
    <span
      aria-hidden
      className={`relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
        needsBorder ? "ring-1 ring-inset ring-black/15" : ""
      }`}
      style={{ background }}
    >
      {selected && (
        /** Lucide Check, sized + color-contrasted against the swatch fill. */
        <Check
          className="h-3 w-3"
          strokeWidth={3}
          style={{
            color: needsBorder ? "#111" : "#fff",
            filter: needsBorder ? undefined : "drop-shadow(0 0 1px rgba(0,0,0,0.4))",
          }}
        />
      )}
    </span>
  );
}

/**
 * Renders the listing image. Defaults to the published Printful mockup
 * (which is photographed in the originally-published color). When the
 * shopper picks a different color we composite the design over a
 * silhouette tinted with that color's hex — instant, no API call.
 */
function ProductMockupImage({
  product,
  isDefaultColor,
  swatch,
  selectedColor,
}: {
  product: Product;
  isDefaultColor: boolean;
  swatch: ColorSwatch;
  selectedColor: string;
}) {
  const canRenderMockup = hasRenderableListingMockup(
    product.mockupUrl,
    product.designImageUrl,
  );
  const hasDesign = !!product.designImageUrl?.trim();

  if (isDefaultColor && canRenderMockup) {
    return (
      <Image
        src={product.mockupUrl}
        alt={product.title}
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        unoptimized
      />
    );
  }

  /**
   * Non-default color: we don't have a per-color mockup in the DB cache
   * (the `printful_blank_mockups` table is keyed by product_type, and
   * generating a Berry/Aqua/Berry blank inline would block the page for
   * ~30 s). Show a colored silhouette + composite design so the shopper
   * still sees their color choice reflected on the garment shape.
   */
  if (hasDesign) {
    return (
      <ColoredGarmentMockup
        product={product}
        swatch={swatch}
        colorName={selectedColor}
      />
    );
  }

  /** Original fallback chain: design-only preview → empty state. */
  if (canRenderMockup) {
    return (
      <Image
        src={product.mockupUrl}
        alt={product.title}
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        unoptimized
      />
    );
  }

  if (product.designImageUrl?.trim()) {
    return (
      <MerchPlacementPreview
        imageUrl={product.designImageUrl}
        productType={product.productType}
        placement={product.printPlacement ?? DEFAULT_STORED}
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
      No preview image for this listing yet.
    </div>
  );
}

/**
 * Silhouette filled with the selected garment color, with the creator's
 * design composited on top at the saved print placement. Used as the v1
 * stand-in for a Printful-rendered per-color mockup, which we don't cache
 * per (product_type, color) today.
 */
function ColoredGarmentMockup({
  product,
  swatch,
  colorName,
}: {
  product: Product;
  swatch: ColorSwatch;
  colorName: string;
}) {
  const layout = getMerchPreviewLayout(product.productType);
  const area = getPrintAreaInches(product.productType);
  const Aw = area?.width ?? 12;
  const Ah = area?.height ?? 15;
  const pf = normalizedPlacementToPrintful({
    areaWidthIn: Aw,
    areaHeightIn: Ah,
    placement: product.printPlacement ?? DEFAULT_STORED,
  });

  const designImageUrl = product.designImageUrl ?? "";
  const hex = swatch.hex ?? "#9ca3af";
  const hex2 = swatch.hex2;
  /**
   * The silhouette uses `currentColor` with low fillOpacity — wrap in a
   * tinted layer so the garment reads as the selected color even on a
   * dark page background. For heathers we layer two filled silhouettes,
   * one nudged ~3px, to suggest the marled yarn without a custom SVG.
   */
  const garmentTint = hex;
  const lightSwatch = isLightColor(hex);

  const renderArtwork = (opacity: number) => (
    <div
      className="pointer-events-none absolute"
      style={{
        width: `${(pf.width / pf.area_width) * 100}%`,
        height: `${(pf.height / pf.area_height) * 100}%`,
        left: `${(pf.left / pf.area_width) * 100}%`,
        top: `${(pf.top / pf.area_height) * 100}%`,
        opacity,
      }}
    >
      <Image
        src={designImageUrl}
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-contain object-center"
        unoptimized
        draggable={false}
      />
    </div>
  );

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-secondary"
      role="img"
      aria-label={`${product.title} preview in ${colorName}`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative w-[94%] max-h-[94%]"
          style={{ aspectRatio: `${layout.garmentAspect}` }}
        >
          {/* Garment silhouette tinted to the selected color. */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{
              color: garmentTint,
              /** Outer glow bumps the perceived solidity on dark pages. */
              filter: lightSwatch
                ? "drop-shadow(0 1px 4px rgba(0,0,0,0.18))"
                : "drop-shadow(0 1px 6px rgba(0,0,0,0.3))",
            }}
          >
            <div className="relative h-full w-full">
              <MerchGarmentSilhouette
                type={product.productType}
                className="absolute inset-0 h-full w-full"
              />
              {/** Layered fill bumps perceived opacity on hoodies / tees whose silhouettes ship at 0.14–0.28 fill. */}
              <MerchGarmentSilhouette
                type={product.productType}
                className="absolute inset-0 h-full w-full"
              />
              {hex2 && (
                /** Tone shift hint for heathers — second yarn shown as a translucent layer. */
                <div
                  className="absolute inset-0"
                  style={{
                    color: hex2,
                    mixBlendMode: "multiply",
                    opacity: 0.55,
                  }}
                >
                  <MerchGarmentSilhouette
                    type={product.productType}
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Design composited at the saved print band. */}
          <div
            className={
              layout.printBandLeftPct != null && layout.printBandWidthPct != null
                ? "pointer-events-none absolute flex items-center justify-center"
                : "pointer-events-none absolute left-1 right-1 flex items-center justify-center sm:left-2 sm:right-2"
            }
            style={{
              top: `${layout.printBandTopPct}%`,
              bottom: `${layout.printBandBottomPct}%`,
              ...(layout.printBandLeftPct != null && layout.printBandWidthPct != null
                ? {
                    left: `${layout.printBandLeftPct}%`,
                    width: `${layout.printBandWidthPct}%`,
                  }
                : {}),
            }}
          >
            <div
              className="relative max-h-full overflow-visible"
              style={{
                aspectRatio: `${Aw} / ${Ah}`,
                width: `${layout.printMaxWidthPct}%`,
              }}
            >
              <div className="pointer-events-none absolute inset-0">
                {renderArtwork(1)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
