"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, ShoppingBag, ArrowRight } from "lucide-react";

const WORDS = ["merch", "hoodies", "tees", "posters", "mugs", "stickers", "backpacks"];

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-24 sm:pt-32 lg:pt-40">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Design Studio
            </span>
          </motion.div>

          <motion.h1
            className="mt-8 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="block text-foreground">Imagine it.</span>
            <span className="block gradient-text">Create it.</span>
            <span className="block text-foreground">
              Sell it on{" "}
              <RotatingWord words={WORDS} />
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            The marketplace where young creators turn wild ideas into real merch.
            Describe your vision, AI brings it to life, and we print it on premium gear.
            You set the price and keep the profits.
            <span className="mt-3 block text-center text-foreground font-medium">For kids, by kids.</span>
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
