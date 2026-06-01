"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  Plus,
  Star,
  StoreIcon,
  Trash2,
  Pencil,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { sanitizeSlugInput, MAX_STORE_SLUG_LEN } from "@/lib/slug-utils";

export interface StorefrontSummary {
  id: string;
  slug: string;
  display_name: string;
  catchphrase: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  hero_image_url: string | null;
  is_default: boolean;
}

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;
const MIN_SLUG_LEN = 3;

type FormShape = {
  slug: string;
  displayName: string;
  catchphrase: string;
  avatarUrl: string;
  bannerUrl: string;
  heroImageUrl: string;
};

const EMPTY_FORM: FormShape = {
  slug: "",
  displayName: "",
  catchphrase: "",
  avatarUrl: "",
  bannerUrl: "",
  heroImageUrl: "",
};

export function StorefrontsManager({
  initialStorefronts,
}: {
  initialStorefronts: StorefrontSummary[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [storefronts, setStorefronts] = useState(initialStorefronts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<StorefrontSummary | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (searchParams.get("newStorefront") === "1") {
      setEditing(null);
      setCreating(true);
    }
  }, [searchParams]);

  // Confirmation modal for delete is handled inline below the row to
  // keep the surface flat and avoid layering two dialogs.

  async function refresh() {
    const res = await fetch("/api/storefronts");
    if (!res.ok) return;
    const j = (await res.json()) as { storefronts?: StorefrontSummary[] };
    if (Array.isArray(j.storefronts)) setStorefronts(j.storefronts);
  }

  async function handleSetDefault(s: StorefrontSummary) {
    if (s.is_default) return;
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/storefronts/${s.id}/set-default`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not change default storefront");
      }
      toast.success(`Default storefront is now "${s.display_name}"`);
      await refresh();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch default");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(s: StorefrontSummary) {
    if (s.is_default) {
      toast.error(
        "Promote another storefront to default first — your default can't be deleted.",
      );
      return;
    }
    if (
      !window.confirm(
        `Delete the "${s.display_name}" storefront? This can't be undone. Products and orders stay on Gamerhood but the shop URL becomes unreachable.`,
      )
    ) {
      return;
    }
    setBusyId(s.id);
    try {
      const res = await fetch(`/api/storefronts/${s.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not delete storefront");
      }
      toast.success("Storefront deleted");
      await refresh();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved(updated: StorefrontSummary) {
    setStorefronts((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      if (exists) return prev.map((s) => (s.id === updated.id ? updated : s));
      // Newly created storefronts go after the defaults so the order is
      // stable: default first, then in creation order.
      const next = [...prev, updated];
      next.sort((a, b) =>
        a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1,
      );
      return next;
    });
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  return (
    <Card className="space-y-4 border-border/50 bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <StoreIcon className="h-5 w-5 text-primary" />
            Your storefronts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Run more than one shop from the same account — your personal art store, a{" "}
            <span className="font-medium text-foreground">family storefront</span> with
            your last name for grandparents and uncles to buy from, a fandom storefront
            for your gaming clan… each gets its own URL, banner, and look.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create a new storefront
        </Button>
      </div>

      <p className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        Payouts (Stripe Connect) and your creator XP / tier badge are{" "}
        <span className="font-medium text-foreground">shared across all your storefronts</span>
        . When you publish a new design, you&apos;ll pick which storefront it goes on.
      </p>

      <ul className="space-y-3">
        {storefronts.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border/50 bg-muted">
                {s.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                    {s.display_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{s.display_name}</span>
                  {s.is_default && (
                    <Badge
                      variant="outline"
                      className="border-primary/40 text-primary"
                    >
                      <Star className="mr-1 h-3 w-3 fill-current" />
                      Default
                    </Badge>
                  )}
                </div>
                <Link
                  href={`/shop/${s.slug}`}
                  className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
                >
                  /shop/{s.slug}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {s.catchphrase && (
                  <p className="mt-0.5 max-w-md truncate text-xs italic text-muted-foreground">
                    &ldquo;{s.catchphrase}&rdquo;
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!s.is_default && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSetDefault(s)}
                  disabled={busyId === s.id}
                  className="gap-1"
                >
                  {busyId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Star className="h-3.5 w-3.5" />
                  )}
                  Set as default
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreating(false);
                  setEditing(s);
                }}
                className="gap-1"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleDelete(s)}
                disabled={busyId === s.id || s.is_default}
                className="gap-1 text-muted-foreground hover:text-destructive"
                title={
                  s.is_default
                    ? "Promote another storefront first"
                    : "Delete this storefront"
                }
              >
                {busyId === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </Button>
            </div>
          </li>
        ))}
        {storefronts.length === 0 && (
          <li className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
            You don&apos;t have any storefronts yet. Create your first one to get a
            public shop URL.
          </li>
        )}
      </ul>

      <StorefrontEditorDialog
        open={creating || editing !== null}
        mode={creating ? "create" : "edit"}
        target={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
    </Card>
  );
}

type EditorProps = {
  open: boolean;
  mode: "create" | "edit";
  target: StorefrontSummary | null;
  onClose: () => void;
  onSaved: (s: StorefrontSummary) => void;
};

function StorefrontEditorDialog({ open, mode, target, onClose, onSaved }: EditorProps) {
  const [form, setForm] = useState<FormShape>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && target) {
      setForm({
        slug: target.slug,
        displayName: target.display_name,
        catchphrase: target.catchphrase ?? "",
        avatarUrl: target.avatar_url ?? "",
        bannerUrl: target.banner_url ?? "",
        heroImageUrl: target.hero_image_url ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [open, mode, target]);

  const slugValid = useMemo(
    () => form.slug.length >= MIN_SLUG_LEN && form.slug.length <= MAX_STORE_SLUG_LEN,
    [form.slug],
  );
  const nameValid = form.displayName.trim().length > 0;
  const canSubmit = slugValid && nameValid && !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    const payload = {
      slug: form.slug,
      displayName: form.displayName.trim(),
      catchphrase: form.catchphrase.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      bannerUrl: form.bannerUrl.trim() || null,
      heroImageUrl: form.heroImageUrl.trim() || null,
    };

    try {
      const res =
        mode === "edit" && target
          ? await fetch(`/api/storefronts/${target.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/storefronts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not save storefront");
      }
      const saved = (data.storefront ?? data) as StorefrontSummary;
      toast.success(mode === "edit" ? "Storefront updated" : "Storefront created");
      onSaved(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit storefront" : "Create a new storefront"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sf-slug">Shop URL</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-background pl-3">
              <span className="text-sm text-muted-foreground">/shop/</span>
              <Input
                id="sf-slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    slug: sanitizeSlugInput(e.target.value, MAX_STORE_SLUG_LEN),
                  }))
                }
                placeholder="the-ohye-family"
                className="border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                maxLength={MAX_STORE_SLUG_LEN}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens only. {MIN_SLUG_LEN}–
              {MAX_STORE_SLUG_LEN} characters.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-name">Display name</Label>
            <Input
              id="sf-name"
              value={form.displayName}
              onChange={(e) =>
                setForm((p) => ({ ...p, displayName: e.target.value }))
              }
              maxLength={MAX_DISPLAY_NAME_LEN}
              placeholder="The Ohye Family"
            />
            <p className="text-xs text-muted-foreground">
              Shown at the top of the shop. For a family storefront, this is usually
              your family&apos;s last name.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-catchphrase">Catchphrase (optional)</Label>
            <Textarea
              id="sf-catchphrase"
              value={form.catchphrase}
              onChange={(e) =>
                setForm((p) => ({ ...p, catchphrase: e.target.value }))
              }
              rows={2}
              maxLength={MAX_CATCHPHRASE_LEN}
              placeholder="Cousin merch since 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-avatar">Avatar image URL (optional)</Label>
            <Input
              id="sf-avatar"
              value={form.avatarUrl}
              onChange={(e) =>
                setForm((p) => ({ ...p, avatarUrl: e.target.value }))
              }
              placeholder="https://…"
              inputMode="url"
            />
            <p className="text-xs text-muted-foreground">
              Paste a hosted image link. Upload + axolotl picker are on the way; for
              now the default shop avatar shows when this is blank.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-banner">Banner image URL (optional)</Label>
            <Input
              id="sf-banner"
              value={form.bannerUrl}
              onChange={(e) =>
                setForm((p) => ({ ...p, bannerUrl: e.target.value }))
              }
              placeholder="https://…"
              inputMode="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-hero">Hero image URL (optional)</Label>
            <Input
              id="sf-hero"
              value={form.heroImageUrl}
              onChange={(e) =>
                setForm((p) => ({ ...p, heroImageUrl: e.target.value }))
              }
              placeholder="https://…"
              inputMode="url"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="gap-1 bg-primary hover:bg-primary/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {mode === "edit" ? "Save changes" : "Create storefront"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
