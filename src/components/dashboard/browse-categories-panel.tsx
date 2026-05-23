"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { buildBrowsePath, PRODUCT_TYPE_TO_BROWSE_SEGMENT } from "@/lib/browse-routes";
import type { BrowseCategoryRow } from "@/lib/supabase/queries";
import type { ProductType } from "@/lib/types";
import { sanitizeSlugInput, MAX_BROWSE_CATEGORY_SLUG_LEN } from "@/lib/slug-utils";

type Props = {
  userId: string;
  initial: BrowseCategoryRow[];
};

const EXAMPLE_TYPE: ProductType = "hoodie";

export function BrowseCategoriesPanel({ userId, initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  async function refresh() {
    const res = await fetch("/api/browse-categories");
    const j = await res.json();
    if (res.ok && Array.isArray(j.categories)) setRows(j.categories);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/browse-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug.trim() || undefined,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        keywords,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(j.error || "Could not create");
      return;
    }
    toast.success("Category created");
    setName("");
    setSlug("");
    setSeoTitle("");
    setSeoDescription("");
    setKeywords("");
    await refresh();
  }

  async function remove(slug: string, canDelete: boolean) {
    if (!canDelete) return;
    if (!confirm(`Delete category “${slug}”? Products keep their category text; browse URLs will use fallbacks.`)) return;
    const res = await fetch(`/api/browse-categories/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Delete failed");
      return;
    }
    toast.success("Deleted");
    await refresh();
  }

  return (
    <div className="space-y-10">
      <Card className="border-border/50 bg-card p-6">
        <h2 className="text-lg font-semibold">New SEO category</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Defines landing pages like{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            /your-slug/{PRODUCT_TYPE_TO_BROWSE_SEGMENT[EXAMPLE_TYPE]}
          </code>{" "}
          with custom title, description, and keyword meta. Use the same slug as your product{" "}
          <strong>category</strong> (or tag) so listings appear on that URL.
        </p>

        <form onSubmit={create} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fortnite inspired" required />
            </div>
            <div className="space-y-2">
              <Label>URL slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(sanitizeSlugInput(e.target.value, MAX_BROWSE_CATEGORY_SLUG_LEN))}
                placeholder="fortnite-inspired (auto from display name if empty)"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>SEO title (optional)</Label>
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Overrides browser tab title for this theme"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>Meta description (optional)</Label>
            <Textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="Shown in Google snippets for /your-slug/* pages"
              rows={3}
              maxLength={320}
            />
          </div>
          <div className="space-y-2">
            <Label>Search terms (optional)</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="battle royale, fortnite merch, gaming (comma-separated)"
            />
            <p className="text-xs text-muted-foreground">
              Phrases people might look for when finding this kind of merch — for search relevance and rich results,
              not legacy HTML meta-keywords.
            </p>
          </div>
          <Button type="submit">Create category</Button>
        </form>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Your categories</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You can edit or delete only the rows you created. Example product browse URL:
        </p>
        <ul className="mt-4 space-y-4">
          {rows.filter((r) => r.created_by === userId).length === 0 && (
            <p className="text-sm text-muted-foreground">None yet — create one above.</p>
          )}
          {rows
            .filter((r) => r.created_by === userId)
            .map((row) => (
              <CategoryRowEditor
                key={row.id}
                row={row}
                userId={userId}
                onSaved={refresh}
                onDelete={() => remove(row.slug, true)}
              />
            ))}
        </ul>
      </div>

      {rows.some((r) => r.created_by !== userId) && (
        <div>
          <h2 className="text-lg font-semibold">Community categories</h2>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {rows
              .filter((r) => r.created_by !== userId)
              .map((r) => (
                <li key={r.id}>
                  <span className="font-medium text-foreground">{r.name}</span>{" "}
                  <code className="rounded bg-muted px-1 text-xs">{r.slug}</code> ·{" "}
                  <Link href={buildBrowsePath(r.slug, EXAMPLE_TYPE)} className="text-primary hover:underline">
                    Preview
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CategoryRowEditor({
  row,
  userId,
  onSaved,
  onDelete,
}: {
  row: BrowseCategoryRow;
  userId: string;
  onSaved: () => Promise<void>;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug);
  const [seoTitle, setSeoTitle] = useState(row.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(row.seo_description ?? "");
  const [keywords, setKeywords] = useState((row.keywords ?? []).join(", "));

  async function save() {
    const res = await fetch(`/api/browse-categories/${encodeURIComponent(row.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug !== row.slug ? slug : undefined,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        keywords,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(j.error || "Save failed");
      return;
    }
    toast.success("Saved");
    setOpen(false);
    await onSaved();
  }

  if (row.created_by !== userId) return null;

  return (
    <Card className="border-border/50 bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">{row.name}</p>
          <code className="text-xs text-muted-foreground">{row.slug}</code>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <Link
              href={buildBrowsePath(row.slug, EXAMPLE_TYPE)}
              className="text-primary hover:underline"
            >
              Preview {buildBrowsePath(row.slug, EXAMPLE_TYPE)}
            </Link>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Edit"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(sanitizeSlugInput(e.target.value, MAX_BROWSE_CATEGORY_SLUG_LEN))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SEO title</Label>
            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Meta description</Label>
            <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Search terms</Label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              For how people search this topic — not meta-keywords tags.
            </p>
          </div>
          <Button type="button" size="sm" onClick={save}>
            Save changes
          </Button>
        </div>
      )}
    </Card>
  );
}
