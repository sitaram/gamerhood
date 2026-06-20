"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { siteUrl } from "@/lib/site";
import type { ProfileRow } from "@/lib/supabase/queries";
import { SlugTextInput } from "@/components/ui/slug-text-input";
import { MAX_STORE_SLUG_LEN } from "@/lib/slug-utils";
import { showXpToasts } from "@/components/xp/show-xp-toasts";

type Props = {
  initial: ProfileRow;
  shopPath: string;
};

export function StorefrontSettingsForm({ initial, shopPath }: Props) {
  const baseUrl = useMemo(() => siteUrl(), []);
  const [slug, setSlug] = useState(initial.slug);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [headline, setHeadline] = useState(initial.storefront_headline ?? "");
  const [subhead, setSubhead] = useState(initial.storefront_subhead ?? "");
  const [overlay, setOverlay] = useState(initial.storefront_hero_overlay ?? "dark");
  const [seoTitle, setSeoTitle] = useState(initial.store_seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(initial.store_seo_description ?? "");
  const [storeTags, setStoreTags] = useState((initial.store_tags ?? []).join(", "));
  const [heroPreview, setHeroPreview] = useState<string | null>(
    initial.storefront_hero_image_url ?? null,
  );
  const [saving, setSaving] = useState(false);

  const previewUrl = `${baseUrl}/shop/${slug}`;

  async function saveField(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/storefront/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not save");
      toast.success("Saved");
      if (j.profile?.slug) setSlug(j.profile.slug as string);
      if (j.profile?.storefront_hero_image_url !== undefined) {
        setHeroPreview((j.profile.storefront_hero_image_url as string | null) ?? null);
      }
      if (Array.isArray(j.xpAwards)) showXpToasts(j.xpAwards);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onHeroFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (dataUrl) {
        saveField({ heroImageDataUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-8">
      <Card className="border-border/50 bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Shop URL</h2>
        <p className="text-sm text-muted-foreground">
          Your storefront lives at a public link you can share. You can change the last segment anytime;
          old links will stop working, so update social bios after a rename.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Slug</Label>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground whitespace-nowrap">{baseUrl}/shop/</span>
              <SlugTextInput
                value={slug}
                onChange={setSlug}
                className="font-mono text-sm"
                placeholder="my-shop-name"
                maxLength={MAX_STORE_SLUG_LEN}
              />
            </div>
          </div>
          <Button type="button" disabled={saving || slug === initial.slug} onClick={() => saveField({ slug })}>
            Update URL
          </Button>
        </div>
        <Link href={shopPath} className="text-sm text-primary hover:underline">
          View live shop →
        </Link>
        <p className="text-xs text-muted-foreground break-all">Canonical: {previewUrl}</p>
      </Card>

      <Card className="border-border/50 bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Homepage hero</h2>
        <p className="text-sm text-muted-foreground">
          Upload a wide photo for the top of your shop — like a banner. Add a headline and optional
          subheading; pick an overlay so text stays readable.
        </p>
        {heroPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPreview}
            alt=""
            className="w-full max-h-48 rounded-lg object-cover border border-border/50"
          />
        )}
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
            <input type="file" accept="image/*" className="hidden" onChange={onHeroFile} />
            {heroPreview ? "Replace hero image" : "Upload hero image"}
          </label>
          {heroPreview && (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                saveField({ clearHeroImage: true }).then(() => setHeroPreview(null))
              }
            >
              Remove hero
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Headline (optional)</Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={`Defaults to "${initial.display_name}"`}
            />
          </div>
          <div className="space-y-2">
            <Label>Overlay</Label>
            <Select
              value={overlay || "dark"}
              onValueChange={(v) => {
                if (v) setOverlay(v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="gradient">Gradient bottom</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Subheading (optional)</Label>
          <Textarea
            value={subhead}
            onChange={(e) => setSubhead(e.target.value)}
            rows={2}
            placeholder="Short tagline under the headline"
          />
        </div>
        <Button
          type="button"
          disabled={saving}
          onClick={() =>
            saveField({
              storefrontHeadline: headline.trim() || null,
              storefrontSubhead: subhead.trim() || null,
              storefrontHeroOverlay: overlay,
            })
          }
        >
          Save hero text
        </Button>
      </Card>

      <Card className="border-border/50 bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Store bio</h2>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
        <Button type="button" disabled={saving} onClick={() => saveField({ bio })}>
          Save bio
        </Button>
      </Card>

      <Card className="border-border/50 bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">SEO (search & sharing)</h2>
        <p className="text-sm text-muted-foreground">
          Page title and meta description shape how your shop shows up in previews. Store tags are for{' '}
          <strong className="font-medium text-foreground">search and discovery</strong> — they are not for
          legacy HTML “meta keywords”.
        </p>
        <div className="space-y-2">
          <Label>Page title (optional)</Label>
          <Input
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder={`${initial.display_name} — custom merch`}
            maxLength={70}
          />
        </div>
        <div className="space-y-2">
          <Label>Meta description (optional)</Label>
          <Textarea
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            rows={3}
            maxLength={320}
            placeholder="One or two sentences for Google and social previews."
          />
        </div>
        <div className="space-y-2">
          <Label>Store search tags</Label>
          <Input
            value={storeTags}
            onChange={(e) => setStoreTags(e.target.value)}
            placeholder="gaming, kids, anime"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated. Helps people match your shop to what they&apos;re searching for — not meta-keywords markup.
          </p>
        </div>
        <Button
          type="button"
          disabled={saving}
          onClick={() =>
            saveField({
              storeSeoTitle: seoTitle.trim() || null,
              storeSeoDescription: seoDesc.trim() || null,
              storeTags: storeTags
                .split(/[,]+/)
                .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""))
                .filter(Boolean)
                .slice(0, 24),
            })
          }
        >
          Save SEO
        </Button>
      </Card>
    </div>
  );
}
