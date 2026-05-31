"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, HelpCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLATFORM_FEE_PERCENT,
  STRIPE_FEE_PERCENT,
  STRIPE_FEE_FIXED_CENTS,
} from "@/lib/pricing/rates";
import { computeTakeHome } from "@/lib/pricing/take-home";
import { formatUsd } from "@/lib/pricing/format";

interface FAQItem {
  question: string;
  /** Plain string OR a React node when we want a worked example, list, etc. */
  answer: ReactNode;
}

interface FAQSection {
  /** Optional anchor id so we can deep-link from the price editor, etc. */
  id?: string;
  title: string;
  tag: string;
  tagColor: string;
  /** Optional lead paragraph rendered above the accordion stack. */
  intro?: ReactNode;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "Getting Started",
    tag: "Basics",
    tagColor: "border-neon-purple/30 text-neon-purple",
    items: [
      {
        question: "What is Gamerhood?",
        answer: (
          <>
            GamerHood.GG is a marketplace where young creators design their own merch — hoodies,
            tees, mugs, posters, and more — using AI-powered design tools. Designs are printed on
            demand and shipped directly to buyers. Creators earn money from every sale. The
            platform is operated by GamerHood LLC, a California company. See our{" "}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>{" "}
            for legal details.
          </>
        ),
      },
      {
        question: "Who is Gamerhood for?",
        answer:
          "Gamerhood is for kids and teens who want to express themselves through custom merch, and for parents who want a safe, supervised way for their children to explore creativity and entrepreneurship. Shoppers of any age can browse and buy.",
      },
      {
        question: "How much does it cost to get started?",
        answer:
          "Creating an account and designing merch is completely free. You only pay when you or someone else buys a product. There are no monthly fees, no listing fees, and no upfront costs.",
      },
      {
        question: "Do I need to know how to draw?",
        answer:
          "Not at all. Our AI Design Studio lets you describe what you want in plain language — like \"a dragon playing basketball in outer space\" — and generates print-ready artwork in seconds. You can also upload your own artwork if you prefer.",
      },
    ],
  },
  {
    title: "For Parents",
    tag: "Parents",
    tagColor: "border-neon-cyan/30 text-neon-cyan",
    items: [
      {
        question: "How does the parent account work?",
        answer:
          "Parents create the account and manage everything. Your child operates as a \"managed profile\" under your account — they get a display name and a storefront, but they never provide personal information. You control payment settings, approve designs, and can disable the profile at any time.",
      },
      {
        question: "Is Gamerhood safe for my child?",
        answer:
          "Yes. We're COPPA-compliant, which means: no personal information is collected from children, all content is automatically screened for safety, there's no direct messaging between kids, and there's no behavioral advertising or tracking on child-facing pages. See our Kid Safety page for full details.",
      },
      {
        question: "How does my child get paid?",
        answer:
          "Earnings accumulate in your parent-managed Stripe Connect account. When a product sells, the revenue splits: Printful's production cost is covered, GamerHood.GG takes an 8% platform fee — about half of what marketplaces like Etsy charge once you add up their transaction, payment processing, and listing fees — and the rest goes to your account. That 8% includes the AI tokens kids use to create designs on the site, plus content moderation and hosting. Stripe's credit-card processing is charged separately at their standard rate. Payouts are on a regular schedule to your bank account.",
      },
      {
        question: "Can I review designs before they go public?",
        answer:
          "Yes. All designs go through automated content moderation (safety screening + copyright check), and you can additionally require manual approval before any design is published to your child's storefront.",
      },
    ],
  },
  {
    title: "Products & Shipping",
    tag: "Orders",
    tagColor: "border-neon-green/30 text-neon-green",
    items: [
      {
        question: "Who makes the products?",
        answer:
          "Products are printed on demand by Printful, which manufactures everything in-house at owned facilities (no third-party providers). They use premium blanks like Bella+Canvas, Champion, and AS Colour, and ship from fulfillment centers in the US, EU, and Asia. We don't hold inventory — each item is made fresh when ordered.",
      },
      {
        question: "What's the quality like?",
        answer:
          "We're serious about quality. Our default hoodie is heavyweight (10+ oz), double-ply hood, with DTG or sublimation printing that won't crack or peel. We order samples from every provider before approving them. If something doesn't meet our standards, we don't use that provider.",
      },
      {
        question: "How long does shipping take?",
        answer:
          "Production typically takes 2–5 business days. Shipping within the US is another 3–7 business days (standard) or 2–4 days (express). You'll receive a tracking number as soon as the item ships.",
      },
      {
        question: "What if I'm not happy with my order?",
        answer:
          "We offer a 30-day satisfaction guarantee. If there's a print defect, wrong size, or quality issue, contact us and we'll make it right — either a reprint or a full refund.",
      },
      {
        question: "Do you ship internationally?",
        answer:
          "We're starting with US shipping only for our initial launch. International shipping (Canada, UK, EU, Australia) is on our roadmap. Our print partners have fulfillment centers worldwide, so when we expand, shipping times will still be fast.",
      },
    ],
  },
  {
    title: "Creating & Selling",
    tag: "Creators",
    tagColor: "border-neon-pink/30 text-neon-pink",
    items: [
      {
        question: "How does the AI Design Studio work?",
        answer:
          "Type a description of what you want (e.g., \"a cyberpunk samurai with a glowing sword\"), pick an art style (anime, pixel art, streetwear, etc.), and our AI generates original artwork in seconds. You can regenerate until you love it, then apply it to any product type.",
      },
      {
        question: "Can I upload my own artwork instead of using AI?",
        answer:
          "Absolutely. Upload PNG, JPG, WebP, GIF, or SVG. SVG is converted to a high-resolution print file automatically; use alpha for transparent areas so your design knocks out cleanly on colored garments. We recommend at least 3000 px on the longest side for non-vector art for the best print clarity.",
      },
      {
        question: "How do I set my prices?",
        answer: (
          <>
            Each product has a base cost (item + shipping + the platform and
            credit-card fees). You set a listing price above that — whatever&apos;s
            left is your take-home. Tune prices any time from{" "}
            <Link href="/dashboard/storefront" className="underline">
              your storefront dashboard
            </Link>
            ; the editor shows the exact take-home as you type. For a deeper
            breakdown see <a href="#pricing" className="underline">How pricing works</a>{" "}
            and <a href="#pricing-tips" className="underline">How do I pick a good price?</a>
          </>
        ),
      },
      {
        question: "What about copyright? Can I make fan art?",
        answer:
          "You must own or have rights to all artwork you publish. Fan art of copyrighted characters (Nintendo, Marvel, Disney, etc.) is not allowed and will be flagged by our automated screening. Original work \"inspired by\" a genre or style is fine — original characters in an anime style, a space scene inspired by a game, etc.",
      },
      {
        question: "What are levels, XP, and badges?",
        answer:
          "Gamerhood gamifies the creator experience. You earn XP for publishing designs, making sales, and hitting milestones. XP levels up your profile, and you unlock badges like \"First Drop\" (first design), \"Cha-Ching!\" (first sale), and \"Legend\" (100 sales). Badges appear on your storefront.",
      },
    ],
  },
  {
    id: "returns",
    title: "Returns",
    tag: "Orders",
    tagColor: "border-neon-green/30 text-neon-green",
    intro:
      "Every Gamerhood item is printed on demand the moment you order, so we generally can't accept returns for buyer's-remorse reasons. But we always stand behind quality.",
    items: [
      {
        question: "Can I return an item just because I changed my mind?",
        answer:
          "Because each item is made-to-order specifically for you, we generally can't accept buyer's-remorse returns — there's no shelf to restock it to. If you're not sure about size or fit, check the size guide on the product page before ordering.",
      },
      {
        question: "What if my item arrives damaged or misprinted?",
        answer: (
          <>
            We&apos;ll make it right. Email{" "}
            <a
              className="underline"
              href="mailto:support@gamerhood.gg?subject=Damaged%20order"
            >
              support@gamerhood.gg
            </a>{" "}
            within 30 days of delivery with your order number and clear photos of the
            issue. Damage in transit or a manufacturer (Printful) misprint gets a
            free reprint or full refund — your call. This is our 30-day satisfaction
            guarantee.
          </>
        ),
      },
      {
        question: "What if I never received my order?",
        answer:
          "Reach out to support with your order number. We'll check tracking, file a claim with the carrier if needed, and reprint or refund. Don't wait — let us know as soon as the delivery date passes without the package showing up.",
      },
    ],
  },
  {
    id: "exchanges",
    title: "Exchanges",
    tag: "Orders",
    tagColor: "border-neon-green/30 text-neon-green",
    intro:
      "Same made-to-order constraint as returns — we don't keep inventory to swap from. But we're flexible and want you in a piece you love.",
    items: [
      {
        question: "Can I exchange for a different size or color?",
        answer: (
          <>
            We generally can&apos;t do straight size or color swaps, because the
            original item was printed just for you. That said — email{" "}
            <a
              className="underline"
              href="mailto:support@gamerhood.gg?subject=Exchange%20request"
            >
              support@gamerhood.gg
            </a>{" "}
            with your order number and we&apos;ll work it out case-by-case, especially
            if the size chart was misleading or our description was off.
          </>
        ),
      },
      {
        question: "How do I avoid needing an exchange?",
        answer:
          "Check the size chart on the product page — every garment has Printful's exact measurements per size. If you're between sizes on a hoodie, size up; on a tee, your usual size is usually right.",
      },
    ],
  },
  {
    id: "pricing",
    title: "How pricing works",
    tag: "Money",
    tagColor: "border-neon-cyan/30 text-neon-cyan",
    intro:
      "Every sale on Gamerhood is split between four buckets. Here's exactly what comes out of each listing price — and what's left for the creator.",
    items: [
      {
        question: "Who sets the price on a listing?",
        answer:
          "The creator does. From the storefront dashboard you can edit the listing price any time. We show the take-home live as you type and refuse to let you save a price below the floor (the price where you'd lose money on the sale).",
      },
      {
        question: "What gets subtracted from each sale?",
        answer: (
          <>
            <p>From each sale we subtract, in order:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Item base cost</strong> — what the manufacturer (Printful)
                charges us to print + ship the item to the buyer.
              </li>
              <li>
                <strong>Credit-card processing</strong> — Stripe&apos;s standard rate
                of {STRIPE_FEE_PERCENT}% + {formatUsd(STRIPE_FEE_FIXED_CENTS)} per
                charge.
              </li>
              <li>
                <strong>Gamerhood platform fee</strong> — {PLATFORM_FEE_PERCENT}% of
                the listing price. That includes the AI tokens kids use to create
                designs on the site, plus content moderation, hosting, and running
                the marketplace — about half of what Etsy charges once you add up
                their transaction, payment-processing, and listing fees.
              </li>
            </ul>
            <p className="mt-2">Whatever&apos;s left is the creator&apos;s take-home.</p>
          </>
        ),
      },
      {
        question: "Can you show me an example?",
        answer: <PricingWorkedExample />,
      },
      {
        question: "Is shipping calculated for everyone?",
        answer:
          "The shipping number in your base cost is an estimate for US domestic standard shipping. International orders cost a bit more to ship and may slightly reduce your take-home on those specific sales.",
      },
      {
        question: "How and when do I get paid?",
        answer:
          "Payouts go to your parent-managed Stripe Connect account on Stripe's standard schedule (typically every 2–7 days). Connect your account from the dashboard — until then, sales still happen but the payout queues up.",
      },
    ],
  },
  {
    id: "pricing-tips",
    title: "How do I pick a good price?",
    tag: "Money",
    tagColor: "border-neon-cyan/30 text-neon-cyan",
    intro:
      "This is the real-world entrepreneurship part. Pricing isn't math you do once — it's an experiment you keep running.",
    items: [
      {
        question: "Why do some people pay more for the same thing?",
        answer: (
          <>
            <p>
              Two T-shirts can cost the same to make, but one might sell for $20 and
              another for $60. What&apos;s the difference? <em>Value</em> — and
              value isn&apos;t just about cost. It&apos;s about how much someone
              wants the thing you made.
            </p>
            <p className="mt-2">Things that make people willing to pay more:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>A design they can&apos;t get anywhere else.</strong> Limited
                editions, your own art style, jokes only your community gets.
              </li>
              <li>
                <strong>Quality and care.</strong> A clean, well-thought-out design
                beats a rushed one every time.
              </li>
              <li>
                <strong>Belonging.</strong> Wearing your merch makes someone feel
                part of a group — your fans, your team, your inside joke.
              </li>
              <li>
                <strong>Scarcity.</strong> &quot;Only 50 made&quot; is a real reason
                people will pay more — but only if it&apos;s true.
              </li>
              <li>
                <strong>Story.</strong> Why did you make this? What does it mean?
                People buy designs that mean something to them.
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "Can a price be too high?",
        answer:
          "Yes. If you list your T-shirt for $1,000 because you love it, you probably won't find a buyer — even if it's amazing. Pricing is a deal between you and the buyer. You both have to feel like it's fair.",
      },
      {
        question: "Where should I start?",
        answer: (
          <>
            <p>A good starting place:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Look at what other creators selling similar things charge (Etsy,
                Redbubble, even big brands — you can browse them in seconds).
              </li>
              <li>
                Aim for a take-home you&apos;d be excited to earn per sale, but stay
                close to what real buyers expect to pay.
              </li>
              <li>
                Start a little higher than the minimum. You can always lower the
                price if it isn&apos;t selling.
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "What if nobody buys at my price?",
        answer:
          "That's information, not a verdict. Real entrepreneurs don't guess once and stop. Try a price for a week. If no one buys, lower it $2. If lots of people buy, try raising it $2. That's how every store on Earth figures out pricing — including the big ones.",
      },
    ],
  },
  {
    id: "multiple-storefronts",
    title: "Can I have more than one storefront?",
    tag: "Storefronts",
    tagColor: "border-neon-pink/30 text-neon-pink",
    intro:
      "Yes! You can run as many storefronts as you want from a single Gamerhood account. Each one has its own URL, name, banner, and look — perfect for keeping different audiences separate.",
    items: [
      {
        question: "Ideas to spark the imagination",
        answer: (
          <>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>A family storefront</strong> — picture your grandparents,
                aunts, and uncles finally having a place to buy a hoodie with the
                family last name on it, or a mug printed with everyone&apos;s
                birthday. Make it your own family&apos;s little brand.
              </li>
              <li>
                <strong>A fandom or team storefront</strong> — designs for your
                gaming clan, sports team, school club, or favorite show.
              </li>
              <li>
                <strong>A &quot;just for friends&quot; storefront</strong> — inside
                jokes only your group gets, on T-shirts only your group will buy.
              </li>
              <li>
                <strong>Your personal art storefront</strong> — your real designs,
                separate from the silly ones.
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "How it works",
        answer: (
          <>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                You can create new storefronts any time from{" "}
                <Link href="/dashboard/settings" className="underline">
                  Dashboard → Settings → Your storefronts
                </Link>
                .
              </li>
              <li>
                Each storefront has its own page (like{" "}
                <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">
                  gamerhood.gg/shop/the-ohye-family
                </code>
                ), its own QR code, and its own banner.
              </li>
              <li>
                All storefronts share <strong>one</strong> payout account (your
                Stripe Connect account), so money from all of them lands in the
                same bank.
              </li>
              <li>
                All storefronts share your creator level and XP — so the work you
                do on one helps level them all up.
              </li>
              <li>
                When you publish a new design, you&apos;ll pick which storefront
                it goes on.
              </li>
            </ul>
          </>
        ),
      },
      {
        question: "Are there any rules I should know about?",
        answer:
          "Every storefront still has to follow the same content rules. You can't use a storefront to sneak around our guidelines — same kid-safe screening, same copyright check, same Acceptable Use Policy. If one storefront gets flagged for misuse, it affects all of them.",
      },
    ],
  },
];

function FAQAccordion({
  item,
  defaultOpen = false,
}: {
  item: FAQItem;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left">
      <div
        className={cn(
          "rounded-xl border bg-card p-5 transition-all",
          open ? "border-primary/30" : "border-border/50 hover:border-border",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-semibold text-sm pr-4">{item.question}</h3>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
        {open && (
          <div className="mt-3 text-sm text-muted-foreground leading-relaxed [&_strong]:text-foreground">
            {typeof item.answer === "string" ? <p>{item.answer}</p> : item.answer}
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Worked pricing example used in the `#pricing` section. Numbers run through
 * `computeTakeHome` so the example never drifts from the live math — change
 * the platform fee in one place and this paragraph updates with it.
 */
function PricingWorkedExample() {
  const priceCents = 2500;
  const itemCents = 900;
  const shippingCents = 400;
  const { takeHomeCents, breakdown } = computeTakeHome({
    priceCents,
    itemWholesaleCents: itemCents,
    shippingCents,
  });
  return (
    <p>
      Say you list a hoodie for <strong>{formatUsd(priceCents)}</strong>. We subtract{" "}
      {formatUsd(breakdown.itemCents)} item cost,{" "}
      {formatUsd(breakdown.shippingCents)} shipping,{" "}
      {formatUsd(breakdown.platformCents)} platform fee, and{" "}
      {formatUsd(breakdown.processingCents)} credit-card processing. You take home{" "}
      <strong className="text-emerald-500">{formatUsd(takeHomeCents)}</strong>.
    </p>
  );
}

/**
 * Track the URL hash so the targeted FAQ section can be auto-expanded and
 * highlighted. Reads happen client-side only to avoid hydration mismatches.
 */
function useHashTarget(): string {
  const [hash, setHash] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => setHash(window.location.hash.slice(1));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  useEffect(() => {
    if (!hash) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash]);
  return hash;
}

export default function FAQPage() {
  const hashId = useHashTarget();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <HelpCircle className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Frequently Asked <span className="gradient-text">Questions</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Everything you need to know about Gamerhood, from getting started to getting paid.
        </p>
      </div>

      <div className="mt-12 space-y-12">
        {FAQ_SECTIONS.map((section) => {
          const targetMatches = Boolean(section.id && section.id === hashId);
          return (
            <section
              key={section.title}
              id={section.id}
              className={cn(
                "scroll-mt-24",
                targetMatches && "rounded-2xl ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold">{section.title}</h2>
                <Badge variant="outline" className={section.tagColor}>
                  {section.tag}
                </Badge>
              </div>
              {section.intro && (
                <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                  {section.intro}
                </p>
              )}
              <div className="space-y-3">
                {section.items.map((item, i) => (
                  <FAQAccordion
                    key={item.question}
                    item={item}
                    defaultOpen={targetMatches && i === 0}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Separator className="my-12 bg-border/50" />

      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
        <h2 className="text-xl font-bold">Still Have Questions?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re here to help. Reach out and we&apos;ll get back to you as soon as possible.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href="mailto:support@gamerhood.gg?subject=Support%20Request">
            <Button variant="outline" className="gap-2 border-border/50">
              Contact Support
            </Button>
          </a>
          <Link href="/safety">
            <Button variant="ghost" className="gap-2 text-muted-foreground">
              Kid Safety Info
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
