import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ShieldCheck,
  Users,
  Eye,
  Lock,
  MessageSquareOff,
  Trash2,
  AlertTriangle,
  FileCheck,
  ArrowRight,
} from "lucide-react";

const PRINCIPLES = [
  {
    icon: Users,
    title: "Parent-Owned Accounts",
    description:
      "Every account on Gamerhood is created and owned by a parent or legal guardian. Children operate as \"managed profiles\" under the parent's account. The parent provides all personal information — the child never does.",
  },
  {
    icon: Lock,
    title: "No Child PII Collected",
    description:
      "Child profiles contain only a display name and an optional avatar. We never collect a child's real name, email address, physical address, phone number, date of birth, or any other personally identifiable information.",
  },
  {
    icon: FileCheck,
    title: "Verifiable Parental Consent",
    description:
      "Before any child profile can go live, the parent must complete an FTC-approved consent method — a credit card micro-charge, signed electronic consent form, or government ID verification.",
  },
  {
    icon: Eye,
    title: "Automated Content Moderation",
    description:
      "Every uploaded design is automatically screened for inappropriate content (violence, nudity, drugs) using AI-powered image analysis, and for copyright infringement using reverse image search. Flagged designs are held for manual review.",
  },
  {
    icon: MessageSquareOff,
    title: "No Social Features Between Children",
    description:
      "There is no direct messaging, commenting, or any form of communication between child accounts. Parents and adult buyers can leave product reviews, but children cannot contact each other through the platform.",
  },
  {
    icon: Trash2,
    title: "Data Minimization & Retention",
    description:
      "We collect only what's necessary to operate the marketplace. Our data retention policy is published in our Privacy Policy. Parents can request deletion of all data associated with their account at any time.",
  },
  {
    icon: AlertTriangle,
    title: "No Tracking or Behavioral Advertising",
    description:
      "We do not use tracking cookies, behavioral advertising, or interest-based targeting on any pages accessible to children. We do not sell or share personal information with third-party advertisers.",
  },
  {
    icon: ShieldCheck,
    title: "COPPA Compliance",
    description:
      "Gamerhood is designed to comply with the Children's Online Privacy Protection Act (COPPA), including the updated rule effective June 2025. We regularly review our practices against FTC guidelines.",
  },
];

const PARENT_CONTROLS = [
  "View, edit, or delete your child's profile at any time",
  "Review and approve all designs before they go live",
  "Monitor earnings, sales, and storefront activity",
  "Set product pricing and manage payout settings",
  "Temporarily disable or permanently delete a child's storefront",
  "Download or request deletion of all associated data",
  "Receive email notifications for all significant account activity",
];

export default function SafetyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-cyan/10 text-neon-cyan">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Kid <span className="gradient-text">Safety</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Your child&apos;s safety is our top priority. Here&apos;s exactly how we protect
          young creators on Gamerhood.
        </p>
      </div>

      <Separator className="my-12 bg-border/50" />

      <section>
        <h2 className="text-2xl font-bold">Our Safety Principles</h2>
        <p className="mt-2 text-muted-foreground">
          Every feature on Gamerhood is designed with child safety as a non-negotiable requirement.
        </p>

        <div className="mt-8 space-y-6">
          {PRINCIPLES.map((p) => (
            <Card key={p.title} className="border-border/50 bg-card p-6">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-cyan/10">
                  <p.icon className="h-5 w-5 text-neon-cyan" />
                </div>
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-12 bg-border/50" />

      <section>
        <h2 className="text-2xl font-bold">Parent Controls</h2>
        <p className="mt-2 text-muted-foreground">
          As a parent, you have full visibility and control over your child&apos;s account.
        </p>

        <Card className="mt-6 border-border/50 bg-card p-6">
          <ul className="space-y-3">
            {PARENT_CONTROLS.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-green/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                </div>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Separator className="my-12 bg-border/50" />

      <section>
        <h2 className="text-2xl font-bold">How We Handle Designs</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="border-border/50 bg-card p-5 text-center">
            <div className="text-2xl">1</div>
            <h3 className="mt-2 font-semibold text-sm">Upload</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Child creates or uploads a design through the parent&apos;s authenticated session
            </p>
          </Card>
          <Card className="border-border/50 bg-card p-5 text-center">
            <div className="text-2xl">2</div>
            <h3 className="mt-2 font-semibold text-sm">Auto-Screen</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              AI checks for inappropriate content and copyright infringement in parallel
            </p>
          </Card>
          <Card className="border-border/50 bg-card p-5 text-center">
            <div className="text-2xl">3</div>
            <h3 className="mt-2 font-semibold text-sm">Publish or Review</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Clean designs go live. Flagged designs are held for manual review and parent notification
            </p>
          </Card>
        </div>
      </section>

      <Separator className="my-12 bg-border/50" />

      <section className="rounded-2xl border border-border/50 bg-card p-8 text-center">
        <h2 className="text-xl font-bold">Have a Safety Concern?</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          If you see content that concerns you or have questions about how we protect children,
          please contact us immediately. We take every report seriously.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href="mailto:safety@gamerhood.gg?subject=Safety%20Concern">
            <Button variant="outline" className="gap-2 border-border/50">
              Report a Concern
            </Button>
          </a>
          <Link href="/privacy">
            <Button variant="ghost" className="gap-2 text-muted-foreground">
              Read Our Privacy Policy
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
