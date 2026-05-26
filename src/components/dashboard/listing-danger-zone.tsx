"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ListingDangerZone({
  productId,
  productTitle,
  initialIsPublished,
}: {
  productId: string;
  productTitle: string;
  initialIsPublished: boolean;
}) {
  const router = useRouter();
  const [isPublished, setIsPublished] = useState(initialIsPublished);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleVisibility(next: boolean) {
    // Optimistic flip so the switch feels snappy. We roll back on error.
    setIsPublished(next);
    setTogglingVisibility(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Could not update");
      }
      toast.success(
        next
          ? "Listing is live again — buyers can see it on your shop"
          : "Listing hidden — only you can see it now",
      );
      router.refresh();
    } catch (e) {
      setIsPublished(!next);
      toast.error(e instanceof Error ? e.message : "Could not update visibility");
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function deleteListing() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Could not delete listing");
      }
      toast.success("Listing deleted");
      router.push("/dashboard/listings");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete listing");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/[0.04] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
        <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <EyeOff className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium">Hide from shop</p>
            <p className="text-xs text-muted-foreground">
              Hides the listing from public storefront pages. You can flip it
              back on any time — order history is preserved either way.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isPublished ? "Live" : "Hidden"}
          </span>
          <Switch
            checked={!isPublished}
            disabled={togglingVisibility}
            onCheckedChange={(checked) => void toggleVisibility(!checked)}
            aria-label="Hide from shop"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-destructive/20 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Trash2 className="mt-0.5 h-4 w-4 text-destructive" aria-hidden />
          <div>
            <p className="text-sm font-medium">Delete listing</p>
            <p className="text-xs text-muted-foreground">
              Permanent. Listings that have been purchased can&apos;t be deleted —
              hide them instead so order history stays intact.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete listing
        </Button>
      </div>

      <Dialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!deleting) setConfirmDelete(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription className="text-pretty">
              <span className="font-medium text-foreground">{productTitle}</span>{" "}
              will be removed from your shop and the marketplace. This can&apos;t
              be undone. Listings with purchase history can&apos;t be deleted —
              hide them from the shop instead.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteListing()}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete listing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
