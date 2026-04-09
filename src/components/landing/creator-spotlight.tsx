"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { getTrendingCreators } from "@/lib/mock-data";

export function CreatorSpotlight() {
  const creators = getTrendingCreators(4);

  return (
    <section className="py-24 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="outline" className="mb-3 border-accent/30 text-accent">
            Creator Spotlight
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Meet the <span className="gradient-text">Creators</span>
          </h2>
          <p className="mt-2 text-muted-foreground">
            Young entrepreneurs building their brands, one design at a time
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {creators.map((creator, i) => (
            <motion.div
              key={creator.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Link href={`/shop/${creator.slug}`}>
                <div className="group rounded-2xl border border-border/50 bg-card p-6 text-center transition-all hover:border-primary/30 hover:glow-border-purple">
                  <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary">
                    <Image
                      src={creator.avatarUrl}
                      alt={creator.displayName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold group-hover:text-primary transition-colors">
                    {creator.displayName}
                  </h3>
                  <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 text-neon-orange fill-neon-orange" />
                    Level {creator.level}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{creator.bio}</p>
                  <div className="mt-4 flex justify-center gap-3 text-xs text-muted-foreground">
                    <span>{creator.totalDesigns} designs</span>
                    <span>&bull;</span>
                    <span>{creator.totalSales} sales</span>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {creator.badges.slice(0, 3).map((badge) => (
                      <span key={badge.id} className="text-base" title={badge.name}>
                        {badge.icon}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
