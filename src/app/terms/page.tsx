import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ScrollText } from "lucide-react";

const EFFECTIVE_DATE = "April 22, 2026";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using Gamerhood ("the Platform," "we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Platform.

The Platform is operated by Gamerhood, Inc. and is intended for use by parents/guardians and their children. If you are creating an account, you represent that you are at least 18 years of age and the legal parent or guardian of any child who will use the Platform under your account.`,
  },
  {
    title: "2. Account Structure",
    content: `**Parent Accounts.** All accounts on Gamerhood are created and owned by a parent or legal guardian ("Parent Account"). The parent provides all required personal information and is responsible for all activity under the account.

**Child Profiles.** Parents may create one or more managed profiles for their children ("Child Profiles"). Child Profiles consist only of a display name and optional avatar. No personal information is collected from children.

**Account Security.** You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.`,
  },
  {
    title: "3. Parental Consent",
    content: `Before any Child Profile can be activated, the parent must complete a Verifiable Parental Consent (VPC) process as required by the Children's Online Privacy Protection Act (COPPA). Approved methods include:

- Credit card verification (a small refundable charge)
- Signed electronic consent form
- Government-issued ID verification

You may revoke consent and request deletion of your child's profile and associated data at any time.`,
  },
  {
    title: "4. Creator Terms",
    content: `**Original Work.** By uploading or generating designs on the Platform, you represent and warrant that: (a) the designs are your original work or you have all necessary rights to use them; (b) the designs do not infringe any third-party intellectual property rights; (c) the designs comply with our Content Guidelines.

**License Grant.** You retain ownership of your designs. By publishing a design, you grant Gamerhood a non-exclusive, worldwide license to display, reproduce, and distribute the design as part of products listed on the Platform.

**Content Moderation.** All designs are subject to automated and manual content review. We reserve the right to reject, remove, or suspend any design that violates our Content Guidelines, infringes intellectual property, or is otherwise objectionable.

**Pricing.** Creators set their own markup above the base production cost. Gamerhood does not control or guarantee any minimum earnings.`,
  },
  {
    title: "5. Payments and Earnings",
    content: `**Payment Processing.** All payments are processed through Stripe. By using the Platform, you agree to Stripe's Terms of Service.

**Revenue Split.** When a product is sold, revenue is distributed as follows: (1) the print provider's production and shipping cost; (2) a platform fee of 15%; (3) the remainder goes to the creator's parent-managed Stripe Connect account.

**Payouts.** Creator earnings are paid out on a regular schedule (typically weekly) to the bank account linked to the parent's Stripe Connect account. Gamerhood does not hold or control creator funds — they are managed entirely through Stripe.

**Refunds.** If a buyer receives a defective product and is issued a refund, the creator earnings for that order may be reversed.`,
  },
  {
    title: "6. Intellectual Property",
    content: `**Your Content.** You retain all rights to designs you create or upload. You are solely responsible for ensuring your designs do not infringe third-party intellectual property.

**Our Content.** The Gamerhood platform, including its design, code, branding, and documentation, is owned by Gamerhood, Inc. and protected by copyright and trademark law.

**Copyright Infringement.** We comply with the Digital Millennium Copyright Act (DMCA). If you believe content on the Platform infringes your copyright, please see our DMCA Policy.

**Repeat Infringers.** Accounts that receive three (3) valid copyright strikes will be permanently suspended. This policy is required under the DMCA safe harbor provisions.`,
  },
  {
    title: "7. Prohibited Content",
    content: `You may not upload, generate, or publish designs that:

- Depict violence, gore, or self-harm
- Contain nudity or sexually explicit content
- Promote illegal drugs, alcohol, or tobacco (especially to minors)
- Contain hate speech, slurs, or discriminatory content
- Infringe copyrights, trademarks, or other intellectual property
- Impersonate real people without their consent
- Contain personal information of any individual
- Promote illegal activities

We reserve the right to remove any content and suspend any account that violates these guidelines.`,
  },
  {
    title: "8. Product Quality and Fulfillment",
    content: `**Print-on-Demand.** All products are manufactured and shipped by third-party print providers through Printify. Gamerhood does not manufacture, store, or ship physical products.

**Quality Standards.** We select and vet print providers for quality, but we cannot guarantee every product will be free of defects. If you receive a defective product, contact us within 30 days for a replacement or refund.

**Shipping.** Estimated shipping times are provided as guidelines. Actual delivery times may vary based on location and print provider.`,
  },
  {
    title: "9. Limitation of Liability",
    content: `To the maximum extent permitted by law, Gamerhood shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability shall not exceed the amounts paid to or by you through the Platform in the twelve (12) months preceding the claim.

The Platform is provided "as is" without warranties of any kind, express or implied.`,
  },
  {
    title: "10. Termination",
    content: `**By You.** You may close your account at any time. Upon closure, any outstanding earnings will be paid out per the regular payout schedule.

**By Us.** We may suspend or terminate your account for violation of these Terms, including but not limited to: repeated copyright infringement, uploading prohibited content, fraudulent activity, or failure to maintain parental consent.`,
  },
  {
    title: "11. Changes to These Terms",
    content: `We may update these Terms from time to time. We will notify you of material changes via email and/or a prominent notice on the Platform. Continued use of the Platform after changes take effect constitutes acceptance of the updated Terms.`,
  },
  {
    title: "12. Contact",
    content: `If you have questions about these Terms, contact us at:

**Gamerhood, Inc.**
Email: legal@gamerhood.gg`,
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <ScrollText className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Terms of <span className="gradient-text">Service</span>
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Effective: {EFFECTIVE_DATE} &bull; Last updated: {EFFECTIVE_DATE}
        </p>
      </div>

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
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          {" "}&bull;{" "}
          <Link href="/dmca" className="text-primary hover:underline">DMCA Policy</Link>
          {" "}&bull;{" "}
          <Link href="/safety" className="text-primary hover:underline">Kid Safety</Link>
        </p>
      </div>
    </div>
  );
}
