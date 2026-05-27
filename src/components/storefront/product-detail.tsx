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
import {
  computeDesignOverlayBox,
  getDefaultPrintAreaInches,
} from "@/lib/print/overlay-geometry";
import { usePrintfulBlankPhoto } from "@/lib/printful/use-blank-photo";
import { PhotographicColorMockup } from "@/components/storefront/photographic-color-mockup";
import { DesignPrintSizeIndicator } from "@/components/create/design-print-size-indicator";

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

  /**
   * Per-color print area — drives the dimensions indicator below the
   * color/size pickers. Same hook the hero image's blank cache uses,
   * deduped by the in-memory cache so this doesn't double-fetch.
   */
  const { area: indicatorPrintArea } = usePrintfulBlankPhoto(
    product.productType,
    selectedColor === defaultColor ? null : selectedColor,
  );
  const indicatorOverlay = computeDesignOverlayBox({
    productType: product.productType,
    layout: getMerchPreviewLayout(product.productType),
    printAreaInches: indicatorPrintArea,
    defaultPrintAreaInches: getDefaultPrintAreaInches(product.productType),
    normalizedPlacement: product.printPlacement ?? DEFAULT_STORED,
  });

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

          <DesignPrintSizeIndicator
            designInches={indicatorOverlay.designInches}
            printAreaInches={indicatorOverlay.printAreaInches}
            tone="compact"
          />

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
        <PrintfulCatalogDetails meta={product.printfulCatalogMeta} productId={product.id} />
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
 * One renderable layer in the crossfade stack. `mockup` is the published
 * listing photo (design already composited by Printful). `blank` is a
 * per-color catalog photo with the design overlaid in the DOM. `silhouette`
 * is the tinted SVG fallback used only when a variant truly has no photo.
 */
type MockupLayer =
  | { id: string; kind: "mockup"; url: string; loaded: boolean; colorLabel: string }
  | { id: string; kind: "blank"; url: string; loaded: boolean; colorLabel: string }
  | {
      id: string;
      kind: "silhouette";
      loaded: boolean;
      colorLabel: string;
      swatch: ColorSwatch;
    };

