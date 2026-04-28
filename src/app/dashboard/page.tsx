import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, Wand2, Pencil, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getDesignsByProfile,
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

const STYLE_LABEL: Record<string, string> = {
  anime: "Anime",
  streetwear: "Streetwear",
  "pixel-art": "Pixel Art",
  graffiti: "Graffiti",
  minimalist: "Minimal",
  vaporwave: "Vaporwave",
  comic: "Comic",
  realistic: "Realistic",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Creator";

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  const { data: designs } = profile
    ? await getDesignsByProfile(supabase, profile.id)
    : { data: [] };

  const designList = designs ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {displayName}
          </h1>
        </div>
        <Link href="/create">
          <Button size="lg" className="gap-2 bg-primary px-8 text-base hover:bg-primary/90">
            <Sparkles className="h-5 w-5" />
            Start Creating
          </Button>
        </Link>
      </div>

      <div className="mt-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Your Designs
            {designList.length > 0 && (
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                {designList.length}
              </span>
            )}
          </h2>
        </div>

        {designList.length === 0 ? (
          <Card className="flex flex-col items-center justify-center border-dashed border-border/50 bg-card/50 p-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ImageOff className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">No designs yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Your creations will show up here. Start with a prompt and let the AI bring your idea to life.
            </p>
            <Link href="/create" className="mt-6">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Wand2 className="h-4 w-4" />
                Create your first design
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {designList.map((d) => (
              <Card
                key={d.id}
                className="group overflow-hidden border-border/50 bg-card transition-all hover:border-primary/40"
              >
                <div className="relative aspect-square overflow-hidden bg-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.image_url}
                    alt={d.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm text-foreground">
                      {d.prompt || d.title}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-primary/30 text-xs text-primary">
                        {STYLE_LABEL[d.style] || d.style}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(d.created_at)}</span>
                    </div>
                    <Link href={`/create?designId=${d.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
