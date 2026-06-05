import {
  bytesToBase64DataUrl,
  capRasterIfHuge,
  isSvgMime,
  rasterizeSvgForPrinting,
  trimPrintMargins,
} from "@/lib/print/normalize-upload";
import { decodeDesignDataUrl } from "@/lib/storage";
import { moderateImageBase64 } from "@/lib/moderation";
import { detectDesignTransparencyFromAnySource } from "@/lib/print/transparency";

export type NormalizedUpload = {
  imageForPersist: string;
  uploadedAsSvg: boolean;
  hasTransparency: boolean | null;
};

/**
 * Decode, normalize, trim, and moderate an inline upload data URL.
 * Shared by the library-save endpoint and publish so uploads land in
 * Storage with identical bytes in both paths.
 */
export async function normalizeUploadedDesignDataUrl(
  imageUrl: string,
): Promise<
  | { ok: true; value: NormalizedUpload }
  | { ok: false; error: string; status: number }
> {
  const normalizedUrl = imageUrl.trim();
  if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
    const transparency = await detectDesignTransparencyFromAnySource(normalizedUrl);
    return {
      ok: true,
      value: {
        imageForPersist: normalizedUrl,
        uploadedAsSvg: false,
        hasTransparency: transparency ? transparency.transparent : null,
      },
    };
  }
  if (normalizedUrl.startsWith("blob:")) {
    return {
      ok: false,
      status: 400,
      error: "Image upload didn't complete — please pick the file again.",
    };
  }
  if (!normalizedUrl.startsWith("data:")) {
    return {
      ok: false,
      status: 400,
      error: "Upload must be provided as inline image data.",
    };
  }

  const decoded = decodeDesignDataUrl(normalizedUrl);
  if (!decoded) {
    return {
      ok: false,
      status: 400,
      error: "Couldn't read your image encoding. Try exporting SVG as PNG, or upload PNG/JPG.",
    };
  }

  let uploadBytes = decoded.bytes;
  let uploadMime = decoded.mimeType.split(";")[0].trim().toLowerCase();
  let uploadedAsSvg = false;

  const allowedUpload = /^image\/(png|jpeg|webp|gif|svg\+xml)$/;
  if (!allowedUpload.test(uploadMime)) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported file type — use PNG, JPG, WebP, GIF, or SVG.",
    };
  }

  try {
    if (isSvgMime(uploadMime)) {
      uploadedAsSvg = true;
      uploadBytes = await rasterizeSvgForPrinting(uploadBytes);
      uploadMime = "image/png";
    } else {
      const capped = await capRasterIfHuge(uploadBytes, uploadMime);
      uploadBytes = capped.buffer;
      uploadMime = capped.mimeOut;
    }
    const trimmed = await trimPrintMargins(uploadBytes, uploadMime);
    uploadBytes = trimmed.buffer;
    uploadMime = trimmed.mimeOut;
  } catch (err) {
    const tag = err instanceof Error ? err.message : "";
    const msg =
      tag === "INVALID_SVG"
        ? "Couldn't process this SVG — check that it's valid, or export as PNG."
        : "Couldn't process uploaded image.";
    return { ok: false, status: 400, error: msg };
  }

  const imageForPersist = bytesToBase64DataUrl(uploadBytes, uploadMime);

  const moderation = await moderateImageBase64(imageForPersist);
  if (!moderation.safe) {
    return {
      ok: false,
      status: 400,
      error: "That image didn't pass our content check. Please try a different one.",
    };
  }

  const transparency = await detectDesignTransparencyFromAnySource(imageForPersist);

  return {
    ok: true,
    value: {
      imageForPersist,
      uploadedAsSvg,
      hasTransparency: transparency ? transparency.transparent : null,
    },
  };
}
