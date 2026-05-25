"use client";

import { useState } from "react";
import { QrCode as QrCodeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QrModal } from "@/components/qr/qr-modal";

interface StorefrontQrButtonProps {
  url: string;
  /** Display name of the creator (for the modal title). */
  displayName: string;
  /** Slug used in the downloaded PNG filename. */
  slug: string;
  className?: string;
}

export function StorefrontQrButton({
  url,
  displayName,
  slug,
  className,
}: StorefrontQrButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        aria-label="Show storefront QR code"
        onClick={() => setOpen(true)}
        className={className}
      >
        <QrCodeIcon className="h-5 w-5" />
        <span className="hidden sm:inline">QR code</span>
      </Button>
      <QrModal
        open={open}
        onOpenChange={setOpen}
        url={url}
        title={`Scan to visit ${displayName}'s shop`}
        subtitle="Point your phone camera at the code"
        filenameSlug={slug}
      />
    </>
  );
}
