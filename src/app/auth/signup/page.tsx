"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Gamepad2, Mail, Lock, User, ArrowRight, Shield, Check, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { OAuthButtons, OAuthDivider } from "@/components/auth/oauth-buttons";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "consent">("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedAge, setAgreedAge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateAccount() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      );

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: "parent",
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <Gamepad2 className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">
            {step === "account" ? "Create Parent Account" : "Parental Consent"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === "account"
              ? "Parents create and manage accounts for their children"
              : "COPPA requires parental consent for accounts used by children under 13"}
          </p>
        </CardHeader>
        <CardContent>
          {step === "account" && (
            <>
              <OAuthButtons />
              <OAuthDivider label="or sign up with email" />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep("consent");
                }}
                className="space-y-4"
              >
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="pl-9 bg-background border-border/50"
                    required
                  />
                </div>
              </div>

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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="pl-9 bg-background border-border/50"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2 bg-primary hover:bg-primary/90">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
              </form>
            </>
          )}

          {step === "consent" && (
            <div className="space-y-6">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-background p-4">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 text-neon-cyan shrink-0" />
                  <div>
                    <h3 className="font-semibold text-sm">Kid Safety First</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      As a parent, you maintain full control over your child&apos;s account.
                      We collect no personal information from children. All designs and
                      products are moderated for safety. Earnings are paid to your
                      parent-managed Stripe account.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </Label>
                  <Switch id="terms" checked={agreedTerms} onCheckedChange={setAgreedTerms} />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="age" className="text-sm leading-relaxed cursor-pointer">
                    I confirm I am 18 or older and the legal parent/guardian of
                    the child who will use this account
                  </Label>
                  <Switch id="age" checked={agreedAge} onCheckedChange={setAgreedAge} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("account")}
                  className="flex-1 border-border/50"
                >
                  Back
                </Button>
                <Button
                  disabled={!agreedTerms || !agreedAge || loading}
                  onClick={handleCreateAccount}
                  className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Create Account
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "account" && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
