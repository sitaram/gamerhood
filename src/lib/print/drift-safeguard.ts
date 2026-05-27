/**
 * Pre-payment print-area drift safeguard.
 *
 * Runs inside the `checkout.session.completed` Stripe webhook, BEFORE we
 * push the order to Printful for fulfillment. For each line item we:
 *
 *   1. Look up the print area dimensions we *used* to compute the design
 *      size — the values cached on `printful_blank_mockups` at warm time.
 *   2. Re-fetch the live print area from Printful's catalog API.
 *   3. If the two diverge by more than the tolerance (default 1%) on
 *      either axis, refuse to auto-fulfill — the buyer's preview was
 *      rendered against stale dims and would arrive printed at a
 *      different physical size.
 *
 * This is belt-and-suspenders: the warmer already keeps the cache fresh,
 * and the storefront + editor already render against those cached dims.
 * But Printful occasionally re-publishes a SKU with revised templates
 * (e.g. a new mockup style with different `placement_dimensions`); when
 * that happens we'd rather hold the order for manual review than print a
 * mis-sized hoodie and refund.
 */

import { getServiceClient } from "@/lib/supabase/admin";
import { printfulRequest, isPrintfulConfigured } from "@/lib/printful/client";
import { getCatalogConfig, getPrintAreaInches } from "@/lib/printful/catalog";
import type { ProductType } from "@/lib/types";

const DRIFT_TOLERANCE = 0.01;

export interface DriftCheckLine {
  productId: string;
  productTitle: string;
  productType: ProductType;
  catalogVariantId: number;
  /** Inches we *used* (DB-cached when present, hardcoded default otherwise). */
  expectedAreaInches: { width: number; height: number } | null;
  /** Inches Printful currently reports. */
  actualAreaInches: { width: number; height: number } | null;
  /**
   * `drift` ⇒ verified live and diverged past tolerance.
   * `missing-expected` ⇒ neither DB cache nor hardcoded default — can't
   *    compare, treat as drift to be safe.
   * `missing-actual` ⇒ Printful didn't return dims (rare; some embroidery
   *    SKUs). Skip the check rather than blocking a legitimate order.
   * `ok` ⇒ live matches expected within tolerance.
   * `not-checked` ⇒ Printful not configured or fetch errored — log and
   *    skip; safer than blocking on infra blips.
   */
  status: "ok" | "drift" | "missing-expected" | "missing-actual" | "not-checked";
  reason?: string;
}

export interface DriftCheckResult {
  /** True only when every line is `ok` (no drift, no missing-expected). */
  passed: boolean;
  /** Lines with drift or missing-expected; surfaced in the alert. */
  flaggedLines: DriftCheckLine[];
  /** Every line (for logging / debugging). */
  lines: DriftCheckLine[];
}

interface PlacementDim {
  placement?: string;
  width?: number;
  height?: number;
}

