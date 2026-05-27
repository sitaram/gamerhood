/**
 * Implementation for `scripts/check-print-area-consistency.mjs`. See that
 * wrapper for entry-point docs.
 *
 * Output (one line per product type, then a summary):
 *
 *   hoodie               variant=9220  cached=14.0×14.0"  live=14.0×14.0"  drift=0.0%  designInches=10.5×10.5"  ok
 *   ...
 *   Done — checked=7  ok=7  drift=0  missing=0
 */

const driftMod = await import("../src/lib/print/drift-safeguard.ts");
const overlayMod = await import("../src/lib/print/overlay-geometry.ts");
const layoutMod = await import("../src/lib/create/merch-preview-layout.ts");
const placementMod = await import("../src/lib/print/placement.ts");
const catalogMod = await import("../src/lib/printful/catalog.ts");
const adminMod = await import("../src/lib/supabase/admin.ts");

const { verifyPrintAreaForOrder } = driftMod;
const { computeDesignOverlayBox, getDefaultPrintAreaInches, formatInchesLabel } = overlayMod;
const { getMerchPreviewLayout } = layoutMod;
const { parseStoredPlacement, DEFAULT_STORED } = placementMod;
const { getCatalogConfig } = catalogMod;
const { getServiceClient } = adminMod;

type ProductType = string;

const ALL_TYPES: ProductType[] = [
  "hoodie",
  "kids-hoodie",
  "kids-heavyweight-tee",
  "kids-long-sleeve",
  "kids-sports-tee",
  "kids-tshirt",
  "tshirt",
  "joggers",
  "mug",
  "poster",
  "backpack",
  "phone-case",
  "sticker",
  "pillow",
  "blanket",
  "pet-sweater",
  "tote-bag",
  "ornament",
  "puzzle",
  "embroidered-patch",
  "hardcover-journal",
];

const args = process.argv.slice(2);
const productFilters = args
  .filter((a) => a.startsWith("--product="))
  .map((a) => a.slice("--product=".length));
const positional = args.filter((a) => !a.startsWith("--"));
const only = [...productFilters, ...positional];
const targets = only.length ? ALL_TYPES.filter((t) => only.includes(t)) : ALL_TYPES;

const supabase = getServiceClient();

interface ProductRow {
  id: string;
  title: string;
  product_type: ProductType;
  print_placement: unknown;
  printful_catalog_variant_id: number | null;
}

let checked = 0;
let ok = 0;
let driftCount = 0;
let missing = 0;

console.log(
  `[check-print-area-consistency] running over ${targets.length} product types`,
);

for (const type of targets) {
  const cfg = getCatalogConfig(type as never);
  const fallbackVariantId = cfg?.catalogVariantId ?? null;

  /** Prefer a real published product; fall back to env-default variant when none yet. */
  const { data, error } = await supabase
    .from("products")
    .select("id, title, product_type, print_placement, printful_catalog_variant_id")
    .eq("product_type", type)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn(`  ${type.padEnd(22)} FAIL  DB lookup: ${error.message}`);
    missing++;
    continue;
  }
  const product = (data?.[0] as ProductRow | undefined) ?? null;

  const variantId = product?.printful_catalog_variant_id ?? fallbackVariantId;
  if (!variantId) {
    console.warn(
      `  ${type.padEnd(22)} skip (no published product and no env-default variant)`,
    );
    missing++;
    continue;
  }

  const driftResult = await verifyPrintAreaForOrder([
    {
      productId: product?.id ?? "fallback",
      productTitle: product?.title ?? `${type} (fallback)`,
      productType: type as never,
      catalogVariantId: variantId,
    },
  ]);
  const line = driftResult.lines[0];
  const cached = line.expectedAreaInches;
  const live = line.actualAreaInches;

  const placement =
    parseStoredPlacement(product?.print_placement) ?? DEFAULT_STORED;
  const overlay = computeDesignOverlayBox({
    productType: type as never,
    layout: getMerchPreviewLayout(type as never),
    printAreaInches: cached,
    defaultPrintAreaInches: getDefaultPrintAreaInches(type as never),
    normalizedPlacement: placement,
  });

  const driftPct =
    cached && live
      ? Math.max(
          Math.abs(live.width - cached.width) / cached.width,
          Math.abs(live.height - cached.height) / cached.height,
        )
      : null;

  const driftLabel = driftPct == null ? "—" : `${(driftPct * 100).toFixed(2)}%`;
  const cachedLabel = cached
    ? `${formatInchesLabel(cached.width)}×${formatInchesLabel(cached.height)}`
    : "—";
  const liveLabel = live
    ? `${formatInchesLabel(live.width)}×${formatInchesLabel(live.height)}`
    : "—";
  const designLabel = `${formatInchesLabel(overlay.designInches.width)}×${formatInchesLabel(overlay.designInches.height)}`;

  checked++;
  let status: string;
  if (line.status === "drift") {
    status = "DRIFT";
    driftCount++;
  } else if (line.status === "missing-expected") {
    status = "MISSING-EXPECTED";
    driftCount++;
  } else if (line.status === "missing-actual") {
    status = "missing-live";
    missing++;
  } else if (line.status === "ok") {
    status = "ok";
    ok++;
  } else {
    status = line.status;
    missing++;
  }

  console.log(
    `  ${type.padEnd(22)} variant=${String(variantId).padEnd(7)} cached=${cachedLabel.padEnd(12)} live=${liveLabel.padEnd(12)} drift=${driftLabel.padEnd(7)} design=${designLabel.padEnd(12)} ${status}`,
  );
}

console.log(
  `Done — checked=${checked} ok=${ok} drift=${driftCount} missing=${missing}`,
);

process.exit(driftCount > 0 ? 1 : 0);
