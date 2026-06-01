const mockupMod = await import("../src/lib/printful/blank-mockup.ts");
const catalogMod = await import("../src/lib/printful/catalog.ts");
const adminMod = await import("../src/lib/supabase/admin.ts");

const { getOrGenerateBlankForVariantId } = mockupMod;
const { getCatalogConfig } = catalogMod;
const { getServiceClient } = adminMod;

const cfg = getCatalogConfig("hoodie");
if (!cfg) {
  console.error("PRINTFUL_HOODIE_VARIANT_ID not set");
  process.exit(1);
}

const supabase = getServiceClient();
await supabase.from("printful_blank_mockups").delete().eq("catalog_variant_id", cfg.catalogVariantId);
console.log("[refresh] deleted stale row for variant", cfg.catalogVariantId);

const row = await getOrGenerateBlankForVariantId(cfg.catalogVariantId, "hoodie");
console.log("[refresh] warmed row", {
  source: row?.source,
  mockup_style_id: row?.mockup_style_id,
  y: row?.print_area_y_px,
  topPct:
    row?.print_area_y_px && row?.mockup_width_px
      ? ((row.print_area_y_px / row.mockup_width_px) * 100).toFixed(1)
      : null,
  url: row?.mockup_url?.slice(-70),
  color_hex: row?.color_hex,
});
