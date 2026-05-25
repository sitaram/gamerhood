"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Download, Printer, QrCode as QrCodeIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QrCode } from "@/components/qr/qr-code";

interface DashboardQrCardProps {
  /** Canonical storefront URL to encode (built from siteUrl()). */
  url: string;
  /** Slug used for the downloaded PNG filename. */
  slug: string;
}

/**
 * Dashboard card that gives a creator their printable shop QR. Renders the
 * QR inline as an SVG (no fetch, no flicker) plus buttons to download a
 * crisp 1024px PNG and to send the page to the print dialog (which falls
 * back to the print stylesheet defined in `globals.css` to isolate the QR).
 */
export function DashboardQrCard({ url, slug }: DashboardQrCardProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        errorCorrectionLevel: "H",
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `gamerhood-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error("Could not build PNG");
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <Card className="qr-print-root border-border/50 bg-card p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="qr-print-target shrink-0">
          <QrCode url={url} size={160} logo />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 text-base font-semibold">
            <QrCodeIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            Your shop QR code
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Print it on stickers, posters, or share it with friends. Scanning
            takes them straight to your shop.
          </p>
          <p className="mt-2 text-xs text-muted-foreground break-all">
            {url}
          </p>

          <div className="qr-print-hide mt-4 flex flex-wrap gap-2">
            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Preparing…" : "Download high-res PNG"}
            </Button>
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
