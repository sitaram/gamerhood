"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SlugTextInput } from "@/components/ui/slug-text-input";
import { toast } from "sonner";
import type { BrowseCategoryRow } from "@/lib/supabase/queries";
import {
  browsePathsForTagSlug,
  PLATFORM_TAG_EXAMPLES,
} from "@/lib/browse-categories/platform";
import { sanitizeSlugInput, MAX_BROWSE_CATEGORY_SLUG_LEN } from "@/lib/slug-utils";

type Props = {
  initial: BrowseCategoryRow[];
};

export function AdminBrowseCategoriesPanel({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  const platformRows = useMemo(
    () => rows.filter((r) => r.is_platform === true).sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );
  const otherRows = useMemo(
    () => rows.filter((r) => r.is_platform !== true).sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );

  async function refresh() {
    const res = await fetch("/api/browse-categories");
    const j = await res.json();
    if (res.ok && Array.isArray(j.categories)) setRows(j.categories);
  }

  function applyExample(example: (typeof PLATFORM_TAG_EXAMPLES)[number]) {
    setName(example.name);
    setSlug(example.slug);
    setSeoTitle(`${example.name} merch & hoodies`);
    setSeoDescription(
      `Shop ${example.name} hoodies, tees, and merch from independent creators on Gamerhood.`,
    );
    setKeywords(`${example.slug}, ${example.name.toLowerCase()} merch, ${example.name.toLowerCase()} hoodies`);
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
        isPlatform: true,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(j.error || "Could not create");
      return;
    }
    toast.success("Platform tag category created");
    setName("");
    setSlug("");
    setSeoTitle("");
    setSeoDescription("");
    setKeywords("");
    await refresh();
  }

  async function remove(slug: string) {
    if (!confirm(`Delete platform category “${slug}”? Browse URLs will fall back to auto titles.`)) return;
    const res = await fetch(`/api/browse-categories/${encodeURIComponent(slug)}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Delete failed");
      return;
    }
    toast.success("Deleted");
    await refresh();
  }

  const previewSlug = slug.trim() || sanitizeSlugInput(name, MAX_BROWSE_CATEGORY_SLUG_LEN);
  const previewPaths = previewSlug.length >= 2 ? browsePathsForTagSlug(previewSlug) : [];

  return (
    <div className="space-y-10">
      <Card className="border-primary/20 bg-card p-6">
        <h2 className="text-lg font-semibold">New tag category</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The <strong>URL slug</strong> must match the tag creators use on listings (e.g.{" "}
          <code className="rounded bg-muted px-1 text-xs">fortnite</code>). That powers pages like{" "}
          <code className="rounded bg-muted px-1 text-xs">/fortnite/hoodies</code> and{" "}
          <code className="rounded bg-muted px-1 text-xs">/fortnite/merch</code>.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PLATFORM_TAG_EXAMPLES.map((ex) => (
            <Button key={ex.slug} type="button" variant="outline" size="sm" onClick={() => applyExample(ex)}>
              {ex.name}
            </Button>
          ))}
        </div>

        <form onSubmit={create} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fortnite" required />
            </div>
            <div className="space-y-2">
              <Label>Tag slug (URL)</Label>
              <SlugTextInput
                value={slug}
                onChange={setSlug}
                placeholder="fortnite"
                maxLength={MAX_BROWSE_CATEGORY_SLUG_LEN}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>SEO title (optional)</Label>
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Fortnite merch & hoodies"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>Meta description (optional)</Label>
            <Textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={3}
              maxLength={320}
            />
          </div>
          <div className="space-y-2">
            <Label>Search terms (optional)</Label>
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="fortnite, fortnite merch, fortnite hoodies"
            />
          </div>

          {previewPaths.length > 0 && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
              <p className="font-medium text-foreground">Preview URLs</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {previewPaths.map((p) => (
                  <li key={p.path}>
                    <Link href={p.path} className="text-primary hover:underline" target="_blank">
                      {p.path}
                    </Link>
                    <span className="ml-2 text-xs">({p.label})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit">Create platform category</Button>
        </form>
      </Card>

      <section>
        <h2 className="text-lg font-semibold">Platform tag categories</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Official game / topic landings. Add more anytime — each slug unlocks hoodies, merch hub, and other browse
          paths automatically.
        </p>
        <ul className="mt-4 space-y-4">
          {platformRows.length === 0 && (
            <p className="text-sm text-muted-foreground">None yet — create Fortnite or Geometry Dash above.</p>
          )}
          {platformRows.map((row) => (
            <AdminCategoryRowEditor key={row.id} row={row} onSaved={refresh} onDelete={() => remove(row.slug)} />
          ))}
        </ul>
      </section>

      {otherRows.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Creator-defined categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">You can edit or delete any of these as platform admin.</p>
          <ul className="mt-4 space-y-4">
            {otherRows.map((row) => (
              <AdminCategoryRowEditor
                key={row.id}
                row={row}
                onSaved={refresh}
                onDelete={() => remove(row.slug)}
                showPromote
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AdminCategoryRowEditor({
  row,
  onSaved,
  onDelete,
  showPromote = false,
}: {
  row: BrowseCategoryRow;
  onSaved: () => Promise<void>;
  onDelete: () => void;
  showPromote?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug);
  const [seoTitle, setSeoTitle] = useState(row.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(row.seo_description ?? "");
  const [keywords, setKeywords] = useState((row.keywords ?? []).join(", "));

  const paths = browsePathsForTagSlug(row.slug);

  async function save(patch: Record<string, unknown> = {}) {
    const res = await fetch(`/api/browse-categories/${encodeURIComponent(row.slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug !== row.slug ? slug : undefined,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        keywords,
        ...patch,
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

  return (
    <Card className="border-border/50 bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {row.name}
            {row.is_platform && (
              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Platform
              </span>
            )}
          </p>
          <code className="text-xs text-muted-foreground">{row.slug}</code>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {paths.map((p) => (
              <Link key={p.path} href={p.path} className="text-primary hover:underline" target="_blank">
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPromote && (
            <Button type="button" variant="secondary" size="sm" onClick={() => save({ isPlatform: true })}>
              Mark platform
            </Button>
          )}
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
              <Label className="text-xs">Tag slug</Label>
              <SlugTextInput
                value={slug}
                onChange={setSlug}
                maxLength={MAX_BROWSE_CATEGORY_SLUG_LEN}
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
          </div>
          <Button type="button" size="sm" onClick={() => save()}>
            Save changes
          </Button>
        </div>
      )}
    </Card>
  );
}
