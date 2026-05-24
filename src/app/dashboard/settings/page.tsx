import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProfileForAuthUser } from "@/lib/supabase/queries";
import { ProfileSettingsForm } from "@/components/dashboard/profile-settings-form";

export const dynamic = "force-dynamic";

function deriveDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata ?? {};
  return (
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email?.split("@")[0] ||
    "Creator"
  );
}

function hasEmailPasswordProvider(user: {
  app_metadata?: Record<string, unknown>;
}): boolean {
  const provider = user.app_metadata?.provider;
  if (provider === "email") return true;
  const providers = user.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("email");
}

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Account settings</h1>
      <p className="mt-2 text-muted-foreground">
        Personalize how you show up across Gamerhood — photo, name, and catchphrase.
      </p>

      <div className="mt-10">
        <ProfileSettingsForm
          initialDisplayName={profile?.display_name ?? deriveDisplayName(user)}
          initialCatchphrase={profile?.catchphrase ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
          profileId={profile?.id ?? user.id}
          email={user.email ?? null}
          hasEmailPassword={hasEmailPasswordProvider(user)}
        />
      </div>
    </div>
  );
}
