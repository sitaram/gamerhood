"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  DEFAULT_AVATAR_POOL,
  getDisplayAvatar,
  getStorefrontAvatar,
  profileInitials,
} from "@/lib/profile-avatar";
import { cn } from "@/lib/utils";
import { XpBadge } from "@/components/xp/xp-badge";
import { showXpToasts } from "@/components/xp/show-xp-toasts";
import { XP_RULES } from "@/lib/xp/rules";

const DEFAULT_AVATAR_SET: ReadonlySet<string> = new Set(DEFAULT_AVATAR_POOL);

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_BANNER_BYTES = 4 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
// Storefront banner aspect-ratio guidance. We accept anything close to this
// but warn the creator if their image is meaningfully off-ratio so they're
// not surprised by `object-cover` cropping on the live page.
const RECOMMENDED_BANNER_RATIO = 16 / 5;
const BANNER_RATIO_TOLERANCE = 0.4;

const AXOLOTL_DESIGN_FIELD_MAX = 80;
// Mirrors the server-side rate limit in /api/account/generate-axolotl
// — keeps the Generate button locked client-side so a kid clicking
// "Try again" rapid-fire doesn't get a 429 toast in their face.
const AXOLOTL_DESIGN_COOLDOWN_MS = 15_000;
const AXOLOTL_REFERENCE_IMAGE_PATH = "/brand/axolotl-style-reference.png";

type Props = {
  initialDisplayName: string;
  initialCatchphrase: string | null;
  initialAvatarUrl: string | null;
  initialStorefrontAvatarUrl: string | null;
  initialStorefrontBannerUrl: string | null;
  /**
   * Used to pick which bundled axolotl to preview when the creator
   * hasn't uploaded a photo yet — matches what the rest of the site
   * will show for this profile.
   */
  profileId: string;
  email: string | null;
  hasEmailPassword: boolean;
};

