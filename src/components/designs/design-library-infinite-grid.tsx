"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DashboardDesignCard } from "@/components/dashboard/dashboard-designs-grid";

const STYLE_LABEL: Record<string, string> = {
  anime: "Anime",
  streetwear: "Streetwear",
  "pixel-art": "Pixel Art",
  graffiti: "Graffiti",
  minimalist: "Minimal",
  vaporwave: "Vaporwave",
  comic: "Comic",
  realistic: "Realistic",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type Props = {
  /** When false the hook stays idle (anon users on /create). */
  enabled: boolean;
  /** Bump to reload from the first page after a new save/generate. */
  refreshKey?: number;
  /** `pick` = click loads the design in the create flow; `manage` = edit/delete controls. */
  mode?: "pick" | "manage";
  onPick?: (design: DashboardDesignCard) => void;
  /** Optional heading — omit on pages that provide their own title. */
  title?: string;
  description?: string;
};

export function DesignLibraryInfiniteGrid({
  enabled,
  refreshKey = 0,
  mode = "manage",
  onPick,
  title,
  description,
}: Props) {
  const router = useRouter();
  const [designs, setDesigns] = useState<DashboardDesignCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const pendingDelete = pendingDeleteId
    ? designs.find((d) => d.id === pendingDeleteId)
    : null;

  const loadPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (!enabled || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: "24" });
        if (cursor) qs.set("cursor", cursor);
        const res = await fetch(`/api/designs?${qs.toString()}`);
        if (!res.ok) {
          throw new Error("Could not load your designs");
        }
        const data = (await res.json()) as {
          designs?: DashboardDesignCard[];
          nextCursor?: string | null;
        };
        const batch = Array.isArray(data.designs) ? data.designs : [];
        setDesigns((prev) => (replace ? batch : [...prev, ...batch]));
        setNextCursor(data.nextCursor ?? null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load designs");
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setInitialLoaded(true);
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    setDesigns([]);
    setNextCursor(null);
    setInitialLoaded(false);
    void loadPage(null, true);
  }, [enabled, refreshKey, loadPage]);

  useEffect(() => {
    if (!enabled || !nextCursor) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingRef.current) {
          void loadPage(nextCursor, false);
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, nextCursor, loadPage]);

  async function confirmDeleteDesign() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    try {
      const res = await fetch(`/api/designs/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Delete failed");
      }
      setDesigns((prev) => prev.filter((d) => d.id !== id));
      setPendingDeleteId(null);
      toast.success("Design removed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete design");
    }
  }

  function handleCardActivate(d: DashboardDesignCard) {
    if (mode === "pick" && onPick) {
      onPick(d);
      return;
    }
    router.push(`/create?designId=${d.id}`);
  }

  if (!enabled) return null;

  return (
    <>
      {(title || description) && (
        <div className="mb-6">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}

      {!initialLoaded && loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : designs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed border-border/50 bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing saved yet — generate or upload something above and it&apos;ll appear here
            automatically.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.map((d) => (
              <Card
                key={d.id}
                className="group overflow-hidden border-border/50 bg-card transition-all hover:border-primary/40"
              >
                <button
                  type="button"
                  onClick={() => handleCardActivate(d)}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-square overflow-hidden bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.image_url}
                      alt={d.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                </button>
                <div className="p-4">
                  <p className="line-clamp-2 text-sm text-foreground">
                    {d.prompt || d.title}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/30 text-xs text-primary">
                        {STYLE_LABEL[d.style] || d.style}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(d.created_at)}</span>
                    </div>
                    {mode === "manage" && (
                      <div className="flex items-center gap-1">
                        <Link href={`/create?designId=${d.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setPendingDeleteId(d.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div ref={sentinelRef} className="flex justify-center py-8">
            {loading && nextCursor && (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
        </>
      )}

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this design?</DialogTitle>
            <DialogDescription className="text-pretty">
              {pendingDelete
                ? `“${(pendingDelete.prompt || pendingDelete.title).slice(0, 120)}${(pendingDelete.prompt || pendingDelete.title).length > 120 ? "…" : ""}”`
                : ""}{" "}
              and any storefront listings that use it will be removed. You can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDeleteDesign()}>
              Delete design
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
