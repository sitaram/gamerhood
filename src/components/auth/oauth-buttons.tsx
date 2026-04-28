"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@supabase/ssr";
import type { Provider } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

type OAuthProvider = {
  id: Provider;
  label: string;
  icon: React.ReactNode;
};

const PROVIDERS: OAuthProvider[] = [
  {
    id: "google",
    label: "Continue with Google",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.3c-2 1.5-4.6 2.5-7.3 2.5-5.3 0-9.7-3.3-11.3-8L6.2 33C9.4 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.5l6.1 5.2C37.9 36.5 44 31 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    ),
  },
];

export function OAuthButtons() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: Provider) {
    setLoading(provider);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {PROVIDERS.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          className="w-full gap-2 border-border/50 bg-background"
          onClick={() => handleOAuth(p.id)}
          disabled={loading !== null}
        >
          {loading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : p.icon}
          {p.label}
        </Button>
      ))}
    </div>
  );
}

export function OAuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative my-6 flex items-center">
      <div className="flex-grow border-t border-border/50" />
      <span className="mx-3 text-xs uppercase text-muted-foreground">{label}</span>
      <div className="flex-grow border-t border-border/50" />
    </div>
  );
}
