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
import { defaultAvatarFor, profileInitials } from "@/lib/profile-avatar";

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

type Props = {
  initialDisplayName: string;
  initialCatchphrase: string | null;
  initialAvatarUrl: string | null;
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
  profileId,
  email,
  hasEmailPassword,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [catchphrase, setCatchphrase] = useState(initialCatchphrase ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCatchphrase, setSavingCatchphrase] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const initials = useMemo(() => profileInitials(displayName), [displayName]);
  // Preview the same default-axolotl the rest of the site will pick when
  // the creator hasn't uploaded a photo, so the settings page matches
  // the navbar / dashboard / storefront instead of just showing initials.
  const previewAvatarUrl = avatarUrl ?? defaultAvatarFor(profileId);
  const usingDefault = !avatarUrl;

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

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error("Please upload PNG, JPG, or WebP");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Profile photo must be 2 MB or smaller");
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
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setAvatarBusy(false);
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
            <AvatarImage src={previewAvatarUrl} alt={displayName} />
            <AvatarFallback className="bg-primary/20 text-3xl font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            {usingDefault && (
              <p className="text-xs text-muted-foreground">
                Using one of our default Gamerhood axolotls. Upload your own anytime.
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
                {avatarBusy ? "Uploading…" : avatarUrl ? "Replace photo" : "Upload photo"}
              </label>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={avatarBusy}
                  onClick={() => void handleRemoveAvatar()}
                >
                  Remove
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
