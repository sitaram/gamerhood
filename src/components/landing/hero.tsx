"use client";

import Link from "next/link";
import { BrandHeroScene } from "@/components/brand/brand-logo";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, ShoppingBag, ArrowRight } from "lucide-react";

const WORDS = ["merch", "hoodies", "tees", "posters", "mugs", "stickers", "backpacks"];

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-2 sm:pt-3">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-6 flex w-full max-w-none justify-center sm:mb-8"
          >
            {/* Wordmark is baked into the scene illustration — slight bleed on XS keeps the artwork edge-to-edge. */}
            <BrandHeroScene className="-mx-0.5 w-[calc(100%+0.25rem)] max-w-none sm:mx-auto sm:w-full" priority />
          </motion.div>

          <motion.h1
            className="mt-8 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="block text-foreground">Imagine it.</span>
            <span className="block gradient-text">Create it.</span>
            <span className="block">
              <span className="gradient-text">Make money on</span>{" "}
              <RotatingWord words={WORDS} />
            </span>
            <span className="mt-2 block text-3xl font-bold sm:text-4xl lg:text-5xl">
              <span className="text-foreground/90 italic">Start buying your </span>
              <span className="gradient-text-warm not-italic">drip </span>
              <span className="gradient-text not-italic">for less.</span>
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            The marketplace where young creators turn ideas into real merch.
            <span className="block">You set the price and keep the profits.</span>
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link href="/create">
              <Button size="lg" className="gap-2 bg-primary px-8 text-lg hover:bg-primary/90">
                <Sparkles className="h-5 w-5" />
                Start Creating — It&apos;s Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/shop">
              <Button size="lg" variant="outline" className="gap-2 px-8 text-lg border-border hover:bg-secondary">
                <ShoppingBag className="h-5 w-5" />
                Browse the Shop
              </Button>
            </Link>
          </motion.div>

          <motion.p
            className="mt-6 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            Parent-supervised accounts &bull; COPPA compliant &bull; No credit card needed to design
          </motion.p>

          {process.env.NODE_ENV === "development" && (
            <motion.p
              className="mt-4 text-center text-xs text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.55 }}
            >
              <Link
                href="/create?demo=hoodie"
                className="text-amber-700 underline decoration-amber-500/60 underline-offset-2 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
              >
                Local dev — test hoodie publish flow
              </Link>
              <span className="mx-1.5 opacity-60">·</span>
              <span className="opacity-90">placeholder art, no Gemini</span>
              <span className="mt-2 block max-w-xl mx-auto text-[11px] leading-snug text-muted-foreground/85">
                In-app previews that can&apos;t reach the dev server usually show “connection failed” —
                open{" "}
                <code className="rounded bg-background/70 px-1 py-px font-mono text-[10px]">
                  http://localhost:3000/
                </code>{" "}
                — use the URL your terminal prints if the port differs. Open{" "}
                <code className="rounded bg-background/70 px-1 py-px font-mono text-[10px]">
                  http://127.0.0.1:3000/
                </code>{" "}
                if localhost misbehaves. Run <code className="font-mono text-[10px]">pnpm dev</code>{" "}
                first; &quot;refused to connect&quot; means nothing is listening yet.
              </span>
            </motion.p>
          )}
        </div>
      </div>
    </section>
  );
}

function RotatingWord({ words }: { words: string[] }) {
  return (
    <span className="relative inline-block min-w-[180px]">
      {words.map((word, i) => (
        <motion.span
          key={word}
          className="absolute left-0 gradient-text-warm font-black"
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [20, 0, 0, -20],
          }}
          transition={{
            duration: 3,
            delay: i * 3,
            repeat: Infinity,
            repeatDelay: (words.length - 1) * 3,
            times: [0, 0.1, 0.9, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
      <span className="invisible">{words[0]}</span>
    </span>
  );
}
