"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const MAX_DISPLAY_NAME_LEN = 80;

type Props = {
  initialDisplayName: string;
  email: string | null;
  hasEmailPassword: boolean;
};

export function ProfileSettingsForm({
  initialDisplayName,
  email,
  hasEmailPassword,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
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

    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save");
      }
      setDisplayName(data.displayName ?? trimmed);
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="space-y-4 border-border/50 bg-card p-6">
        <h2 className="text-lg font-semibold">Display name</h2>
        <p className="text-sm text-muted-foreground">
          Shown in the nav, dashboard, and on your public storefront.
        </p>
        <form onSubmit={handleSave} className="space-y-4">
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
          <Button type="submit" disabled={saving || displayName.trim() === initialDisplayName.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
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