/**
 * Renders the listing image as a small crossfade stack so color swaps
 * stay visually continuous: the previously visible photo holds on screen
 * until the new color's blank has fully decoded, then the incoming layer
 * fades in over ~150 ms and the old layer is pruned. This eliminates both
 * the silhouette flash (no fallback shown mid-swap once we've ever shown
 * a real photo) and the naked-design flash (the design overlay sits
 * inside each incoming layer, so it only appears together with its
 * garment photo).
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

  const { url: blankPhotoUrl, loading: blankLoading, area: printAreaInches } =
    usePrintfulBlankPhoto(
      product.productType,
      isDefaultColor ? null : selectedColor,
    );

  /**
   * The layer we *want* to display for the current selection. May be
   * `null` while a per-color blank is being warmed — in that window we
   * keep the previous layer on screen instead of flashing the silhouette.
   */
  const target = useMemo<MockupLayer | null>(() => {
    if (isDefaultColor && canRenderMockup) {
      return {
        id: `mockup::${product.mockupUrl}`,
        kind: "mockup",
        url: product.mockupUrl,
        loaded: false,
        colorLabel: selectedColor,
      };
    }
    if (!isDefaultColor && hasDesign && blankPhotoUrl) {
      return {
        id: `blank::${selectedColor}::${blankPhotoUrl}`,
        kind: "blank",
        url: blankPhotoUrl,
        loaded: false,
        colorLabel: selectedColor,
      };
    }
    /** Cache terminal (unavailable) → fall back to the tinted silhouette so we don't keep showing a different color. */
    if (!isDefaultColor && hasDesign && !blankLoading) {
      return {
        id: `silhouette::${selectedColor}`,
        kind: "silhouette",
        loaded: false,
        colorLabel: selectedColor,
        swatch,
      };
    }
    return null;
  }, [
    isDefaultColor,
    canRenderMockup,
    hasDesign,
    blankPhotoUrl,
    blankLoading,
    product.mockupUrl,
    selectedColor,
    swatch,
  ]);

  /**
   * The first layer is initialised as already-loaded: the default-color
   * mockup is server-rendered, so the browser is painting it before React
   * hydrates and any `<Image onLoad>` may already have fired on the SSR'd
   * `<img>`. Starting at `loaded: true` keeps it opaque through hydration.
   */
  const [layers, setLayers] = useState<MockupLayer[]>(() =>
    target ? [{ ...target, loaded: true }] : [],
  );

  /**
   * Sync `target` into the layer stack during render. React supports
   * setState during render when guarded by a previous-value comparison —
   * see https://react.dev/reference/react/useState#storing-information-from-previous-renders.
   * Avoids the cascading-render warning that `useEffect → setLayers`
   * would trigger.
   */
  const [prevTargetId, setPrevTargetId] = useState<string | null>(
    target?.id ?? null,
  );
  if (target && target.id !== prevTargetId) {
    setPrevTargetId(target.id);
    setLayers((prev) => {
      if (prev.length === 0) return [{ ...target, loaded: true }];
      const top = prev[prev.length - 1];
      if (top.id === target.id) return prev;
      /** Drop an unloaded top (a layer the user clicked past before it ever painted). */
      const base = top.loaded ? prev : prev.slice(0, -1);
      if (target.kind === "silhouette") {
        /**
         * Silhouette has no `<Image>` to await, so it can't drive an
         * `onLoad → opacity 0→1` crossfade. Replace the stack outright
         * — the unavailable-blank branch is rare and a 0 ms switch beats
         * complicating the fade machinery.
         */
        return [{ ...target, loaded: true }];
      }
      return [...base, { ...target, loaded: false }];
    });
  }

  function markLoaded(id: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, loaded: true } : l)));
  }

  function pruneBelow(id: string) {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx <= 0 || idx !== prev.length - 1) return prev;
      if (!prev[idx].loaded) return prev;
      return prev.slice(idx);
    });
  }

  /** Empty stack: only reached when even the default-color path can't produce a photo (no mockupUrl + no cached blank). */
  if (layers.length === 0) {
    if (!isDefaultColor && hasDesign) {
      return (
        <ColoredGarmentMockup
          product={product}
          swatch={swatch}
          colorName={selectedColor}
          loading={blankLoading}
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

  /** Subtle hint only while a brand-new color's blank is actively warming. */
  const showLoadingHint = !isDefaultColor && hasDesign && blankLoading;

  return (
    <div className="relative h-full w-full">
      {layers.map((layer, i) => {
        const isTop = i === layers.length - 1;
        /** Lower layers stay opaque so they remain visible behind the fading-in top layer. */
        const opacity =
          layer.loaded || layers.length === 1 ? 1 : isTop ? 0 : 1;
        return (
          <div
            key={layer.id}
            className="absolute inset-0 transition-opacity duration-150 ease-out"
            style={{ opacity }}
            onTransitionEnd={() => pruneBelow(layer.id)}
          >
            {layer.kind === "mockup" && (
              <Image
                src={layer.url}
                alt={product.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                unoptimized
                onLoad={() => markLoaded(layer.id)}
              />
            )}
            {layer.kind === "blank" && (
              <PhotographicColorMockup
                product={product}
                photoUrl={layer.url}
                colorName={layer.colorLabel}
                printAreaInches={printAreaInches}
                onPhotoLoad={() => markLoaded(layer.id)}
              />
            )}
            {layer.kind === "silhouette" && (
              <ColoredGarmentMockup
                product={product}
                swatch={layer.swatch}
                colorName={layer.colorLabel}
              />
            )}
          </div>
        );
      })}
      {showLoadingHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            Loading high-res preview…
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Silhouette filled with the selected garment color, with the creator's
 * design composited on top at the saved print placement. Last-resort
 * fallback used while the per-color photo is being warmed or when
 * Printful doesn't ship a catalog photo for the variant.
 */
function ColoredGarmentMockup({
  product,
  swatch,
  colorName,
  loading = false,
}: {
  product: Product;
  swatch: ColorSwatch;
  colorName: string;
  loading?: boolean;
}) {
  const layout = getMerchPreviewLayout(product.productType);
  const overlay = computeDesignOverlayBox({
    productType: product.productType,
    layout,
    /** No live blank ⇒ no per-variant override; helper falls back to defaults. */
    printAreaInches: null,
    defaultPrintAreaInches: getDefaultPrintAreaInches(product.productType),
    normalizedPlacement: product.printPlacement ?? DEFAULT_STORED,
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
        width: `${overlay.design.widthPct}%`,
        height: `${overlay.design.heightPct}%`,
        left: `${overlay.design.leftPct}%`,
        top: `${overlay.design.topPct}%`,
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
              overlay.band.leftPct != null
                ? "pointer-events-none absolute flex items-center justify-center"
                : "pointer-events-none absolute left-1 right-1 flex items-center justify-center sm:left-2 sm:right-2"
            }
            style={{
              top: `${overlay.band.topPct}%`,
              bottom: `${overlay.band.bottomPct}%`,
              ...(overlay.band.leftPct != null
                ? {
                    left: `${overlay.band.leftPct}%`,
                    width: `${overlay.band.widthPct}%`,
                  }
                : {}),
            }}
          >
            <div
              className="relative max-h-full overflow-visible"
              style={{
                aspectRatio: overlay.band.aspectRatio,
                width:
                  overlay.band.leftPct != null
                    ? "100%"
                    : `${overlay.band.widthPct}%`,
              }}
            >
              <div className="pointer-events-none absolute inset-0">
                {renderArtwork(1)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {loading && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            Loading high-res preview…
          </span>
        </div>
      )}
    </div>
  );
}
