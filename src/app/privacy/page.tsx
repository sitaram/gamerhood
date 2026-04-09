import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

const EFFECTIVE_DATE = "April 22, 2026";

const SECTIONS = [
  {
    title: "1. Overview",
    content: `This Privacy Policy explains how Gamerhood, Inc. ("Gamerhood," "we," "us," or "our") collects, uses, discloses, and protects information when you use the Gamerhood platform ("the Platform"). This policy applies to all users, including parents, guardians, and children who use the Platform through parent-managed accounts.

We are committed to protecting the privacy of all users, with special attention to children under 13 as required by the Children's Online Privacy Protection Act (COPPA).`,
  },
  {
    title: "2. Information We Collect from Parents/Guardians",
    content: `When a parent or guardian creates an account, we collect:

**Account Information:** Name, email address, and password (or OAuth credentials).

**Payment Information:** Bank account or card details provided through Stripe Connect for creator payouts, and payment details for purchases. Payment information is processed and stored by Stripe — we never see or store full card numbers.

**Consent Verification:** Information used to verify parental consent (credit card transaction record, electronic signature, or government ID). Government IDs are used solely for verification and are not retained.

**Communications:** Emails or messages you send to us for support.`,
  },
  {
    title: "3. Information We Collect from Children",
    content: `**We collect as little information as possible from children.** Child profiles on Gamerhood consist only of:

- A **display name** (chosen by the parent or child; not required to be a real name)
- An optional **avatar image**

We do **not** collect from children:
- Real names, email addresses, or physical addresses
- Phone numbers or dates of birth
- Geolocation data
- Photos of the child
- Any other personally identifiable information

All personal information associated with a child's activity (payment details, shipping addresses from orders, etc.) is collected from the parent or adult buyer — never from the child.`,
  },
  {
    title: "4. How We Use Information",
    content: `We use information collected to:

- Operate and maintain the Platform
- Process transactions and payouts
- Verify parental consent
- Moderate content for safety and copyright compliance
- Send transactional emails (order confirmations, payout notifications)
- Respond to support requests
- Improve the Platform

We do **not** use information to:
- Serve behavioral or interest-based advertising
- Build marketing profiles of children
- Sell or rent personal information to third parties
- Track children across websites or apps`,
  },
  {
    title: "5. Information Sharing",
    content: `We share information only in the following circumstances:

**Service Providers:** We share necessary data with service providers who help us operate the Platform, including:
- Stripe (payment processing)
- Printify (order fulfillment — buyer shipping address only)
- Supabase (database hosting)
- Cloud providers (image storage and processing)
- Content moderation services (uploaded images only)

All service providers are bound by contractual obligations to protect data and use it only for the services they provide to us.

**Legal Requirements:** We may disclose information when required by law, subpoena, or legal process, or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.

**With Consent:** We may share information with your explicit consent.

We do **not** sell personal information. We do not share personal information with advertisers.`,
  },
  {
    title: "6. Cookies and Tracking",
    content: `**Essential Cookies:** We use strictly necessary cookies for authentication and session management. These cookies are required for the Platform to function.

**Analytics:** We use privacy-respecting, aggregate analytics to understand Platform usage. No individual user tracking is performed.

**No Third-Party Trackers:** We do not use third-party tracking cookies, advertising pixels, or behavioral tracking on any pages accessible to children.`,
  },
  {
    title: "7. Data Security",
    content: `We implement industry-standard security measures to protect your information, including:

- Encryption in transit (TLS/HTTPS) and at rest
- Row-Level Security (RLS) in our database ensuring users can only access their own data
- Secure authentication with bcrypt password hashing
- Regular security reviews of our codebase and infrastructure
- Minimal data collection and retention

No system is 100% secure. If we become aware of a security breach that affects your personal information, we will notify you in accordance with applicable law.`,
  },
  {
    title: "8. Data Retention",
    content: `We retain personal information only as long as necessary to provide the Platform and fulfill the purposes described in this policy.

- **Account data** is retained while the account is active and for 30 days after closure
- **Order data** is retained for 3 years for legal and tax compliance
- **Design images** are deleted within 30 days of design deletion
- **Content moderation logs** are retained for 1 year
- **Parental consent records** are retained for the life of the account plus 3 years

You may request deletion of your data at any time (see Section 10).`,
  },
  {
    title: "9. COPPA Compliance",
    content: `Gamerhood is designed to comply with the Children's Online Privacy Protection Act (COPPA), including the updated final rule effective June 2025 (compliance deadline April 22, 2026). Our COPPA measures include:

- **Parental consent before collection:** No child profile is activated until verifiable parental consent is obtained
- **Minimal collection from children:** Only a display name and optional avatar
- **No behavioral tracking of children:** No cookies, pixels, or tracking for advertising purposes
- **No social features between children:** No direct messaging, comments, or communication channels
- **Parental access and control:** Parents can review, modify, or delete all data associated with their child's profile
- **Published data practices:** This Privacy Policy clearly describes our data practices
- **Reasonable security:** Industry-standard technical and organizational safeguards`,
  },
  {
    title: "10. Your Rights",
    content: `**Parents/Guardians:**
- Access all information we hold about you and your child's profile
- Correct inaccurate information
- Delete your account and all associated data
- Revoke parental consent and deactivate your child's profile
- Export your data in a portable format
- Opt out of non-essential communications

To exercise these rights, contact us at privacy@gamerhood.gg. We will respond within 30 days.

**California Residents:** You may have additional rights under the California Consumer Privacy Act (CCPA), including the right to know, delete, and opt out of sale of personal information (we do not sell personal information).`,
  },
  {
    title: "11. International Users",
    content: `The Platform is currently operated from and directed at users in the United States. If you access the Platform from outside the US, your information may be transferred to and processed in the United States. By using the Platform, you consent to this transfer.

When we expand internationally, we will update this policy to address applicable local privacy laws (including GDPR for EU/UK users).`,
  },
  {
    title: "12. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. We will notify parents of material changes via email and require renewed parental consent if changes affect how we handle children's information. The "Last Updated" date at the top of this page indicates when this policy was last revised.`,
  },
  {
    title: "13. Contact Us",
    content: `If you have questions or concerns about this Privacy Policy or our data practices, contact us at:

**Gamerhood, Inc.**
Email: privacy@gamerhood.gg

For COPPA-related inquiries, you may also contact the Federal Trade Commission at ftc.gov/coppa.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-green/10 text-neon-green">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Privacy <span className="gradient-text">Policy</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Effective: {EFFECTIVE_DATE} &bull; Last updated: {EFFECTIVE_DATE}
        </p>
      </div>

      <Card className="mt-8 border-neon-cyan/20 bg-neon-cyan/5 p-5">
        <h3 className="font-semibold text-sm text-neon-cyan">COPPA Commitment</h3>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Gamerhood is designed for families. We comply with the Children&apos;s Online Privacy
          Protection Act (COPPA). We collect minimal information from children (display name only),
          require verifiable parental consent, and never track, profile, or advertise to children.
        </p>
      </Card>

      <Separator className="my-10 bg-border/50" />

      <div className="space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-bold">{section.title}</h2>
            <div className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      <Separator className="my-10 bg-border/50" />

      <div className="text-center text-sm text-muted-foreground">
        <p>
          See also:{" "}
          <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
          {" "}&bull;{" "}
          <Link href="/dmca" className="text-primary hover:underline">DMCA Policy</Link>
          {" "}&bull;{" "}
          <Link href="/safety" className="text-primary hover:underline">Kid Safety</Link>
        </p>
      </div>
    </div>
  );
}
