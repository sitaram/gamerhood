import QRCode from "qrcode";

import { cn } from "@/lib/utils";

interface QrCodeProps {
  url: string;
  /** Pixel size of the rendered QR (the wrapper width). Defaults to 240. */
  size?: number;
  /**
   * When true, overlays the Gamerhood axolotl mascot at center. The QR is
   * generated with error-correction level H, which lets ~30% of modules be
   * occluded and still scan reliably — plenty of headroom for a ~20% logo.
   */
  logo?: boolean;
  className?: string;
}

/**
 * Inline-SVG QR code. Rendered synchronously from the bit-matrix so the
 * component works in both server and client trees with no flicker, no
 * external fetch, and no dependency on a third-party QR service.
 *
 * The QR always sits on a white background regardless of theme —
 * dark-on-white is the most reliable contrast for phone-camera scanners.
 */
export function QrCode({ url, size = 240, logo = false, className }: QrCodeProps) {
  const svgMarkup = renderQrSvg(url);

  const logoPx = Math.round(size * 0.2);
  const padPx = Math.round(logoPx * 0.18);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg bg-white p-3",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <div
        className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
      {logo && (
        <div
          className="pointer-events-none absolute flex items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/5"
          style={{
            width: logoPx + padPx * 2,
            height: logoPx + padPx * 2,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/mascot-axolotl-head.png"
            alt=""
            aria-hidden="true"
            width={logoPx}
            height={logoPx}
            className="object-contain"
            style={{ width: logoPx, height: logoPx }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Render a QR code as a compact inline SVG string. We walk the bit-matrix
 * and emit one `<rect>` per dark module. This is sync (unlike
 * `QRCode.toString`, which returns a Promise) so the component can be
 * used in both server and client contexts.
 */
function renderQrSvg(url: string): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const modules = qr.modules;
  const moduleCount = modules.size;
  const margin = 2;
  const total = moduleCount + margin * 2;

  let rects = "";
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules.get(row, col)) {
        rects += `<rect x="${col + margin}" y="${row + margin}" width="1" height="1" fill="#000"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>${rects}</svg>`;
}
