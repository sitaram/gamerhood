"use client";

import { useEffect, useState } from "react";
import type { ProductType } from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "unavailable";

interface CacheEntry {
  status: Status;
  url: string | null;
}

/** Shared across all components mounted in the same browser tab. */
const browserCache = new Map<ProductType, CacheEntry>();
const pending = new Map<ProductType, Promise<void>>();

/**
 * The blank mockup may need ~10–30 s to render on the Printful side the first
 * time. We poll with light-touch intervals so the UI updates as soon as the
 * server has a URL, without hammering the API in the steady state.
 */
const POLL_DELAYS_MS = [4_000, 6_000, 8_000, 10_000, 15_000, 20_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(productType: ProductType): Promise<{ url: string | null; status: string } | null> {
  try {
    const res = await fetch(
      `/api/printful/blank-photo?type=${encodeURIComponent(productType)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { url?: string | null; status?: string };
    return {
      url: typeof j.url === "string" && j.url ? j.url : null,
      status: typeof j.status === "string" ? j.status : "unavailable",
    };
  } catch {
    return null;
  }
}

/**
 * Drives the cache for one ProductType. Resolves once we reach a terminal
 * state (`ready` or `unavailable`); intermediate `generating` responses
 * trigger another poll after a bounded backoff. Multiple in-flight callers
 * for the same type share a single promise via the `pending` map.
 */
function ensureFetch(productType: ProductType, onChange: () => void): Promise<void> {
  const inFlight = pending.get(productType);
  if (inFlight) return inFlight;

  const p = (async () => {
    let attempt = 0;
    while (true) {
      const r = await fetchOnce(productType);

      if (!r) {
        browserCache.set(productType, { status: "unavailable", url: null });
        onChange();
        return;
      }

      if (r.status === "ready" && r.url) {
        browserCache.set(productType, { status: "ready", url: r.url });
        onChange();
        return;
      }

      if (r.status === "unavailable") {
        browserCache.set(productType, { status: "unavailable", url: null });
        onChange();
        return;
      }

      /** "generating" — back off and poll again. */
      if (browserCache.get(productType)?.status !== "loading") {
        browserCache.set(productType, { status: "loading", url: null });
        onChange();
      }
      const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
      attempt += 1;
      if (attempt > POLL_DELAYS_MS.length + 2) {
        /** Give up after ~90 s — the SVG silhouette continues to render. */
        browserCache.set(productType, { status: "unavailable", url: null });
        onChange();
        return;
      }
      await sleep(delay);
    }
  })().finally(() => {
    pending.delete(productType);
  });

  pending.set(productType, p);
  return p;
}

/**
 * Returns the Printful flat blank photo URL for a product type, or `null`
 * (with `loading: true`) while the first-time mockup task renders. Callers
 * should display the SVG silhouette as a fallback when `url` is null.
 */
export function usePrintfulBlankPhoto(productType: ProductType): {
  url: string | null;
  loading: boolean;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const existing = browserCache.get(productType);
    if (existing && (existing.status === "ready" || existing.status === "unavailable")) {
      return;
    }
    let cancelled = false;
    ensureFetch(productType, () => {
      if (!cancelled) setTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [productType]);

  const entry = browserCache.get(productType);
  return {
    url: entry?.status === "ready" ? entry.url : null,
    loading: !entry || entry.status === "loading",
  };
}
