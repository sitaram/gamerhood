"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode } from "@/components/qr/qr-code";

interface QrModalProps {
  url: string;
  title: string;
  subtitle?: string;
  /**
   * Filename slug used for the downloaded PNG. The final filename is
   * `gamerhood-<filenameSlug>.png`. Defaults to `qr`.
   */
  filenameSlug?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QrModal({
  url,
  title,
  subtitle,
  filenameSlug = "qr",
  open,
  onOpenChange,
}: QrModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied!");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

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
      a.download = `gamerhood-${filenameSlug}.png`;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="qr-print-root max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-base sm:text-lg">
            {title}
          </DialogTitle>
          {subtitle && (
            <DialogDescription className="text-center break-all">
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="qr-print-target flex flex-col items-center gap-3 py-2">
          <QrCode url={url} size={280} logo className="shadow-md" />
          <p className="text-xs text-muted-foreground break-all text-center max-w-[260px]">
            {url}
          </p>
        </div>

        <div className="qr-print-hide flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <Check className="h-4 w-4 text-neon-green" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={handleDownload}
            disabled={downloading}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Preparing…" : "Download PNG"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrint}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
