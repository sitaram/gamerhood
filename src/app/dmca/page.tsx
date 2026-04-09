"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { FileWarning, Send, AlertTriangle, Check } from "lucide-react";

export default function DMCAPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attestGoodFaith, setAttestGoodFaith] = useState(false);
  const [attestOwner, setAttestOwner] = useState(false);
  const [attestPerjury, setAttestPerjury] = useState(false);

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center py-20">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-green/10 text-neon-green">
            <Check className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold">Takedown Request Received</h1>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            We&apos;ve received your DMCA takedown notice. Our team will review and
            respond within 48 hours to the email address you provided.
          </p>
          <Link href="/" className="mt-8 inline-block">
            <Button variant="outline" className="border-border/50">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-orange/10 text-neon-orange">
          <FileWarning className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          DMCA <span className="gradient-text">Policy</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Gamerhood respects intellectual property rights. If you believe content on our
          platform infringes your copyright, you can submit a takedown request below.
        </p>
      </div>

      <Separator className="my-10 bg-border/50" />

      <section>
        <h2 className="text-lg font-bold">Our Copyright Policy</h2>
        <div className="mt-4 space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Gamerhood operates in accordance with the Digital Millennium Copyright Act (DMCA).
            We respond promptly to valid takedown notices and maintain a repeat infringer policy.
          </p>

          <Card className="border-border/50 bg-card p-5">
            <h3 className="font-semibold text-foreground mb-3">How We Protect Against Infringement</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neon-purple shrink-0" />
                <span><strong className="text-foreground">Upload-time screening:</strong> Every design is checked against a copyright image database using reverse image search</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neon-cyan shrink-0" />
                <span><strong className="text-foreground">Keyword filtering:</strong> Designs referencing known brands (Nintendo, Marvel, Disney, etc.) are flagged for manual review</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neon-pink shrink-0" />
                <span><strong className="text-foreground">DMCA takedown process:</strong> Valid requests are processed within 48 hours</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neon-orange shrink-0" />
                <span><strong className="text-foreground">Repeat infringer policy:</strong> Three valid strikes result in permanent account suspension</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neon-green shrink-0" />
                <span><strong className="text-foreground">Periodic audits:</strong> Published designs are batch-scanned against copyright databases on a regular schedule</span>
              </li>
            </ul>
          </Card>
        </div>
      </section>

      <Separator className="my-10 bg-border/50" />

      <section>
        <h2 className="text-lg font-bold">Repeat Infringer Policy</h2>
        <div className="mt-4 text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            As required for DMCA safe harbor protection, Gamerhood maintains a repeat infringer policy:
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/50 bg-card p-4 text-center">
              <div className="text-2xl font-bold text-neon-orange">1st Strike</div>
              <p className="mt-2 text-xs">Design removed. Creator and parent notified. Educational warning issued.</p>
            </Card>
            <Card className="border-border/50 bg-card p-4 text-center">
              <div className="text-2xl font-bold text-neon-pink">2nd Strike</div>
              <p className="mt-2 text-xs">Design removed. All designs placed under manual review. Final warning issued.</p>
            </Card>
            <Card className="border-border/50 bg-card p-4 text-center">
              <div className="text-2xl font-bold text-destructive">3rd Strike</div>
              <p className="mt-2 text-xs">Account permanently suspended. All products delisted. Payout of remaining earnings.</p>
            </Card>
          </div>
        </div>
      </section>

      <Separator className="my-10 bg-border/50" />

      <section>
        <h2 className="text-lg font-bold">Submit a Takedown Request</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          To file a DMCA takedown notice, please provide the following information.
          Incomplete submissions may delay processing.
        </p>

        <Card className="mt-6 border-neon-orange/20 bg-neon-orange/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-neon-orange shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Important:</strong> Under 17 U.S.C. § 512(f),
              knowingly filing a false DMCA takedown notice may result in liability for damages,
              including costs and attorneys&apos; fees.
            </p>
          </div>
        </Card>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            const form = e.currentTarget;
            const formData = new FormData(form);
            try {
              await fetch("/api/dmca", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: formData.get("name"),
                  email: formData.get("email"),
                  contentUrl: formData.get("contentUrl"),
                  originalWorkUrl: formData.get("originalUrl"),
                  description: formData.get("description"),
                  attestOwner,
                  attestPerjury,
                }),
              });
            } catch { /* submission best-effort */ }
            setSubmitting(false);
            setSubmitted(true);
          }}
          className="mt-6 space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Your Full Legal Name</Label>
              <Input id="name" name="name" required className="bg-background border-border/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" required className="bg-background border-border/50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company / Organization (if applicable)</Label>
            <Input id="company" className="bg-background border-border/50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="urls">URL(s) of Infringing Content on Gamerhood</Label>
            <Textarea
              id="urls"
              name="contentUrl"
              required
              placeholder="Paste the URL(s) of the product or design page(s) that contain infringing material"
              className="min-h-[80px] bg-background border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="original">Description of Original Copyrighted Work</Label>
            <Textarea
              id="original"
              name="description"
              required
              placeholder="Describe your original work and how the content on Gamerhood infringes it. Include links to your original work if available."
              className="min-h-[100px] bg-background border-border/50"
            />
          </div>

          <Separator className="bg-border/50" />

          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Required Attestations</h3>

            <div className="flex items-start gap-3">
              <Switch
                id="good-faith"
                checked={attestGoodFaith}
                onCheckedChange={setAttestGoodFaith}
                className="mt-0.5"
              />
              <Label htmlFor="good-faith" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I have a good faith belief that the use of the described material is not
                authorized by the copyright owner, its agent, or the law.
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Switch
                id="owner"
                checked={attestOwner}
                onCheckedChange={setAttestOwner}
                className="mt-0.5"
              />
              <Label htmlFor="owner" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I am the copyright owner or authorized to act on behalf of the owner
                of an exclusive right that is allegedly infringed.
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Switch
                id="perjury"
                checked={attestPerjury}
                onCheckedChange={setAttestPerjury}
                className="mt-0.5"
              />
              <Label htmlFor="perjury" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I understand that under 17 U.S.C. § 512(f), I may be liable for damages
                if I knowingly materially misrepresent that material is infringing.
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signature">Electronic Signature (type your full legal name)</Label>
            <Input
              id="signature"
              required
              placeholder="Your full legal name serves as your electronic signature"
              className="bg-background border-border/50"
            />
          </div>

          <Button
            type="submit"
            disabled={!attestGoodFaith || !attestOwner || !attestPerjury}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
            Submit Takedown Request
          </Button>
        </form>
      </section>

      <Separator className="my-10 bg-border/50" />

      <section>
        <h2 className="text-lg font-bold">Counter-Notification</h2>
        <div className="mt-4 text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            If you believe your content was removed in error, you may file a counter-notification.
            Your counter-notification must include:
          </p>
          <ul className="space-y-1 ml-4">
            <li>- Your name, address, phone number, and email</li>
            <li>- Identification of the removed material and its former location</li>
            <li>- A statement under penalty of perjury that you have a good faith belief the material was removed by mistake</li>
            <li>- Your consent to jurisdiction of the federal court in your district</li>
            <li>- Your physical or electronic signature</li>
          </ul>
          <p>
            Send counter-notifications to <strong className="text-foreground">dmca@gamerhood.gg</strong>.
            Upon receipt of a valid counter-notification, we will forward it to the original
            complainant. If the complainant does not file a court action within 10 business days,
            we will restore the removed content.
          </p>
        </div>
      </section>

      <Separator className="my-10 bg-border/50" />

      <div className="text-center text-sm text-muted-foreground">
        <p>
          DMCA Agent: <strong className="text-foreground">dmca@gamerhood.gg</strong>
        </p>
        <p className="mt-2">
          See also:{" "}
          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
          {" "}&bull;{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          {" "}&bull;{" "}
          <Link href="/safety" className="text-primary hover:underline">Kid Safety</Link>
        </p>
      </div>
    </div>
  );
}
