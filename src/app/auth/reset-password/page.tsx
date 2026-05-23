"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Loader2, Check, Eye, EyeOff, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-logo";
import { createBrowserClient } from "@supabase/ssr";

// Same generator + character set as the signup page. Kept inline here
// rather than imported because both pages own their own auth surface and
// it's easier to tweak independently per page if we ever change rules.
const PWD_LOWER = "abcdefghijkmnopqrstuvwxyz";
const PWD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PWD_DIGITS = "23456789";
const PWD_SYMBOLS = "!@#$%^&*";

function secureRandomInt(max: number) {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] % max;
}

function generateStrongPassword(length = 16): string {
  const all = PWD_LOWER + PWD_UPPER + PWD_DIGITS + PWD_SYMBOLS;
  const out: string[] = [
    PWD_LOWER[secureRandomInt(PWD_LOWER.length)],
    PWD_UPPER[secureRandomInt(PWD_UPPER.length)],
    PWD_DIGITS[secureRandomInt(PWD_DIGITS.length)],
    PWD_SYMBOLS[secureRandomInt(PWD_SYMBOLS.length)],
  ];
  while (out.length < length) {
    out.push(all[secureRandomInt(all.length)]);
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

type SessionStatus = "checking" | "valid" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Page is only reachable after /auth/callback exchanged the recovery
  // code and set a session. If someone hits this URL directly without a
  // session, we show a "link expired" state so the UX isn't a silent
  // broken form.
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    supabase.auth.getSession().then(({ data }) => {
      setSessionStatus(data.session ? "valid" : "invalid");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      );

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
      // Brief celebration moment, then drop them into the app. The session
      // is already updated, so /dashboard renders authenticated immediately.
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/50 bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-primary/25">
            {done ? (
              <Check className="h-8 w-8 text-primary" aria-hidden />
            ) : (
              <BrandMark className="h-10 w-10" priority />
            )}
          </div>
          <CardTitle className="text-2xl">
            {done ? "Password updated" : "Choose a new password"}
          </CardTitle>
          {!done && sessionStatus === "valid" && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pick something you can remember — or use Suggest to generate a
              strong one.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {sessionStatus === "checking" ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : sessionStatus === "invalid" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-semibold mb-1">This link has expired</p>
                <p>
                  Reset links are valid for 1 hour. Request a new one to
                  continue.
                </p>
              </div>
              <Link
                href="/auth/forgot-password"
                className={buttonVariants({
                  className: "w-full gap-2 bg-primary hover:bg-primary/90",
                })}
              >
                Request a new link
              </Link>
              <div className="text-center text-sm text-muted-foreground">
                <Link href="/auth/login" className="hover:underline">
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                You&apos;re signed in. Taking you to your dashboard…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">New password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generateStrongPassword(16));
                      setShowPassword(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Suggest a strong password
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...({
                      passwordrules:
                        "minlength: 8; required: lower; required: upper; required: digit;",
                    } as Record<string, string>)}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="pl-9 pr-10 bg-background border-border/50"
                    minLength={8}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    tabIndex={-1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || password.length < 8}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Update password
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
