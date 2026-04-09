"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, HelpCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_SECTIONS: { title: string; tag: string; tagColor: string; items: FAQItem[] }[] = [
  {
    title: "Getting Started",
    tag: "Basics",
    tagColor: "border-neon-purple/30 text-neon-purple",
    items: [
      {
        question: "What is Gamerhood?",
        answer:
          "Gamerhood is a marketplace where young creators design their own merch — hoodies, tees, mugs, posters, and more — using AI-powered design tools. Designs are printed on demand and shipped directly to buyers. Creators earn money from every sale.",
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
          "Earnings accumulate in your parent-managed Stripe Connect account. When a product sells, the revenue splits: Printify's production cost is covered, Gamerhood takes a platform fee (15%), and the rest goes to your account. Payouts are on a regular schedule to your bank account.",
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
          "Products are printed on demand by vetted print providers through Printify. We've tested multiple providers with real orders and selected the ones with the best print quality, material quality, and shipping speed. We don't hold inventory — each item is made fresh when ordered.",
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
          "Absolutely. You can upload PNG, JPG, or SVG files. We recommend at least 4500 x 5400 pixels for the best print quality. Uploaded artwork goes through the same content moderation as AI-generated designs.",
      },
      {
        question: "How do I set my prices?",
        answer:
          "Each product has a base cost (what Printify charges to produce it). You set a markup on top of that — this is your profit. For example, if a hoodie costs $28 to produce and you add a $14 markup, it sells for $42, and you earn $14 minus the platform fee.",
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
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      onClick={() => setOpen(!open)}
      className="w-full text-left"
    >
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
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {item.answer}
          </p>
        )}
      </div>
    </button>
  );
}

export default function FAQPage() {
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
        {FAQ_SECTIONS.map((section) => (
          <section key={section.title}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold">{section.title}</h2>
              <Badge variant="outline" className={section.tagColor}>
                {section.tag}
              </Badge>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <FAQAccordion key={item.question} item={item} />
              ))}
            </div>
          </section>
        ))}
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
