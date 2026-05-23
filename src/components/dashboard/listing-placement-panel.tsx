"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MerchPlacementPreview } from "@/components/create/merch-placement-preview";
import { PrintPlacementEditor } from "@/components/create/print-placement-editor";
import { DEFAULT_STORED } from "@/lib/print/placement";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import type { ProductType } from "@/lib/types";
import { PRODUCT_TYPE_LABELS, shouldFallbackToPrintfulMockupCard } from "@/components/storefront/product-card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export interface PlacementListingRow {
  id: string;
  title: string;
  productType: ProductType;
  designImageUrl: string | null;
  mockupUrl: string | null;
  printPlacement: StoredPrintPlacement | null;
}

export function ListingPlacementPanel({ listings }: { listings: PlacementListingRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(listings);
  const [active, setActive] = useState<PlacementListingRow | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteRow = pendingDeleteId ? rows.find((r) => r.id === pendingDeleteId) : null;
  const [draft, setDraft] = useState<StoredPrintPlacement>(DEFAULT_STORED);

  const handleDraftAspect = useCallback((aspect: number) => {
    setDraft((prev) => (prev.imageAspect === aspect ? prev : { ...prev, imageAspect: aspect }));
  }, []);

  function openEditor(row: PlacementListingRow) {
    setDraft({ ...(row.printPlacement ?? DEFAULT_STORED) });
    setActive(row);
  }

  async function saveDraft() {
    if (!active?.designImageUrl) {
      toast.error("Missing design image for this listing.");
      return;
    }
    const res = await fetch(`/api/products/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printPlacement: draft }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j.error === "string" ? j.error : "Could not save placement");
      return;
    }
    const productRow = j.product as { mockup_url?: string } | undefined;
    const nextMockup =
      typeof productRow?.mockup_url === "string" ? productRow.mockup_url : active.mockupUrl;
    setRows((prev) =>
      prev.map((r) =>
        r.id === active.id
          ? { ...r, printPlacement: draft, mockupUrl: nextMockup }
          : r,
      ),
    );
    setActive(null);
    toast.success("Print placement saved");
  }

  async function confirmDeleteListing() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Delete failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setPendingDeleteId(null);
      if (active?.id === id) setActive(null);
      toast.success("Listing removed from your shop");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove listing");
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Publish from Create first — then you can adjust how art sits on each product type here.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => {
          const placement = row.printPlacement ?? DEFAULT_STORED;
          const label = PRODUCT_TYPE_LABELS[row.productType] || row.productType;
          return (
            <Card key={row.id} className="border-border/50 bg-card p-4">
              <div className="flex gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {!shouldFallbackToPrintfulMockupCard(row.designImageUrl) ? (
                    <MerchPlacementPreview
                      imageUrl={row.designImageUrl!}
                      productType={row.productType}
                      placement={placement}
                    />
                  ) : row.mockupUrl?.trim() ? (
                    <Image
                      src={row.mockupUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
                      No artwork preview
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{row.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 mr-2"
                    disabled={!row.designImageUrl}
                    onClick={() => openEditor(row)}
                  >
                    Tune placement
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDeleteId(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Placement —{" "}
              {active ? PRODUCT_TYPE_LABELS[active.productType] || active.productType : ""}
            </DialogTitle>
          </DialogHeader>
          {active?.designImageUrl && (
            <PrintPlacementEditor
              imageUrl={active.designImageUrl}
              selectedProductTypes={new Set<ProductType>([active.productType])}
              value={draft}
              onChange={setDraft}
              onAspectDetected={handleDraftAspect}
              hideBatchPlacementNote
            />
          )}
          <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => void saveDraft()}>
              Save placement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this listing?</DialogTitle>
            <DialogDescription className="text-pretty">
              {pendingDeleteRow?.title ?? "This product"} will disappear from your shop. Purchased listings cannot be
              deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDeleteListing()}>
              Remove listing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