export function ProfileSettingsForm({
  initialDisplayName,
  initialCatchphrase,
  initialAvatarUrl,
  initialStorefrontAvatarUrl,
  initialStorefrontBannerUrl,
  profileId,
  email,
  hasEmailPassword,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [catchphrase, setCatchphrase] = useState(initialCatchphrase ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [storefrontAvatarUrl, setStorefrontAvatarUrl] = useState<string | null>(
    initialStorefrontAvatarUrl,
  );
  const [storefrontBannerUrl, setStorefrontBannerUrl] = useState<string | null>(
    initialStorefrontBannerUrl,
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCatchphrase, setSavingCatchphrase] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [storefrontAvatarBusy, setStorefrontAvatarBusy] = useState(false);
  const [storefrontBannerBusy, setStorefrontBannerBusy] = useState(false);

  const [personalGalleryOpen, setPersonalGalleryOpen] = useState(false);
  const [storefrontGalleryOpen, setStorefrontGalleryOpen] = useState(false);
  const [personalDesignerOpen, setPersonalDesignerOpen] = useState(false);
  const [storefrontDesignerOpen, setStorefrontDesignerOpen] = useState(false);

  const initials = useMemo(() => profileInitials(displayName), [displayName]);
  const personalPreviewUrl = getDisplayAvatar({ id: profileId, avatar_url: avatarUrl });
  const storefrontPreviewUrl = getStorefrontAvatar({
    id: profileId,
    avatar_url: avatarUrl,
    storefront_avatar_url: storefrontAvatarUrl,
  });
  const usingDefaultPersonal = !avatarUrl;
  const usingPersonalOnStorefront = !storefrontAvatarUrl;
  const personalGalleryPick = avatarUrl && DEFAULT_AVATAR_SET.has(avatarUrl) ? avatarUrl : null;
  const storefrontGalleryPick =
    storefrontAvatarUrl && DEFAULT_AVATAR_SET.has(storefrontAvatarUrl)
      ? storefrontAvatarUrl
      : null;

  async function patchProfile(body: Record<string, unknown>) {
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Could not save");
    }
    if (typeof data.displayName === "string") setDisplayName(data.displayName);
    if (data.catchphrase !== undefined) {
      setCatchphrase(typeof data.catchphrase === "string" ? data.catchphrase : "");
    }
    if (data.avatarUrl !== undefined) {
      setAvatarUrl(typeof data.avatarUrl === "string" ? data.avatarUrl : null);
    }
    if (data.storefrontAvatarUrl !== undefined) {
      setStorefrontAvatarUrl(
        typeof data.storefrontAvatarUrl === "string" ? data.storefrontAvatarUrl : null,
      );
    }
    if (data.storefrontBannerUrl !== undefined) {
      setStorefrontBannerUrl(
        typeof data.storefrontBannerUrl === "string" ? data.storefrontBannerUrl : null,
      );
    }
    if (Array.isArray(data.xpAwards)) {
      showXpToasts(data.xpAwards);
    }
    router.refresh();
    return data;
  }

  async function handleSaveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("Display name cannot be empty");
      return;
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LEN) {
      toast.error(`Display name must be ${MAX_DISPLAY_NAME_LEN} characters or fewer`);
      return;
    }

    setSavingProfile(true);
    try {
      await patchProfile({ displayName: trimmed });
      toast.success("Display name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveCatchphrase() {
    const trimmed = catchphrase.trim();
    if (trimmed.length > MAX_CATCHPHRASE_LEN) {
      toast.error(`Catchphrase must be ${MAX_CATCHPHRASE_LEN} characters or fewer`);
      return;
    }

    setSavingCatchphrase(true);
    try {
      await patchProfile({ catchphrase: trimmed || null });
      toast.success("Catchphrase updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingCatchphrase(false);
    }
  }

  function validateAvatarFile(file: File): string | null {
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      return "Please upload PNG, JPG, or WebP";
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return "Photo must be 2 MB or smaller";
    }
    return null;
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const error = validateAvatarFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setAvatarBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await patchProfile({ avatarImageDataUrl: dataUrl });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarBusy(true);
    try {
      await patchProfile({ clearAvatar: true });
      toast.success("Picked a random axolotl for you");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset photo");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handlePickDefaultAvatar(pick: string) {
    if (!DEFAULT_AVATAR_SET.has(pick)) return;
    setAvatarBusy(true);
    try {
      await patchProfile({ pickDefaultAvatar: pick });
      toast.success("Profile axolotl updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pick axolotl");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onStorefrontAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const error = validateAvatarFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setStorefrontAvatarBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await patchProfile({ storefrontAvatarImageDataUrl: dataUrl });
      toast.success("Storefront photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setStorefrontAvatarBusy(false);
    }
  }

  async function handleClearStorefrontAvatar() {
    setStorefrontAvatarBusy(true);
    try {
      await patchProfile({ clearStorefrontAvatar: true });
      toast.success("Storefront photo cleared — using your profile photo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear photo");
    } finally {
      setStorefrontAvatarBusy(false);
    }
  }

  async function handlePickDefaultStorefrontAvatar(pick: string) {
    if (!DEFAULT_AVATAR_SET.has(pick)) return;
    setStorefrontAvatarBusy(true);
    try {
      await patchProfile({ pickDefaultStorefrontAvatar: pick });
      toast.success("Storefront axolotl updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not pick axolotl");
    } finally {
      setStorefrontAvatarBusy(false);
    }
  }

  function validateBannerFile(file: File): string | null {
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      return "Please upload PNG, JPG, or WebP";
    }
    if (file.size > MAX_BANNER_BYTES) {
      return "Banner must be 4 MB or smaller";
    }
    return null;
  }

  async function onStorefrontBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const error = validateBannerFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setStorefrontBannerBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const ratio = await readImageAspectRatio(dataUrl);
      await patchProfile({ storefrontBannerImageDataUrl: dataUrl });
      // Server accepts off-ratio images (we don't reject them) but warn the
      // creator so they're not surprised by the live page cropping.
      if (
        ratio !== null &&
        Math.abs(ratio - RECOMMENDED_BANNER_RATIO) > BANNER_RATIO_TOLERANCE
      ) {
        toast.success("Banner uploaded — it's off from 16:5, so it may crop on your shop page.");
      } else {
        toast.success("Storefront banner updated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload banner");
    } finally {
      setStorefrontBannerBusy(false);
    }
  }

  async function handleClearStorefrontBanner() {
    setStorefrontBannerBusy(true);
    try {
      await patchProfile({ clearStorefrontBanner: true });
      toast.success("Storefront banner cleared — using the default look");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear banner");
    } finally {
      setStorefrontBannerBusy(false);
    }
  }

  function handleAiAxolotlSaved(slot: "personal" | "storefront", url: string) {
    if (slot === "storefront") {
      setStorefrontAvatarUrl(url);
    } else {
      setAvatarUrl(url);
    }
    router.refresh();
  }

  const displayNameDirty = displayName.trim() !== initialDisplayName.trim();
  const catchphraseDirty =
    catchphrase.trim() !== (initialCatchphrase?.trim() ?? "");

  return (
    <div className="space-y-8">
      <Card className="space-y-4 border-border/50 bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Profile photo</h2>
          <XpBadge points={XP_RULES.AVATAR_CUSTOM.points} variant="prominent" />
        </div>
        <p className="text-sm text-muted-foreground">
          A friendly photo or avatar for your shop and dashboard. PNG, JPG, or WebP up to 2 MB.
          Images are checked for kid-safe content.
        </p>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-40 w-40 shrink-0 ring-2 ring-primary/30 shadow-xl shadow-primary/20">
            <AvatarImage src={personalPreviewUrl} alt={displayName} />
            <AvatarFallback className="bg-primary/20 text-3xl font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            {usingDefaultPersonal && (
              <p className="text-xs text-muted-foreground">
                Using one of our default Gamerhood axolotls. Upload your own, or pick a favorite below.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onAvatarFile}
                  disabled={avatarBusy}
                />
                {avatarBusy ? "Working…" : avatarUrl ? "Replace photo" : "Upload photo"}
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={avatarBusy}
                aria-expanded={personalGalleryOpen}
                aria-controls="personal-axolotl-gallery"
                onClick={() => setPersonalGalleryOpen((open) => !open)}
              >
                {personalGalleryOpen ? "Hide gallery" : "Choose from gallery"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={avatarBusy}
                aria-expanded={personalDesignerOpen}
                aria-controls="personal-axolotl-designer"
                onClick={() => setPersonalDesignerOpen((open) => !open)}
              >
                {personalDesignerOpen ? "Hide designer" : "Design your own axolotl"}
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={avatarBusy}
                  onClick={() => void handleRemoveAvatar()}
                >
                  Use a random axolotl
                </Button>
              )}
            </div>
          </div>
        </div>
        {personalGalleryOpen && (
          <AxolotlGallery
            id="personal-axolotl-gallery"
            selected={personalGalleryPick}
            busy={avatarBusy}
            onPick={(url) => void handlePickDefaultAvatar(url)}
          />
        )}
        {personalDesignerOpen && (
          <AxolotlDesigner
            id="personal-axolotl-designer"
            slot="personal"
            onSaved={(url) => handleAiAxolotlSaved("personal", url)}
            onClose={() => setPersonalDesignerOpen(false)}
          />
        )}
      </Card>

      <Card className="space-y-4 border-border/50 bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Storefront photo (optional)</h2>
          <XpBadge points={XP_RULES.STOREFRONT_AVATAR.points} variant="prominent" />
        </div>
        <p className="text-sm text-muted-foreground">
          Shown on your public shop page only. Leave blank to use your profile photo
          everywhere — including the shop. PNG, JPG, or WebP up to 2 MB. Same kid-safe
          check applies.
        </p>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar className="h-40 w-40 shrink-0 ring-2 ring-accent/40 shadow-xl shadow-accent/20">
            <AvatarImage src={storefrontPreviewUrl} alt={`${displayName} storefront`} />
            <AvatarFallback className="bg-accent/20 text-3xl font-semibold text-accent">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {usingPersonalOnStorefront
                ? "Your shop is currently showing your profile photo. Upload a different one to override it just for the shop."
                : "Your shop is showing this photo instead of your profile photo."}
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onStorefrontAvatarFile}
                  disabled={storefrontAvatarBusy}
                />
                {storefrontAvatarBusy
                  ? "Working…"
                  : storefrontAvatarUrl
                    ? "Replace storefront photo"
                    : "Upload storefront photo"}
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={storefrontAvatarBusy}
                aria-expanded={storefrontGalleryOpen}
                aria-controls="storefront-axolotl-gallery"
                onClick={() => setStorefrontGalleryOpen((open) => !open)}
              >
                {storefrontGalleryOpen ? "Hide gallery" : "Choose from gallery"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={storefrontAvatarBusy}
                aria-expanded={storefrontDesignerOpen}
                aria-controls="storefront-axolotl-designer"
                onClick={() => setStorefrontDesignerOpen((open) => !open)}
              >
                {storefrontDesignerOpen ? "Hide designer" : "Design your own axolotl"}
              </Button>
              {storefrontAvatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={storefrontAvatarBusy}
                  onClick={() => void handleClearStorefrontAvatar()}
                >
                  Use my profile photo instead
                </Button>
              )}
            </div>
          </div>
        </div>
        {storefrontGalleryOpen && (
          <AxolotlGallery
            id="storefront-axolotl-gallery"
            selected={storefrontGalleryPick}
            busy={storefrontAvatarBusy}
            onPick={(url) => void handlePickDefaultStorefrontAvatar(url)}
          />
        )}
        {storefrontDesignerOpen && (
          <AxolotlDesigner
            id="storefront-axolotl-designer"
            slot="storefront"
            onSaved={(url) => handleAiAxolotlSaved("storefront", url)}
            onClose={() => setStorefrontDesignerOpen(false)}
          />
        )}
      </Card>

      <Card className="space-y-4 border-border/50 bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Storefront banner (optional)</h2>
          <XpBadge
            points={XP_RULES.STOREFRONT_BANNER_UPLOAD.points}
            variant="prominent"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Shown at the top of your public shop page. Leave blank to use the default gradient.
          PNG, JPG, or WebP up to 4 MB. Same kid-safe check applies.
        </p>
        <div className="flex flex-col items-start gap-5">
          <div className="relative aspect-[16/5] w-full max-w-2xl shrink-0 overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-primary/15 via-background to-accent/15 shadow-inner">
            {storefrontBannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storefrontBannerUrl}
                alt="Storefront banner preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-center text-xs text-muted-foreground">
                No banner — using the default gradient
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Recommended size: wide 16:5 ratio (e.g., 2400×750 px). Off-ratio images will be
              accepted, but may crop oddly on the live page.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={onStorefrontBannerFile}
                  disabled={storefrontBannerBusy}
                />
                {storefrontBannerBusy
                  ? "Working…"
                  : storefrontBannerUrl
                    ? "Replace banner"
                    : "Upload banner"}
              </label>
              {storefrontBannerUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={storefrontBannerBusy}
                  onClick={() => void handleClearStorefrontBanner()}
                >
                  Use the default banner
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 border-border/50 bg-card p-6">
        <h2 className="text-lg font-semibold">Display name</h2>
        <p className="text-sm text-muted-foreground">
          Shown in the nav, dashboard, and on your public storefront.
        </p>
        <form onSubmit={handleSaveDisplayName} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={MAX_DISPLAY_NAME_LEN}
              autoComplete="name"
              placeholder="Your creator name"
            />
          </div>
          <Button type="submit" disabled={savingProfile || !displayNameDirty}>
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4 border-border/50 bg-card p-6">
        <h2 className="text-lg font-semibold">Catchphrase</h2>
        <p className="text-sm text-muted-foreground">
          Your signature line on your shop — like &ldquo;Level 99 builder&rdquo; or &ldquo;Dragon hoodie
          designer&rdquo;. Keep it friendly; inappropriate words aren&apos;t allowed.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catchphrase">Catchphrase</Label>
            <Textarea
              id="catchphrase"
              value={catchphrase}
              onChange={(e) => setCatchphrase(e.target.value)}
              maxLength={MAX_CATCHPHRASE_LEN}
              rows={2}
              placeholder="Level 99 builder"
            />
            <p className="text-xs text-muted-foreground">
              {catchphrase.length}/{MAX_CATCHPHRASE_LEN} characters · optional
            </p>
          </div>
          <Button
            type="button"
            disabled={savingCatchphrase || !catchphraseDirty}
            onClick={() => void handleSaveCatchphrase()}
          >
            {savingCatchphrase ? "Saving…" : "Save catchphrase"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 border-border/50 bg-card p-6">
        <h2 className="text-lg font-semibold">Account email</h2>
        <p className="text-sm text-muted-foreground">
          {email ?? "No email on file"}
        </p>
        <p className="text-xs text-muted-foreground">
          Changing your email requires a secure verification flow and is not available here yet.
        </p>
      </Card>

      {hasEmailPassword && email && (
        <Card className="space-y-4 border-border/50 bg-card p-6">
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="text-sm text-muted-foreground">
            Send a reset link to {email} if you want to choose a new password.
          </p>
          <Link href="/auth/forgot-password">
            <Button type="button" variant="outline">
              Reset password
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

type AxolotlGalleryProps = {
  id: string;
  selected: string | null;
  busy: boolean;
  onPick: (url: string) => void;
};

function AxolotlGallery({ id, selected, busy, onPick }: AxolotlGalleryProps) {
  return (
    <div id={id} className="rounded-lg border border-border/50 bg-muted/30 p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Pick your axolotl — kids love a personal mascot. You can change this anytime.
      </p>
      <div
        role="radiogroup"
        aria-label="Axolotl gallery"
        className="grid grid-cols-3 gap-3 sm:gap-4"
      >
        {DEFAULT_AVATAR_POOL.map((url, index) => {
          const isSelected = selected === url;
          return (
            <button
              key={url}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Axolotl ${index + 1}${isSelected ? " (selected)" : ""}`}
              disabled={busy}
              onClick={() => onPick(url)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-lg border-2 bg-background outline-none transition",
                "hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border/60",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
              {isSelected && (
                <span className="absolute bottom-1 right-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Best-effort aspect ratio probe — used only to warn about off-ratio banner
 * uploads. Returns null on any decode failure so the upload still proceeds.
 */
function readImageAspectRatio(dataUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img.naturalWidth / img.naturalHeight);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

type AxolotlDesignerProps = {
  id: string;
  slot: "personal" | "storefront";
  onSaved: (avatarUrl: string) => void;
  onClose: () => void;
};

/**
 * Inline AI-generation panel — kid types two short prompts ("a pirate hat",
 * "playing soccer"), Gemini draws a chibi axolotl on the curated reference
 * style, and the resulting PNG becomes the avatar. The endpoint at
 * `/api/account/generate-axolotl` saves the avatar server-side as part of
 * generation, so the preview in this panel is the *already-saved* state —
 * "Use this axolotl" is just a confirmation; "Try again" overwrites it
 * with a fresh draw.
 *
 * `slot` switches between profiles.avatar_url and profiles.storefront_avatar_url
 * so the same component services both photo cards.
 */
function AxolotlDesigner({ id, slot, onSaved, onClose }: AxolotlDesignerProps) {
  const [wearing, setWearing] = useState("");
  const [activity, setActivity] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [placeholderMode, setPlaceholderMode] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const cooldownRemaining = Math.max(0, cooldownUntil - now);
  const cooldownActive = cooldownRemaining > 0;

  // Tick once a second while a cooldown is pending so the button label
  // counts down. Skipped when there's no cooldown so we don't burn cycles.
  useEffect(() => {
    if (!cooldownActive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [cooldownActive]);

  const trimmedWearing = wearing.trim();
  const trimmedActivity = activity.trim();
  const canGenerate =
    !busy &&
    !cooldownActive &&
    trimmedWearing.length > 0 &&
    trimmedActivity.length > 0;

  async function handleGenerate() {
    if (!canGenerate) return;
    setBusy(true);
    setErrorMessage(null);
    setPlaceholderMode(false);
    try {
      const res = await fetch("/api/account/generate-axolotl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wearing: trimmedWearing,
          activity: trimmedActivity,
          slot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        avatarUrl?: string;
        error?: string;
        placeholder?: boolean;
      };
      if (!res.ok) {
        if (res.status === 503 && data.placeholder) {
          setPlaceholderMode(true);
          setErrorMessage(
            data.error ??
              "AI generation isn't configured yet — coming soon.",
          );
          return;
        }
        setErrorMessage(
          data.error ??
            "Couldn't draw your axolotl right now. Please try again.",
        );
        return;
      }
      if (!data.avatarUrl) {
        setErrorMessage("Couldn't draw your axolotl right now. Please try again.");
        return;
      }
      setPreviewUrl(data.avatarUrl);
      onSaved(data.avatarUrl);
      setCooldownUntil(Date.now() + AXOLOTL_DESIGN_COOLDOWN_MS);
      toast.success(
        slot === "storefront"
          ? "Storefront axolotl drawn!"
          : "Your axolotl is ready!",
      );
    } catch {
      setErrorMessage(
        "Couldn't reach the drawing service. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleTryAgain() {
    setPreviewUrl(null);
    setErrorMessage(null);
  }

  function handleConfirm() {
    setPreviewUrl(null);
    setWearing("");
    setActivity("");
    setErrorMessage(null);
    onClose();
  }

  const generateLabel = (() => {
    if (busy) return "Drawing your axolotl…";
    if (cooldownActive) return `Try again in ${Math.ceil(cooldownRemaining / 1000)}s`;
    if (previewUrl) return "Draw another";
    return "Generate";
  })();

  return (
    <div
      id={id}
      className="space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AXOLOTL_REFERENCE_IMAGE_PATH}
          alt=""
          className="h-20 w-auto shrink-0 rounded-md border border-border/60 bg-black object-contain"
          loading="lazy"
          draggable={false}
        />
        <p className="text-xs text-muted-foreground">
          Your axolotl will match this art style — chibi, pink, sticker-like,
          on a black background. Tell us what to wear and what to do, and our
          drawing helper will sketch one just for you.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-wearing`} className="text-xs">
            What is your axolotl wearing?
          </Label>
          <Input
            id={`${id}-wearing`}
            value={wearing}
            onChange={(e) => setWearing(e.target.value)}
            maxLength={AXOLOTL_DESIGN_FIELD_MAX}
            placeholder="a yellow raincoat, a Lakers jersey, a Mario costume…"
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-activity`} className="text-xs">
            What is it doing?
          </Label>
          <Input
            id={`${id}-activity`}
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            maxLength={AXOLOTL_DESIGN_FIELD_MAX}
            placeholder="playing soccer, baking cookies, reading a comic…"
            disabled={busy}
          />
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            placeholderMode
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {errorMessage}
        </div>
      )}

      {previewUrl && (
        <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Your custom axolotl"
            className="h-32 w-32 shrink-0 rounded-lg border border-border/60 bg-black object-cover"
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {slot === "storefront"
                ? "Saved as your storefront axolotl."
                : "Saved as your profile axolotl."}
            </p>
            <p className="text-xs text-muted-foreground">
              Want to tweak it? &ldquo;Try again&rdquo; will draw a new one
              with the same words — adjust them first to change the result.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleConfirm}>
                Use this axolotl
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleTryAgain}
                disabled={busy || cooldownActive}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      )}

      {!previewUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
          >
            {generateLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
