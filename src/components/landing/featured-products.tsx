"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import type { Product } from "@/lib/types";

export function FeaturedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 px-6 py-16 text-center">
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
              Be the First
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              The shop is <span className="gradient-text">empty</span> — for now
            </h2>
            <p className="mt-3 max-w-xl mx-auto text-muted-foreground">
              No products yet. Be the first creator to publish something. Your design could be the one that kicks it all off.
            </p>
            <Link href="/create" className="mt-6 inline-block">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Sparkles className="h-4 w-4" />
                Create the First Drop
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
              Fresh Drops
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Trending <span className="gradient-text">Now</span>
            </h2>
            <p className="mt-2 text-muted-foreground">
              The latest designs from our community of young creators
            </p>
          </div>
          <Link href="/shop" className="hidden sm:block">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link href="/shop">
            <Button variant="outline" className="gap-2">
              View All Products
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
