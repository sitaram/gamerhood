"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, ArrowRight, Loader2, MailCheck, Eye, EyeOff } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-logo";
import { createBrowserClient } from "@supabase/ssr";
import type { AuthError } from "@supabase/supabase-js";
import { OAuthButtons, OAuthDivider } from "@/components/auth/oauth-buttons";
import { useResendCooldown } from "@/lib/auth/use-resend-cooldown";

/**
 * Supabase returns "Email not confirmed" both as a free-form message and,
 * on newer SDKs, as a structured `code` field. Match either so the
 * recovery card keeps working across SDK upgrades.
 */
function isEmailNotConfirmedError(err: AuthError): boolean {
  if (err.code === "email_not_confirmed") return true;
  return err.message.toLowerCase().includes("email not confirmed");
}

/**
 * Supabase returns "Invalid login credentials" for any combination of
 * wrong email, wrong password, or non-existent user — by design, so an
 * attacker can't enumerate registered emails. We surface a friendlier
 * version that nudges users toward the right recovery path.
 */
function isInvalidCredentialsError(err: AuthError): boolean {
  if (err.code === "invalid_credentials") return true;
  return err.message.toLowerCase().includes("invalid login credentials");
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pulled out from `error` because the unconfirmed-email recovery card
  // needs different chrome (and a resend button) than the destructive-red
  // catch-all. When set, we render the friendlier card instead.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const {
    remaining: resendCooldownSeconds,
    isCoolingDown,
    start: startResendCooldown,
  } = useResendCooldown({ initialSeconds: 30 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUnconfirmedEmail(null);
    setResendError(null);
    setResendSuccess(false);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      );

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        if (isEmailNotConfirmedError(authError)) {
          setUnconfirmedEmail(email);
        } else if (isInvalidCredentialsError(authError)) {
          setError(
            "That email and password don't match. Double-check, or reset your password below.",
          );
        } else {
          setError(authError.message);
        }
        return;
      }

      // The navbar's SIGNED_IN handler fires both anon-design migration
      // and (idempotently) the parent / child-profile bootstrap, so the
      // login page no longer needs to call /api/auth/bootstrap directly.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!unconfirmedEmail || resending || isCoolingDown) return;

    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      );

      const { error: resendErr } = await supabase.auth.resend({
        type: "signup",
        email: unconfirmedEmail,
      });

      if (resendErr) {
        setResendError(resendErr.message);
        return;
      }

      setResendSuccess(true);
      startResendCooldown();
    } catch {
      setResendError("Couldn't resend right now. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/50 bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-primary/25">
            <BrandMark className="h-10 w-10" priority />
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to your parent account
          </p>
        </CardHeader>
        <CardContent>
          <OAuthButtons />
          <OAuthDivider label="or sign in with email" />
          <form onSubmit={handleSubmit} className="space-y-4">
            {unconfirmedEmail && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <MailCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-semibold text-foreground">
                      Confirm your email to sign in
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      You started a Gamerhood account with{" "}
                      <span className="font-medium text-foreground">
                        {unconfirmedEmail}
                      </span>{" "}
                      but haven&apos;t confirmed it yet. Click the link in the
                      email we sent you, or resend it below.
                    </p>

                    {resendError && (
                      <p className="text-destructive">{resendError}</p>
                    )}
                    {resendSuccess && !resendError && (
                      <p className="text-foreground">
                        Sent! Check your inbox again.
                      </p>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleResendConfirmation()}
                      disabled={resending || isCoolingDown}
                      className="gap-2 bg-primary hover:bg-primary/90"
                    >
                      {resending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending…
                        </>
                      ) : isCoolingDown ? (
                        <>Resend ({resendCooldownSeconds}s)</>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Resend confirmation email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-1.5">
                <p>{error}</p>
                <Link
                  href="/auth/forgot-password"
                  className="inline-block text-xs font-medium text-destructive underline underline-offset-2 hover:text-destructive/80"
                >
                  Reset your password →
                </Link>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="pl-9 bg-background border-border/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="pl-9 pr-10 bg-background border-border/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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

            <Button type="submit" disabled={loading} className="w-full gap-2 bg-primary hover:bg-primary/90">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
