"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type DashboardDesignCard = {
  id: string;
  title: string;
  prompt: string | null;
  image_url: string;
  style: string;
  created_at: string;
};

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

export function DashboardDesignsGrid({ designs }: { designs: DashboardDesignCard[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(designs);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDelete = pendingDeleteId ? rows.find((d) => d.id === pendingDeleteId) : null;

  async function confirmDeleteDesign() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    try {
      const res = await fetch(`/api/designs/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Delete failed");
      }
      setRows((prev) => prev.filter((d) => d.id !== id));
      setPendingDeleteId(null);
      toast.success("Design removed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete design");
    }
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((d) => (
          <Card
            key={d.id}
            className="group overflow-hidden border-border/50 bg-card transition-all hover:border-primary/40"
          >
            <div className="relative aspect-square overflow-hidden bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.image_url}
                alt={d.title}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm text-foreground">{d.prompt || d.title}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-xs text-primary">
                    {STYLE_LABEL[d.style] || d.style}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(d.created_at)}</span>
                </div>
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
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this design?</DialogTitle>
            <DialogDescription className="text-pretty">
              {pendingDelete
                ? `“${(pendingDelete.prompt || pendingDelete.title).slice(0, 120)}${(pendingDelete.prompt || pendingDelete.title).length > 120 ? "…" : ""}”`
                : ""}{" "}
              and any storefront listings that use it will be removed. You can’t undo this. If anything from this
              design was ever purchased, deletion is blocked until those listings no longer have order history.
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
