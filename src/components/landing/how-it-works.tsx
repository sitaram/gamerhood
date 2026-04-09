"use client";

import { motion } from "framer-motion";
import { MessageSquare, Wand2, ShoppingBag, DollarSign } from "lucide-react";

const STEPS = [
  {
    icon: MessageSquare,
    title: "Describe Your Vision",
    description: "Tell us what you see in your head — \"a dragon dunking a basketball in a volcano\" — anything goes.",
    color: "text-neon-purple",
    bg: "bg-neon-purple/10",
  },
  {
    icon: Wand2,
    title: "AI Creates the Art",
    description: "Our AI design engine turns your words into stunning, print-ready artwork in seconds.",
    color: "text-neon-cyan",
    bg: "bg-neon-cyan/10",
  },
  {
    icon: ShoppingBag,
    title: "Pick Your Merch",
    description: "See your design on hoodies, tees, mugs, posters, and more. Choose what you love.",
    color: "text-neon-pink",
    bg: "bg-neon-pink/10",
  },
  {
    icon: DollarSign,
    title: "Sell or Keep It",
    description: "Buy it for yourself, or publish it to your shop and earn when others buy your creations.",
    color: "text-neon-green",
    bg: "bg-neon-green/10",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From idea to merch in four simple steps
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              className="relative rounded-2xl border border-border/50 bg-card p-6 transition-colors hover:border-border"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${step.bg}`}>
                  <step.icon className={`h-5 w-5 ${step.color}`} />
                </div>
                <span className="text-sm font-mono text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
