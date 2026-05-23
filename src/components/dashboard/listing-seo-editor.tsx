"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { sanitizeSlugInput, MAX_PRODUCT_CATEGORY_SLUG_LEN } from "@/lib/slug-utils";
import { ImageIcon, Upload, RefreshCw, Trash2 } from "lucide-react";

export interface ListingRow {
  id: string;
  title: string;
  tags: string;
  category: string;
  description: string;
  /** Listing card photo on `/shop/[slug]` and `/product/[id]` after you upload below. */
  mockupUrl: string;
  /** When set, dashboard can sync supplier description & size charts from Printful. */
  printfulCatalogVariantId?: number | null;
}

export function ListingSeoEditor({ listings }: { listings: ListingRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(listings);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingRow = pendingDeleteId ? rows.find((r) => r.id === pendingDeleteId) : null;

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
      toast.success("Listing removed from your shop");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove listing");
    }
  }

  async function uploadMockupCard(rowIndex: number, file: File) {
    const row = rows[rowIndex];
    const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Image is too large — use something under 8 MB.");
      return;
    }

    const dataUrl = await new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(file);
    }).catch(() => null);

    if (!dataUrl) {
      toast.error("Couldn't read that file");
      return;
    }

    const res = await fetch(`/api/products/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mockupImageDataUrl: dataUrl }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j.error || "Upload failed");
    }
    const url = typeof j.product?.mockup_url === "string" ? j.product.mockup_url : null;
    if (url) {
      setRows((prev) => {
        const next = [...prev];
        next[rowIndex] = { ...next[rowIndex], mockupUrl: url };
        return next;
      });
    }
    toast.success("Listing photo updated — check your shop");
  }

  async function save(row: ListingRow) {
    const res = await fetch(`/api/products/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tags: row.tags,
        category: row.category.trim() || null,
        description: row.description || undefined,
        seoDescription: row.description.trim() || null,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Save failed");
    }
    toast.success("Listing saved");
  }

  async function refreshPrintful(row: ListingRow) {
    const res = await fetch(`/api/products/${row.id}/refresh-printful`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Sync failed");
    toast.success("Printful sizing & description updated — reload the product page to see changes.");
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Publish at least one product from Create — then you can add tags and categories here.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {rows.map((row, i) => (
          <ListingEditorCard
            key={row.id}
            row={row}
            rowIndex={i}
            setRows={setRows}
            onRequestDelete={() => setPendingDeleteId(row.id)}
            onSaveListing={() => save(row).catch((e) => toast.error(e.message))}
            uploadMockup={(file) => uploadMockupCard(i, file).catch((e) => toast.error(e.message))}
            onRefreshPrintful={() => refreshPrintful(row).catch((e) => toast.error(e.message))}
          />
        ))}
      </div>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this listing?</DialogTitle>
            <DialogDescription className="text-pretty">
              {pendingRow?.title ?? "This product"} will disappear from your shop and the marketplace.
              Listings that have been purchased cannot be deleted (order history must stay intact).
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

function ListingEditorCard({
  row,
  rowIndex,
  setRows,
  onRequestDelete,
  onSaveListing,
  uploadMockup,
  onRefreshPrintful,
}: {
  row: ListingRow;
  rowIndex: number;
  setRows: Dispatch<SetStateAction<ListingRow[]>>;
  onRequestDelete: () => void;
  onSaveListing: () => void;
  uploadMockup: (file: File) => void;
  onRefreshPrintful: () => void;
}) {
  const mockupInputRef = useRef<HTMLInputElement>(null);

  function patchRow(patch: Partial<ListingRow>) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], ...patch };
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-4">
      <p className="text-sm font-medium line-clamp-2">{row.title}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
          {row.mockupUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.mockupUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" aria-hidden />
              No shop photo yet
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-medium text-foreground">Shop & product page image</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            This is what buyers see on your storefront grid and product page. Uploaded images are moderated
            the same way as new designs (PNG, JPG, WebP, GIF, SVG — max 8 MB).
          </p>
          <input
            ref={mockupInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMockup(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => mockupInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            {row.mockupUrl ? "Replace listing photo" : "Upload listing photo"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Tags (comma-separated, for search)</label>
          <Input
            value={row.tags}
            onChange={(e) => patchRow({ tags: e.target.value })}
            placeholder="gaming, anime, kids"
            className="mt-1"
            aria-describedby={`listing-tags-hint-${row.id}`}
          />
          <p id={`listing-tags-hint-${row.id}`} className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Used for discovery when people search the marketplace — not meta-keywords.
          </p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Category</label>
          <Input
            value={row.category}
            onChange={(e) =>
              patchRow({
                category: sanitizeSlugInput(e.target.value, MAX_PRODUCT_CATEGORY_SLUG_LEN),
              })
            }
            placeholder="lowercase-and-hyphens"
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Listing description (optional)</label>
        <Textarea
          value={row.description}
          onChange={(e) => patchRow({ description: e.target.value })}
          placeholder="Shown on the product page and in search snippets when set"
          className="mt-1 min-h-[72px] text-sm"
          rows={2}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onSaveListing}>
          Save listing
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!row.printfulCatalogVariantId}
          onClick={onRefreshPrintful}
          className="gap-2"
          title={
            row.printfulCatalogVariantId
              ? "Pull blank description, colors, sizes & size charts from Printful"
              : "No Printful variant id — configure PRINTFUL_*_VARIANT_ID and republish"
          }
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Sync Printful info
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRequestDelete}
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Remove listing
        </Button>
      </div>
    </div>
  );
}
