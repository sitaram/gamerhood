"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-logo";
import { createBrowserClient } from "@supabase/ssr";
import { useResendCooldown } from "@/lib/auth/use-resend-cooldown";
import { siteUrl } from "@/lib/site";

type Step = "form" | "sent";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const {
    remaining: resendCooldownSeconds,
    isCoolingDown,
    start: startResendCooldown,
  } = useResendCooldown({ initialSeconds: 30 });

  async function sendResetEmail(target: string) {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    // We bounce the recovery link through our existing /auth/callback
    // handler, which exchanges the recovery code for a session and then
    // forwards to /auth/reset-password. That keeps the session lifecycle in
    // one place and reuses the bootstrapAccount logic.
    //
    // Use `siteUrl()` (not `window.location.origin`) so a user who happens
    // to visit a per-deployment Vercel preview hostname doesn't bake that
    // hostname into the reset link — the link must land on the canonical
    // domain where the Supabase Auth cookies are scoped.
    return supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset-password`,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await sendResetEmail(email);

      // Supabase intentionally does NOT error when the email doesn't exist
      // (anti-enumeration). We rely on that and unconditionally show the
      // "Check your email" confirmation — never reveal whether the address
      // is registered. Only surface real transport-level errors.
      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSentToEmail(email);
      setStep("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!sentToEmail || resending || isCoolingDown) return;

    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const { error: resetError } = await sendResetEmail(sentToEmail);

      if (resetError) {
        setResendError(resetError.message);
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

  function resetToForm() {
    setStep("form");
    setSentToEmail(null);
    setEmail("");
    setError(null);
    setResendError(null);
    setResendSuccess(false);
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/50 bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-1 ring-primary/25">
            {step === "sent" ? (
              <MailCheck className="h-8 w-8 text-primary" aria-hidden />
            ) : (
              <BrandMark className="h-10 w-10" priority />
            )}
          </div>
          <CardTitle className="text-2xl">
            {step === "sent" ? "Check your email" : "Reset your password"}
          </CardTitle>
          {step === "sent" ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for{" "}
              <span className="font-semibold text-foreground">
                {sentToEmail}
              </span>
              , a password reset link is on its way. Click it to choose a new
              password.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enter the email you used to sign up. We&apos;ll send a link to
              choose a new password.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {step === "sent" ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Can&apos;t find it? Check your spam folder. The link expires
                in 1 hour.
              </p>

              {resendError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {resendError}
                </div>
              )}
              {resendSuccess && !resendError && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                  Sent! Check your inbox again.
                </div>
              )}

              <Button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending || isCoolingDown}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
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
                    Resend reset email
                  </>
                )}
              </Button>

              <div className="flex flex-col items-center gap-2 pt-2 text-sm">
                <button
                  type="button"
                  onClick={resetToForm}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Wrong email? Try another
                </button>
                <Link
                  href="/auth/login"
                  className="text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
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
                    autoComplete="username email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="parent@example.com"
                    className="pl-9 bg-background border-border/50"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || email.length === 0}
                className="w-full gap-2 bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending reset link…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send reset link
                  </>
                )}
              </Button>

              <div className="rounded-lg border border-border/50 bg-background p-3 text-xs text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">
                  Forgot which email you used?
                </p>
                <p>
                  Try signing in with{" "}
                  <Link
                    href="/auth/login"
                    className="text-primary hover:underline"
                  >
                    Google
                  </Link>
                  {" "}instead — it&apos;ll let you pick from the accounts on
                  this device. If you originally signed up with Google, no
                  password is needed.
                </p>
              </div>

              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
