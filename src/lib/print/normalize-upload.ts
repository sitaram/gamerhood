import sharp from "sharp";

/** Longest edge px — comfortable for POD (Printful DTG prefers ~4500 px across). */
const MAX_PRINT_DIMENSION = 4500;

/** SVG rasterized at this DPI via sharp/rsvg before resizing. */
const SVG_RASTER_DPI = 384;

function baseMime(type: string): string {
  return type.toLowerCase().split(";")[0].trim();
}

/** True when the MIME is vector SVG coming from an upload decode. */
export function isSvgMime(mimeType: string): boolean {
  return baseMime(mimeType) === "image/svg+xml";
}

/**
 * Turn vector SVG uploads into a high-res PNG Printful reliably accepts.
 * Preserves transparency (alpha) for knockout / clear backgrounds behind the artwork.
 */
export async function rasterizeSvgForPrinting(svgBytes: Buffer): Promise<Buffer> {
  try {
    return await sharp(svgBytes, { density: SVG_RASTER_DPI })
      .resize(MAX_PRINT_DIMENSION, MAX_PRINT_DIMENSION, {
        fit: "inside",
        withoutEnlargement: false,
      })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch (err) {
    console.error("[NormalizeUpload] SVG rasterize failed:", err);
    throw new Error("INVALID_SVG");
  }
}

/**
 * Larger rasters scaled down proportionally — avoids multi‑hundred‑MB payloads;
 * never upscales (no fake resolution). Returns the MIME matching the encoded
 * buffer (GIF resized becomes PNG single-frame).
 */
export async function capRasterIfHuge(
  input: Buffer,
  mimeHint: string,
): Promise<{ buffer: Buffer; mimeOut: string }> {
  const base = baseMime(mimeHint);
  if (!base.startsWith("image/") || base === "image/svg+xml") {
    return { buffer: input, mimeOut: base };
  }

  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.width || !meta.height) {
    return { buffer: input, mimeOut: base };
  }

  const maxSide = Math.max(meta.width, meta.height);
  if (maxSide <= MAX_PRINT_DIMENSION) {
    return { buffer: input, mimeOut: base };
  }

  const resized = sharp(input).resize(MAX_PRINT_DIMENSION, MAX_PRINT_DIMENSION, {
    fit: "inside",
    withoutEnlargement: true,
  });

  if (base === "image/png") {
    return {
      buffer: await resized.png({ compressionLevel: 9 }).toBuffer(),
      mimeOut: "image/png",
    };
  }
  if (base === "image/webp") {
    return {
      buffer: await resized.webp({ quality: 92 }).toBuffer(),
      mimeOut: "image/webp",
    };
  }
  // GIF loses animation once resized → emit PNG instead of mis-labeling JPEG
  if (base === "image/gif") {
    return {
      buffer: await resized.png({ compressionLevel: 9 }).toBuffer(),
      mimeOut: "image/png",
    };
  }

  return {
    buffer: await resized.jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
    mimeOut: "image/jpeg",
  };
}

export function bytesToBase64DataUrl(bytes: Buffer, mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const safeMime = allowed.has(base) ? base : "image/png";
  return `data:${safeMime};base64,${bytes.toString("base64")}`;
}

/**
 * Remove uniform transparent or near-white margins before Printful sees the
 * file. Uploads with a small logo centered on a huge white square otherwise
 * print as an oversized solid rectangle — the #1 POD failure mode for
 * non-designer artwork.
 */
export async function trimPrintMargins(
  input: Buffer,
  mimeHint: string,
): Promise<{ buffer: Buffer; mimeOut: string }> {
  const base = baseMime(mimeHint);
  if (!base.startsWith("image/") || base === "image/svg+xml") {
    return { buffer: input, mimeOut: base };
  }

  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.width || !meta?.height) {
    return { buffer: input, mimeOut: base };
  }

  try {
    const { data, info } = await sharp(input)
      .trim({ threshold: 15 })
      .toBuffer({ resolveWithObject: true });

    const origW = info.input?.width ?? meta.width;
    const origH = info.input?.height ?? meta.height;
    const longEdge = Math.max(origW, origH);
    const trimmedW = origW - info.width;
    const trimmedH = origH - info.height;
    /** Skip when margins are negligible — avoids touching edge-to-edge art. */
    if (
      trimmedW < longEdge * 0.02 &&
      trimmedH < longEdge * 0.02
    ) {
      return { buffer: input, mimeOut: base };
    }

    const pipeline = sharp(data);
    if (base === "image/png") {
      return {
        buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
        mimeOut: "image/png",
      };
    }
    if (base === "image/webp") {
      return {
        buffer: await pipeline.webp({ quality: 92 }).toBuffer(),
        mimeOut: "image/webp",
      };
    }
    if (base === "image/gif") {
      return {
        buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(),
        mimeOut: "image/png",
      };
    }
    return {
      buffer: await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer(),
      mimeOut: "image/jpeg",
    };
  } catch {
    return { buffer: input, mimeOut: base };
  }
}
