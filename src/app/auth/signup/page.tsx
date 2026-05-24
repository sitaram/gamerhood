"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, Shield, Check, Loader2, MailCheck, Eye, EyeOff, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-logo";
import { createBrowserClient } from "@supabase/ssr";
import { OAuthButtons, OAuthDivider } from "@/components/auth/oauth-buttons";
import { useResendCooldown } from "@/lib/auth/use-resend-cooldown";
import { siteUrl } from "@/lib/site";

type Step = "form" | "sent";

// Cross-browser strong-password generation. Browsers like Safari pick this up
// natively via the `passwordrules` attribute we set below; the in-page
// "Suggest" button is the universal fallback for Firefox/Arc/Edge users (and
// anyone running without a password-manager extension).
// Confusable chars (l/I/O/0/1) are intentionally excluded to make manual
// typing easier on the rare path where the user has to retype.
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

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedAge, setAgreedAge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Holds the email the confirmation link was actually sent to, so the
  // success copy + the resend button keep using the right address even if
  // the user later edits the (now unmounted) form input.
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const {
    remaining: resendCooldownSeconds,
    isCoolingDown,
    start: startResendCooldown,
  } = useResendCooldown({ initialSeconds: 30 });

  const fieldsFilled = email.length > 0 && password.length >= 8;
  const consentGiven = agreedTerms && agreedAge;
  const canSubmit = fieldsFilled && consentGiven && !loading;
  // Only nudge about the checkboxes once the user has actually filled the
  // inputs — otherwise we'd be yelling at someone who's still typing.
  const showConsentHint = fieldsFilled && !consentGiven;

  function resetToForm() {
    setStep("form");
    setSentToEmail(null);
    setEmail("");
    setPassword("");
    setAgreedTerms(false);
    setAgreedAge(false);
    setError(null);
    setResendError(null);
    setResendSuccess(false);
  }

  async function handleCreateAccount() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      );

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "parent",
          },
          // Force the confirmation link in the email to point at the
          // canonical site origin (not Supabase's project `Site URL`
          // default, which historically pointed at localhost and would
          // silently leak into every prod confirmation email).
          emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard`,
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // Email confirmation is enabled on this Supabase project, so signUp
      // returns no session — the user has to click the link in the email
      // before they can sign in. Switch to the success state instead of
      // pushing them to /dashboard (which would just bounce them to login).
      // Bootstrap (parent + child profile rows) intentionally happens later,
      // on the first real sign-in, from the navbar's SIGNED_IN handler.
      if (!data.session) {
        setSentToEmail(email);
        setStep("sent");
        return;
      }

      // Edge case: some dev configs disable email confirmation, in which
      // case signUp does return a session and we want the original happy
      // path of dropping the user straight on /dashboard. The navbar's
      // SIGNED_IN handler fires bootstrap, so we don't call it here.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!sentToEmail || resending || isCoolingDown) return;

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
        email: sentToEmail,
        options: {
          emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard`,
        },
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

  function handleSignupFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    void handleCreateAccount();
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
            {step === "sent" ? "Check your email" : "Create your parent account"}
          </CardTitle>
          {step === "sent" ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-foreground">
                {sentToEmail}
              </span>
              . Click it to activate your parent account and start designing
              with your kid.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Gamerhood is built for kid creators — you set up the parent
              account, your child designs through it, and earnings come to you.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {step === "sent" ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Can&apos;t find it? Check your spam folder. The link expires in
                24 hours.
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
                onClick={() => void handleResendConfirmation()}
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
                    Resend confirmation email
                  </>
                )}
              </Button>

              <div className="flex flex-col items-center gap-2 pt-2 text-sm">
                <button
                  type="button"
                  onClick={resetToForm}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Wrong email? Start over
                </button>
                <Link
                  href="/auth/login"
                  className="text-primary hover:underline"
                >
                  Already confirmed? Sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <OAuthButtons />
              <OAuthDivider label="or sign up with email" />

              <form
                id="signup-form"
                onSubmit={handleSignupFormSubmit}
                className="space-y-4"
              >
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
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
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
                      // Safari / iOS AutoFill picks this up to generate a
                      // password that meets our rules. Other browsers ignore
                      // unknown attributes harmlessly.
                      {...({ passwordrules: "minlength: 8; required: lower; required: upper; required: digit;" } as Record<string, string>)}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pl-9 pr-10 bg-background border-border/50"
                      minLength={8}
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

                <div className="rounded-xl border border-border/50 bg-background p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="mt-0.5 h-5 w-5 text-neon-cyan shrink-0" />
                    <div>
                      <h3 className="font-semibold text-sm">Kid Safety First</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        You stay in control of the account and the payouts. We
                        don&apos;t collect personal info from kids, and designs
                        go through automated safety checks (Google Vision&apos;s
                        SAFE_SEARCH_DETECTION) before publishing.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label
                    htmlFor="age"
                    className="flex items-start gap-3 text-sm leading-relaxed cursor-pointer select-none"
                  >
                    <input
                      id="age"
                      type="checkbox"
                      checked={agreedAge}
                      onChange={(e) => setAgreedAge(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border/70 accent-primary cursor-pointer"
                      required
                    />
                    <span>
                      I&apos;m 18 or older and I&apos;m the legal parent or
                      guardian of the child who will use this account.
                    </span>
                  </label>

                  <label
                    htmlFor="terms"
                    className="flex items-start gap-3 text-sm leading-relaxed cursor-pointer select-none"
                  >
                    <input
                      id="terms"
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border/70 accent-primary cursor-pointer"
                      required
                    />
                    <span>
                      I agree to the{" "}
                      <Link
                        href="/terms"
                        className="text-primary hover:underline"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        className="text-primary hover:underline"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                </div>

                <div className="space-y-2">
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full gap-2 bg-primary hover:bg-primary/90"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Create my parent account
                      </>
                    )}
                  </Button>
                  {showConsentHint && (
                    <p className="text-center text-xs text-muted-foreground">
                      Check both boxes above to continue.
                    </p>
                  )}
                </div>
              </form>

              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="text-primary hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
