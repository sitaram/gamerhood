import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductType } from "@/lib/types";
import { placementLayerForProduct, parseStoredPlacement } from "@/lib/print/placement";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import { printfulRequest, type PrintfulFileLayer, isPrintfulConfigured } from "@/lib/printful/client";
import type { PrintfulCatalogConfig } from "@/lib/printful/catalog";
import { getCatalogConfig } from "@/lib/printful/catalog";

/** Placement grouping from GET /v2/catalog-products/{id}/mockup-styles */
interface CatalogMockupStyleGroup {
  placement: string;
  technique: string;
  print_area_type?: string;
  mockup_styles?: CatalogMockupStyle[];
}

/**
 * Single mockup style entry. Printful's v2 catalog endpoint splits the label
 * into two fields:
 *   - `category_name` — the visual treatment group, e.g.
 *       * "Flat"            — laid-flat product shot, sleeves usually tucked beside the body
 *       * "Flat 2"          — laid-flat product shot, sleeves spread outward / T-pose
 *       * "Ghost"           — invisible mannequin (3D-ish silhouette, no model)
 *       * "On Hanger"       — on a coathanger (hanger visible at top)
 *       * "Flat Lifestyle"  — flat with a prop background (still no model)
 *       * "Men's" / "Women's" / "Couple's" / "Halloween" / "Holiday season" / …
 *                           — themed model lifestyle shots (BAD for blank backdrop)
 *       * "Product details" / "Zoomed in" — close-ups, not a full garment
 *   - `view_name` — the camera angle ("Front", "Back", "Left", "Right Front",
 *                   "Left Leg", "Front 2", …).
 *
 * Older code paths (and some non-v2 endpoints) populate `title`/`name`/`type`
 * instead, so we accept all of them and merge into one lower-cased label.
 */
export interface CatalogMockupStyle {
  id: number;
  title?: string | null;
  name?: string | null;
  type?: string | null;
  category_name?: string | null;
  view_name?: string | null;
  restricted_to_variants: number[] | null;
}

