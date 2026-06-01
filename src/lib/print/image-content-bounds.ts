/**
 * Client-side helpers to find the visible artwork bounds inside an upload.
 * Square PNG/JPG exports often ship with large white or transparent margins;
 * treating the full canvas as the design makes Printful print a huge white
 * rectangle. These helpers crop to the content bbox before preview/publish.
 */

const NEAR_WHITE = 245;
const MIN_ALPHA = 12;
/** Ignore trims smaller than this fraction of the long edge (noise / anti-aliasing). */
const MIN_TRIM_FRACTION = 0.02;

function isContentPixel(data: Uint8ClampedArray, i: number): boolean {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  if (a < MIN_ALPHA) return false;
  if (r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE) return false;
  return true;
}

export interface ContentBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  aspect: number;
}

/** Scan `imageData` for the tightest box around non-transparent, non-white pixels. */
export function boundsFromImageData(
  imageData: ImageData,
): ContentBounds | null {
  const { data, width, height } = imageData;
  if (width <= 0 || height <= 0) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!isContentPixel(data, i)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  return {
    left: minX,
    top: minY,
    width: w,
    height: h,
    aspect: w / h,
  };
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (src.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    img.src = src;
  });
}

/**
 * Crop uniform transparent / near-white margins from a data URL or remote URL.
 * Returns the original URL when no meaningful margin was found.
 */
export async function trimImageToContent(
  imageUrl: string,
): Promise<{ imageUrl: string; aspect: number; didTrim: boolean }> {
  const img = await loadHtmlImage(imageUrl);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (srcW <= 0 || srcH <= 0) {
    return { imageUrl, aspect: 1, didTrim: false };
  }

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { imageUrl, aspect: srcW / srcH, didTrim: false };
  }

  ctx.drawImage(img, 0, 0);
  const bounds = boundsFromImageData(ctx.getImageData(0, 0, srcW, srcH));
  if (!bounds) {
    return { imageUrl, aspect: srcW / srcH, didTrim: false };
  }

  const longEdge = Math.max(srcW, srcH);
  const trimmedX = bounds.left + (srcW - bounds.left - bounds.width);
  const trimmedY = bounds.top + (srcH - bounds.top - bounds.height);
  if (
    bounds.left < longEdge * MIN_TRIM_FRACTION &&
    bounds.top < longEdge * MIN_TRIM_FRACTION &&
    trimmedX < longEdge * MIN_TRIM_FRACTION &&
    trimmedY < longEdge * MIN_TRIM_FRACTION
  ) {
    return { imageUrl, aspect: srcW / srcH, didTrim: false };
  }

  const out = document.createElement("canvas");
  out.width = bounds.width;
  out.height = bounds.height;
  const outCtx = out.getContext("2d");
  if (!outCtx) {
    return { imageUrl, aspect: bounds.aspect, didTrim: false };
  }
  outCtx.drawImage(
    canvas,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  const mime = imageUrl.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";
  const trimmedUrl =
    mime === "image/jpeg"
      ? out.toDataURL("image/jpeg", 0.92)
      : out.toDataURL("image/png");

  return { imageUrl: trimmedUrl, aspect: bounds.aspect, didTrim: true };
}

/** Aspect ratio of visible artwork (falls back to full frame on failure). */
export async function detectContentAspect(imageUrl: string): Promise<number> {
  try {
    const img = await loadHtmlImage(imageUrl);
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (srcW <= 0 || srcH <= 0) return 1;

    const canvas = document.createElement("canvas");
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return srcW / srcH;

    ctx.drawImage(img, 0, 0);
    const bounds = boundsFromImageData(ctx.getImageData(0, 0, srcW, srcH));
    return bounds?.aspect ?? srcW / srcH;
  } catch {
    return 1;
  }
}