async function fetchLivePrintArea(
  catalogVariantId: number,
  placement: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const res = await printfulRequest<{
      data?: { placement_dimensions?: PlacementDim[] };
    }>(`/catalog-variants/${catalogVariantId}`);
    const dims = res.data?.placement_dimensions;
    if (!Array.isArray(dims)) return null;
    const match = dims.find((d) => d.placement === placement);
    if (!match) return null;
    const w = typeof match.width === "number" && match.width > 0 ? match.width : null;
    const h = typeof match.height === "number" && match.height > 0 ? match.height : null;
    if (!w || !h) return null;
    return { width: w, height: h };
  } catch (err) {
    console.warn("[print-area-drift] live fetch failed", {
      catalogVariantId,
      placement,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function readCachedPrintArea(
  catalogVariantId: number,
): Promise<{ width: number; height: number } | null> {
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("printful_blank_mockups")
      .select("print_area_width_in, print_area_height_in")
      .eq("catalog_variant_id", catalogVariantId)
      .maybeSingle();
    const w = data?.print_area_width_in;
    const h = data?.print_area_height_in;
    if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
      return { width: w, height: h };
    }
    return null;
  } catch (err) {
    console.warn("[print-area-drift] cache read threw", {
      catalogVariantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function withinTolerance(
  expected: { width: number; height: number },
  actual: { width: number; height: number },
  tolerance: number,
): boolean {
  const dw = Math.abs(actual.width - expected.width) / expected.width;
  const dh = Math.abs(actual.height - expected.height) / expected.height;
  return dw <= tolerance && dh <= tolerance;
}

export interface DriftCheckInput {
  productId: string;
  productTitle: string;
  productType: ProductType;
  catalogVariantId: number;
}

export async function verifyPrintAreaForOrder(
  lines: DriftCheckInput[],
): Promise<DriftCheckResult> {
  if (!isPrintfulConfigured()) {
    /**
     * Don't block fulfillment when Printful isn't configured for this env
     * (e.g. local dev without API tokens). The webhook already skips
     * Printful submission in that case — drift can't matter when we
     * aren't pushing the order.
     */
    return {
      passed: true,
      flaggedLines: [],
      lines: lines.map<DriftCheckLine>((l) => ({
        ...l,
        expectedAreaInches: null,
        actualAreaInches: null,
        status: "not-checked",
        reason: "Printful not configured",
      })),
    };
  }

  const results = await Promise.all(
    lines.map(async (line): Promise<DriftCheckLine> => {
      const catalog = getCatalogConfig(line.productType);
      if (!catalog) {
        return {
          ...line,
          expectedAreaInches: null,
          actualAreaInches: null,
          status: "not-checked",
          reason: `No catalog config for ${line.productType}`,
        };
      }
      const [cached, live] = await Promise.all([
        readCachedPrintArea(line.catalogVariantId),
        fetchLivePrintArea(line.catalogVariantId, catalog.placement),
      ]);

      const expected = cached ?? getPrintAreaInches(line.productType);
      if (!expected) {
        return {
          ...line,
          expectedAreaInches: null,
          actualAreaInches: live,
          status: "missing-expected",
          reason:
            "No cached or default print area on file; can't verify Printful preview matches reality.",
        };
      }
      if (!live) {
        return {
          ...line,
          expectedAreaInches: expected,
          actualAreaInches: null,
          status: "missing-actual",
          reason:
            "Printful did not return placement_dimensions for this variant — likely an embroidery SKU without explicit dims.",
        };
      }

      if (withinTolerance(expected, live, DRIFT_TOLERANCE)) {
        return {
          ...line,
          expectedAreaInches: expected,
          actualAreaInches: live,
          status: "ok",
        };
      }

      return {
        ...line,
        expectedAreaInches: expected,
        actualAreaInches: live,
        status: "drift",
        reason: `Print area drift: expected ${expected.width}×${expected.height}", got ${live.width}×${live.height}" (tolerance ${DRIFT_TOLERANCE * 100}%).`,
      };
    }),
  );

  const flagged = results.filter(
    (l) => l.status === "drift" || l.status === "missing-expected",
  );
  return {
    passed: flagged.length === 0,
    flaggedLines: flagged,
    lines: results,
  };
}

/**
 * Compact human-readable summary, suitable for log lines + admin email
 * subject lines. e.g. "2 lines flagged: hoodie expected 14×14, got 12×16; …"
 */
export function summarizeDrift(result: DriftCheckResult): string {
  const flagged = result.flaggedLines;
  if (flagged.length === 0) return "no drift";
  return flagged
    .map((line) => {
      const exp = line.expectedAreaInches
        ? `${line.expectedAreaInches.width}×${line.expectedAreaInches.height}"`
        : "—";
      const got = line.actualAreaInches
        ? `${line.actualAreaInches.width}×${line.actualAreaInches.height}"`
        : "—";
      return `${line.productTitle} (variant ${line.catalogVariantId}): expected ${exp}, got ${got}`;
    })
    .join("; ");
}
