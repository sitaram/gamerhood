"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-12 text-center sm:p-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute inset-0 -z-10">
            <div className="absolute left-1/3 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-1/3 bottom-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to make something{" "}
            <span className="gradient-text">epic</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Your next favorite hoodie is one prompt away. Jump into the Design Studio
            and see what you can create.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/create">
              <Button size="lg" className="gap-2 bg-primary px-8 text-lg hover:bg-primary/90">
                <Sparkles className="h-5 w-5" />
                Open Design Studio
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Free to design &bull; Only pay when you order &bull; Premium quality guaranteed
          </p>
        </motion.div>
      </div>
    </section>
  );
}