interface MockupTaskRow {
  id?: number;
  status?: string;
  catalog_variant_mockups?: {
    catalog_variant_id?: number;
    mockups?: {
      placement?: string;
      mockup_url?: string;
    }[];
  }[];
  failure_reasons?: unknown[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchCatalogMockupStyles(
  catalogProductId: number,
  placement: string,
  opts?: { includeAll?: boolean },
): Promise<CatalogMockupStyleGroup[]> {
  /**
   * `default_mockup_styles=true` returns Printful's recommended (usually "On model") style only.
   * Drop it when we need a Flat option for the placement editor backdrop.
   */
  const qs = new URLSearchParams({ placements: placement });
  if (!opts?.includeAll) qs.set("default_mockup_styles", "true");
  const res = await printfulRequest<{ data: CatalogMockupStyleGroup[] }>(
    `/catalog-products/${catalogProductId}/mockup-styles?${qs.toString()}`,
  );
  return Array.isArray(res.data) ? res.data : [];
}

function styleCategory(style: CatalogMockupStyle): string {
  return (style.category_name ?? "").trim().toLowerCase();
}

function styleView(style: CatalogMockupStyle): string {
  return (style.view_name ?? "").trim().toLowerCase();
}

/**
 * Score how well a `view_name` matches the camera angle implied by a
 * placement key. The placement vocabulary is e.g. `front`, `back`,
 * `left_sleeve`, `leg_left`, `leg_front_left`. View names use spaces
 * ("Left Leg", "Right Front", "Front", "Back").
 *
 * Returns:
 *   +10  perfect orientation match (placement and view describe the same side)
 *    +4  generic "Front" view when the placement has no orientation
 *   -20  hard mismatch (e.g. placement is `leg_left` but view is `Right Leg`)
 *     0  neutral
 */
function viewOrientationScore(placement: string, view: string): number {
  if (!view) return 0;
  // Placement keys use underscores (`leg_left`, `back_neck`); collapse to
  // spaces so `\b` token boundaries trigger on the orientation words.
  const place = placement.toLowerCase().replace(/_/g, " ");
  const placeHasLeft = /\bleft\b/.test(place);
  const placeHasRight = /\bright\b/.test(place);
  const placeHasBack = /\bback\b/.test(place);
  const placeHasFront = /\bfront\b/.test(place) || (!placeHasBack && !placeHasLeft && !placeHasRight);
  const placeHasLeg = /\bleg\b/.test(place);
  const placeHasSleeve = /\bsleeve\b/.test(place);

  const viewHasLeft = /\bleft\b/.test(view);
  const viewHasRight = /\bright\b/.test(view);
  const viewHasBack = /\bback\b/.test(view);
  const viewHasFront = /\bfront\b/.test(view);
  const viewHasLeg = /\bleg\b/.test(view);
  const viewHasSleeve = /\bsleeve\b/.test(view);

  // Hard left/right mismatch — don't pick a Right Leg style for a leg_left placement.
  if (placeHasLeft && viewHasRight) return -20;
  if (placeHasRight && viewHasLeft) return -20;
  if (placeHasFront && !placeHasBack && viewHasBack && !viewHasFront) return -20;

  let s = 0;
  if (placeHasLeg && viewHasLeg) s += 8;
  if (placeHasSleeve && viewHasSleeve) s += 8;
  if (placeHasLeft && viewHasLeft) s += 6;
  if (placeHasRight && viewHasRight) s += 6;
  if (placeHasBack && viewHasBack) s += 6;
  if (placeHasFront && viewHasFront) s += 6;
  // No orientation in placement (e.g. plain "default") → neutral; "Front" is a safe default.
  if (!placeHasLeft && !placeHasRight && !placeHasBack && viewHasFront) s += 2;
  return s;
}

/**
 * Score how appropriate a `category_name` is as a *blank-product backdrop*
 * for the placement editor. We want a clean, no-model garment photo that
 * makes the silhouette obvious. Themed / lifestyle / model categories are
 * actively rejected because their backgrounds (props, models, holiday decor)
 * defeat the entire point of the editor backdrop.
 *
 * Ranking (apparel + accessories):
 *   "flat 2"          → sleeves spread outward / T-pose layflat (BEST for tops)
 *   "flat"            → standard layflat (sleeves often tucked beside body)
 *   "ghost"           → invisible-mannequin 3D-ish silhouette
 *   "on hanger"       → hanger artifact at top but garment shape is clear
 *   "flat lifestyle"  → flat with a tiny prop background (still no model)
 *   "product details" → close-ups; usable for non-apparel (mug, sticker)
 *   anything else     → model / themed shot, rejected
 */
function categoryBackdropScore(cat: string): number {
  if (!cat) return -10; // no category info → low confidence, prefer something with a category
  // T-pose layflat — Printful's "Flat 2" convention for tops (hoodie, tshirt, etc.).
  if (/^flat\s*2$/.test(cat)) return 100;
  if (/^flat$/.test(cat)) return 60;
  if (/^ghost\b/.test(cat)) return 50;
  if (/^on hanger$/.test(cat)) return 30;
  if (/^flat lifestyle$/.test(cat)) return 20;
  // For non-apparel SKUs (mug, sticker, poster, phone-case) Printful often
  // only ships "Product details" / "Zoomed in" / themed groups — keep these
  // as a fallback rather than rejecting them.
  if (/^(product details|zoomed in|default)$/.test(cat)) return 10;
  // Themed / lifestyle / model categories — never appropriate as a backdrop.
  // Includes "Men's", "Women's", "Couple's", "Halloween", "Holiday season",
  // "Valentine's Day", "Spring/summer vibes", "Red, white & blue", anything
  // ending in "Lifestyle N", etc.
  if (/men|women|couple|halloween|holiday|valentine|spring|summer|red, white|lifestyle|model/.test(cat)) {
    return -50;
  }
  return 0;
}

/**
 * Pick a clean blank-product mockup style (no model, sleeves visible) for
 * the given variant. Used to render the placement-editor backdrop and to
 * pre-warm `printful_blank_mockups`.
 *
 * Heuristic: flatten every group whose placement matches (Printful returns
 * one group per shape-variant on multi-shape SKUs like Metal Ornament; each
 * group's styles are `restricted_to_variants` to a single variant), filter
 * to styles eligible for THIS variant, then score by `(category preference)
 * + (view orientation match)`. Falling back to a single group caused
 * Printful 400s like "style_ids: X are not available for catalog variant Y"
 * because the first group's styles were restricted to a sibling variant.
 *
 * Returns null only if no eligible style exists across any matching group.
 */
export function pickFlatMockupStyleForVariant(
  groups: CatalogMockupStyleGroup[],
  placement: string,
  technique: string,
  variantId: number,
): { styleId: number; printAreaType: string } | null {
  const candidateGroups = collectGroupsForPlacement(groups, placement, technique);
  if (!candidateGroups.length) return null;

  type Scored = {
    style: CatalogMockupStyle;
    printAreaType: string;
    score: number;
  };
  const scored: Scored[] = [];
  for (const g of candidateGroups) {
    const printAreaType = pickPrintAreaType(g);
    for (const s of g.mockup_styles ?? []) {
      if (!isStyleEligibleForVariant(s, variantId)) continue;
      const cat = styleCategory(s);
      const view = styleView(s);
      const catScore = categoryBackdropScore(cat);
      const viewScore = viewOrientationScore(placement, view);
      scored.push({ style: s, printAreaType, score: catScore + viewScore });
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  return { styleId: top.style.id, printAreaType: top.printAreaType };
}

/**
 * Score mockup styles for the placement editor / print-frame overlay.
 *
 * The cyan printable-area rectangle MUST share the same coordinate frame as
 * Printful's `/v2/catalog-products/{id}/mockup-templates` `print_area_*`
 * fields — that is what `layer.position` is composited against at
 * fulfillment time. Ghost mannequin styles use that template image; Flat /
 * Flat 2 / hanger / lifestyle styles re-frame the garment and MUST NOT be
 * paired with template-derived pixel coords.
 */
function templateBackdropScore(cat: string): number {
  if (/^ghost\b/.test(cat)) return 100;
  if (/^flat\s*2$/.test(cat)) return -100;
  if (/^flat$/.test(cat)) return -80;
  if (/^on hanger$/.test(cat)) return -60;
  return -40;
}

/**
 * Pick a Ghost (template-aligned) mockup style for the placement editor
 * backdrop. Falls back to `pickFlatMockupStyleForVariant` when no Ghost
 * style exists for this SKU (some accessories only ship lifestyle styles).
 */
export function pickTemplateAlignedMockupStyleForVariant(
  groups: CatalogMockupStyleGroup[],
  placement: string,
  technique: string,
  variantId: number,
): { styleId: number; printAreaType: string; usesTemplateCoords: boolean } | null {
  const candidateGroups = collectGroupsForPlacement(groups, placement, technique);
  if (!candidateGroups.length) return null;

  type Scored = {
    style: CatalogMockupStyle;
    printAreaType: string;
    score: number;
  };
  const scored: Scored[] = [];
  for (const g of candidateGroups) {
    const printAreaType = pickPrintAreaType(g);
    for (const s of g.mockup_styles ?? []) {
      if (!isStyleEligibleForVariant(s, variantId)) continue;
      const cat = styleCategory(s);
      const view = styleView(s);
      const catScore = templateBackdropScore(cat);
      if (catScore < 0) continue;
      const viewScore = viewOrientationScore(placement, view);
      scored.push({ style: s, printAreaType, score: catScore + viewScore });
    }
  }
  if (scored.length) {
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    return {
      styleId: top.style.id,
      printAreaType: top.printAreaType,
      usesTemplateCoords: true,
    };
  }
  const fallback = pickFlatMockupStyleForVariant(groups, placement, technique, variantId);
  if (!fallback) return null;
  return { ...fallback, usesTemplateCoords: false };
}

/**
 * Return every group whose placement matches; prefer matching technique but
 * fall back to placement-only when none match (some apparel SKUs list a
 * shared placement under multiple techniques and only one group has real
 * mockup styles).
 */
function collectGroupsForPlacement(
  groups: CatalogMockupStyleGroup[],
  placement: string,
  technique: string,
): CatalogMockupStyleGroup[] {
  const placementMatches = groups.filter((g) => g.placement === placement);
  if (!placementMatches.length) return [];
  const techMatches = placementMatches.filter((g) => g.technique === technique);
  return techMatches.length ? techMatches : placementMatches;
}

function pickPrintAreaType(group: CatalogMockupStyleGroup): string {
  return typeof group.print_area_type === "string" && group.print_area_type.trim()
    ? group.print_area_type
    : "simple";
}

function isStyleEligibleForVariant(style: CatalogMockupStyle, variantId: number): boolean {
  const r = style.restricted_to_variants;
  return !r?.length || r.includes(variantId);
}

/**
 * Pick a mockup style id + print_area_type for this variant (respects
 * Printful restrictions across all matching groups, not just the first).
 * See `pickFlatMockupStyleForVariant` for why we flatten groups.
 */
export function pickMockupStyleForVariant(
  groups: CatalogMockupStyleGroup[],
  placement: string,
  technique: string,
  variantId: number,
): { styleId: number; printAreaType: string } | null {
  const candidateGroups = collectGroupsForPlacement(groups, placement, technique);
  if (!candidateGroups.length) return null;

  for (const g of candidateGroups) {
    const printAreaType = pickPrintAreaType(g);
    const styles = g.mockup_styles ?? [];
    // Prefer variant-restricted styles (those are Printful's "official"
    // mockup for this exact SKU). Unrestricted styles work everywhere but
    // are usually generic.
    const restrictedOk = styles.find((s) => s.restricted_to_variants?.includes(variantId));
    if (restrictedOk) return { styleId: restrictedOk.id, printAreaType };
    const unrestricted = styles.find((s) => !s.restricted_to_variants?.length);
    if (unrestricted) return { styleId: unrestricted.id, printAreaType };
  }
  return null;
}

function extractMockupUrl(task: MockupTaskRow): string | null {
  for (const group of task.catalog_variant_mockups ?? []) {
    for (const m of group.mockups ?? []) {
      const u = m.mockup_url;
      if (typeof u === "string" && /^https?:\/\//i.test(u)) return u;
    }
  }
  return null;
}

function parseTaskPayload(raw: unknown): MockupTaskRow[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data;
  if (Array.isArray(data)) return data as MockupTaskRow[];
  if (data && typeof data === "object") return [data as MockupTaskRow];
  return [];
}

export async function createMockupGeneratorTask(body: Record<string, unknown>): Promise<number> {
  const res = await printfulRequest<{ data: unknown }>("/mockup-tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const rows = parseTaskPayload(res);
  const id = rows[0]?.id;
  if (typeof id !== "number") throw new Error("Printful mockup task: missing task id");
  return id;
}

export async function getMockupGeneratorTasks(taskIds: number[]): Promise<MockupTaskRow[]> {
  if (!taskIds.length) return [];
  const qs = `id=${taskIds.map((id) => encodeURIComponent(String(id))).join(",")}`;
  const res = await printfulRequest<{ data: unknown }>(`/mockup-tasks?${qs}`);
  return parseTaskPayload(res);
}

export async function waitForMockupTaskMockupUrl(
  taskId: number,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 55_000;
  const intervalMs = opts?.intervalMs ?? 1200;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const rows = await getMockupGeneratorTasks([taskId]);
    const task = rows[0];
    const status = task?.status;

    if (status === "completed") {
      const url = extractMockupUrl(task);
      if (url) return url;
      throw new Error("Printful mockup completed but mockup_url was empty");
    }

    if (status === "failed") {
      const detail =
        task.failure_reasons && task.failure_reasons.length
          ? JSON.stringify(task.failure_reasons)
          : "unknown";
      throw new Error(`Printful mockup failed: ${detail}`);
    }

    await sleep(intervalMs);
  }

  throw new Error("Printful mockup task timed out");
}

export function buildCatalogMockupProductPayload(opts: {
  catalogProductId: number;
  catalogVariantIds: number[];
  mockupStyleIds: number[];
  placement: string;
  technique: string;
  printAreaType: string;
  layer: PrintfulFileLayer;
}): Record<string, unknown> {
  return {
    source: "catalog",
    mockup_style_ids: opts.mockupStyleIds,
    catalog_product_id: opts.catalogProductId,
    catalog_variant_ids: opts.catalogVariantIds,
    placements: [
      {
        placement: opts.placement,
        technique: opts.technique,
        print_area_type: opts.printAreaType,
        layers: [
          {
            type: "file",
            url: opts.layer.url,
            ...(opts.layer.position ? { position: opts.layer.position } : {}),
          },
        ],
      },
    ],
  };
}

/**
 * Ask Printful to render an official listing mockup (matches fulfillment geometry when layer.position is set).
 */
export async function generateListingMockupUrl(opts: {
  catalogProductId: number;
  catalogVariantId: number;
  productType: ProductType;
  catalog: PrintfulCatalogConfig;
  designUrl: string;
  storedPlacement: StoredPrintPlacement | null;
}): Promise<string | null> {
  if (!isPrintfulConfigured()) return null;

  try {
    const groups = await fetchCatalogMockupStyles(opts.catalogProductId, opts.catalog.placement);
    const picked = pickMockupStyleForVariant(
      groups,
      opts.catalog.placement,
      opts.catalog.technique,
      opts.catalogVariantId,
    );
    if (!picked) {
      console.warn(
        `[Printful mockups] No mockup style for catalog_product=${opts.catalogProductId} placement=${opts.catalog.placement}`,
      );
      return null;
    }

    const pfPos = placementLayerForProduct(opts.productType, opts.catalog, opts.storedPlacement);
    const layer: PrintfulFileLayer = { type: "file", url: opts.designUrl };
    if (pfPos) layer.position = pfPos;

    const payload = {
      format: "jpg",
      mockup_width_px: 1000,
      products: [
        buildCatalogMockupProductPayload({
          catalogProductId: opts.catalogProductId,
          catalogVariantIds: [opts.catalogVariantId],
          mockupStyleIds: [picked.styleId],
          placement: opts.catalog.placement,
          technique: opts.catalog.technique,
          printAreaType: picked.printAreaType,
          layer,
        }),
      ],
    };

    const taskId = await createMockupGeneratorTask(payload);
    return await waitForMockupTaskMockupUrl(taskId);
  } catch (e) {
    console.error("[Printful mockups] generateListingMockupUrl:", e);
    return null;
  }
}

/** Replace auto mockups / Printful URLs; skip when the creator uploaded a custom listing image (stored separately). */
export function shouldReplaceListingMockupWithPrintful(
  mockupUrl: string | null | undefined,
  designImageUrl: string | null | undefined,
): boolean {
  const m = mockupUrl?.trim();
  const d = designImageUrl?.trim();
  if (!m) return true;
  if (d && m === d) return true;
  if (/printful\.com/i.test(m)) return true;
  return false;
}

type ProductMockupRefreshRow = {
  id: string;
  product_type: string;
  mockup_url: string | null;
  printful_catalog_variant_id: number | null;
  printful_catalog_product_id: number | null;
  print_placement: unknown;
  designs?: { image_url: string | null } | null;
};

/** After placement changes (or publish), refresh Printful mockup when safe vs creator-uploaded listing photos. */
export async function refreshPrintfulListingMockupForProduct(
  supabase: SupabaseClient,
  productId: string,
): Promise<string | null> {
  if (!isPrintfulConfigured()) return null;

  const { data: row, error } = await supabase
    .from("products")
    .select(
      "id, product_type, mockup_url, printful_catalog_variant_id, printful_catalog_product_id, print_placement, designs ( image_url )",
    )
    .eq("id", productId)
    .single();

  if (error || !row) {
    console.warn("[Printful mockups] refresh: product fetch failed", error?.message);
    return null;
  }

  const p = row as unknown as ProductMockupRefreshRow;
  const designUrl = p.designs?.image_url ?? null;
  if (!designUrl || designUrl.startsWith("data:")) return null;

  if (!shouldReplaceListingMockupWithPrintful(p.mockup_url, designUrl)) return null;

  const variantId = p.printful_catalog_variant_id;
  const catalogProductId = p.printful_catalog_product_id;
  if (!variantId || !catalogProductId) return null;

  const productType = p.product_type as ProductType;
  const catalog = getCatalogConfig(productType);
  if (!catalog) return null;

  const storedPlacement = parseStoredPlacement(p.print_placement);

  const url = await generateListingMockupUrl({
    catalogProductId,
    catalogVariantId: variantId,
    productType,
    catalog,
    designUrl,
    storedPlacement,
  });

  if (url) {
    await supabase.from("products").update({ mockup_url: url }).eq("id", productId);
  }

  return url;
}
