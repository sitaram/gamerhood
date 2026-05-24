"use client";

import { useMemo, useState } from "react";
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

const DEFAULT_AVATAR_SET: ReadonlySet<string> = new Set(DEFAULT_AVATAR_POOL);

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

type Props = {
  initialDisplayName: string;
  initialCatchphrase: string | null;
  initialAvatarUrl: string | null;
  initialStorefrontAvatarUrl: string | null;
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCatchphrase, setSavingCatchphrase] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [storefrontAvatarBusy, setStorefrontAvatarBusy] = useState(false);

  const [personalGalleryOpen, setPersonalGalleryOpen] = useState(false);
  const [storefrontGalleryOpen, setStorefrontGalleryOpen] = useState(false);

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

  const displayNameDirty = displayName.trim() !== initialDisplayName.trim();
  const catchphraseDirty =
    catchphrase.trim() !== (initialCatchphrase?.trim() ?? "");

  return (
    <div className="space-y-8">
      <Card className="space-y-4 border-border/50 bg-card p-6">
        <h2 className="text-lg font-semibold">Profile photo</h2>
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
      </Card>

      <Card className="space-y-4 border-border/50 bg-card p-6">
        <h2 className="text-lg font-semibold">Storefront photo (optional)</h2>
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
