import sharp from "sharp";

/**
 * Result of inspecting a raster design for "is the background transparent?"
 *
 * `transparent: true` only when a meaningful share of pixels are fully clear
 * (see `MIN_CLEAR_PIXEL_FRACTION`). A handful of anti-aliased edge pixels on
 * an otherwise opaque export must NOT pass — that was causing SVG uploads with
 * baked-in backgrounds to show "Transparency detected."
 *
 * `transparent: false` covers everything else, with a `reason` we surface in logs:
 *
 *   - `no_alpha`            — no alpha channel at all (e.g. JPEG, flat PNG)
 *   - `alpha_fully_opaque`  — alpha channel exists but every pixel is 255
 *   - `insufficient_alpha`  — some non-opaque pixels, but not enough clear area
 *   - `decode_failed`       — sharp couldn't read the file (corrupt, weird format)
 *
 * The `decode_failed` case is treated like "solid background" for the badge
 * UI: better to nudge the creator to re-upload than to silently report
 * something we couldn't actually verify.
 */
export type DesignTransparency =
  | { transparent: true }
  | {
      transparent: false;
      reason: "no_alpha" | "alpha_fully_opaque" | "insufficient_alpha" | "decode_failed";
    };

/** Fully clear pixels (alpha below this) must cover at least this share of the canvas. */
const MIN_CLEAR_PIXEL_FRACTION = 0.005;
const CLEAR_ALPHA = 16;
const ANALYSIS_MAX_DIMENSION = 800;

/**
 * Inspect raster bytes (PNG, WebP, JPEG, GIF) and answer: will areas without
 * artwork actually print as clear, or will the design print as a solid rectangle?
 *
 * We downsample first so huge print files stay cheap, then count how much of
 * the canvas is fully transparent. SVG uploads are checked on the rasterized
 * PNG from `rasterizeSvgForPrinting`, not the raw vector source.
 */
export async function detectDesignTransparency(
  input: Buffer,
): Promise<DesignTransparency> {
  try {
    const meta = await sharp(input).metadata();
    if (!meta.hasAlpha) {
      return { transparent: false, reason: "no_alpha" };
    }

    const { data, info } = await sharp(input)
      .resize(ANALYSIS_MAX_DIMENSION, ANALYSIS_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const ch = info.channels;
    const n = info.width * info.height;
    if (n === 0) {
      return { transparent: false, reason: "decode_failed" };
    }

    let clear = 0;
    let nonOpaque = 0;
    for (let p = 0; p < n; p += 1) {
      const a = data[p * ch + 3];
      if (a < CLEAR_ALPHA) clear += 1;
      if (a < 255) nonOpaque += 1;
    }

    const clearFraction = clear / n;
    if (clearFraction >= MIN_CLEAR_PIXEL_FRACTION) {
      return { transparent: true };
    }
    if (nonOpaque === 0) {
      return { transparent: false, reason: "alpha_fully_opaque" };
    }
    return { transparent: false, reason: "insufficient_alpha" };
  } catch (err) {
    console.warn("[transparency] decode failed:", err instanceof Error ? err.message : err);
    return { transparent: false, reason: "decode_failed" };
  }
}

/**
 * Same as `detectDesignTransparency` but accepts the canonical inputs we
 * carry in app code: a `data:` URL (Gemini output, browser FileReader
 * upload), an `http(s)` URL (Supabase Storage public path), or a Buffer
 * we already have in hand.
 *
 * Returns `null` when nothing usable could be loaded — keeps callers from
 * having to special-case "URL was empty / fetch errored" vs. "we ran the
 * check and the design is opaque." Null means "couldn't compute" and the
 * UI renders the neutral "?" state.
 */
export async function detectDesignTransparencyFromAnySource(
  input: Buffer | string,
): Promise<DesignTransparency | null> {
  if (Buffer.isBuffer(input)) {
    return detectDesignTransparency(input);
  }
  if (typeof input !== "string" || !input) return null;

  if (input.startsWith("data:")) {
    const comma = input.indexOf(",");
    if (comma === -1) return null;
    const header = input.slice(5, comma);
    const body = input.slice(comma + 1);
    const isBase64 = /;base64/i.test(header);
    try {
      const buf = isBase64
        ? Buffer.from(body.replace(/\s/g, ""), "base64")
        : Buffer.from(decodeURIComponent(body), "utf8");
      return detectDesignTransparency(buf);
    } catch (err) {
      console.warn(
        "[transparency] data URL decode failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const res = await fetch(input);
      if (!res.ok) {
        console.warn(
          `[transparency] fetch ${input} returned ${res.status}; treating as unknown`,
        );
        return null;
      }
      const arr = await res.arrayBuffer();
      return detectDesignTransparency(Buffer.from(arr));
    } catch (err) {
      console.warn(
        "[transparency] fetch failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  return null;
}
