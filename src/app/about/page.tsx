import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  Heart,
  ShieldCheck,
  Zap,
  ArrowRight,
  Gamepad2,
  Palette,
  TrendingUp,
} from "lucide-react";

const VALUES = [
  {
    icon: Sparkles,
    title: "Creativity First",
    description:
      "Every kid has a vision. We give them the tools to bring it to life — no art degree required, no gatekeepers, just raw imagination powered by AI.",
    color: "text-neon-purple",
    bg: "bg-neon-purple/10",
  },
  {
    icon: ShieldCheck,
    title: "Safety Always",
    description:
      "COPPA-compliant from day one. Parent-owned accounts, automated content moderation, no child PII collected, no direct messaging between kids.",
    color: "text-neon-cyan",
    bg: "bg-neon-cyan/10",
  },
  {
    icon: Heart,
    title: "Quality Matters",
    description:
      "We obsess over print quality. Every provider is tested with real orders. If a hoodie isn't something we'd put on our own kid, it doesn't ship.",
    color: "text-neon-pink",
    bg: "bg-neon-pink/10",
  },
  {
    icon: TrendingUp,
    title: "Real Entrepreneurship",
    description:
      "This isn't pretend. Kids earn real money, learn about pricing, branding, and customer experience. Earnings go to parent-managed accounts.",
    color: "text-neon-green",
    bg: "bg-neon-green/10",
  },
];

const TIMELINE = [
  {
    emoji: "👕",
    title: "The Hoodie Problem",
    description:
      "It started when our kid turned eight and wanted streetwear that reflected his world — gaming, soccer, rap. But the merch out there was either low quality, overpriced, or covered in brands from our generation. Minecraft he was outgrowing. The hip-hop tees had Biggie and Snoop — our heroes, not his.",
  },
  {
    emoji: "🔄",
    title: "Tastes Move Fast",
    description:
      "Kids' interests change faster than any supply chain can follow. A new Fortnite season drops and suddenly they want gear for it yesterday. Corporate decision makers dealing with months-long production cycles simply can't keep up with what's trending at recess.",
  },
  {
    emoji: "🤖",
    title: "AI Changed Everything",
    description:
      "When generative AI arrived, we tried it with our kids and their eyes lit up. Suddenly they could describe what they saw in their heads and watch it come to life. A dragon dunking a basketball? Done. Their own custom anime character? Ten seconds.",
  },
  {
    emoji: "💡",
    title: "The Obvious Idea",
    description:
      "We'd already built GearOn.GG as a merch fundraiser for our son's school. We'd found premium print-on-demand providers with quality we actually trusted. The AI could generate the art. The print providers could make the merch. The kids had the ideas. Why not connect it all?",
  },
  {
    emoji: "🚀",
    title: "Gamerhood Was Born",
    description:
      "A place where kids can create the merch they actually want to wear, sell it to friends who want the same thing, and learn what it means to build something real. For the kids, by the kids.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <Gamepad2 className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          About <span className="gradient-text">Gamerhood</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          We&apos;re a family of engineers who couldn&apos;t find the merch our kid wanted —
          so we built a platform where any kid can make their own.
        </p>
      </div>

      <Separator className="my-16 bg-border/50" />

      <section>
        <h2 className="text-2xl font-bold">Our Story</h2>
        <div className="mt-8 space-y-8">
          {TIMELINE.map((item, i) => (
            <div key={i} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card border border-border/50 text-lg">
                  {item.emoji}
                </div>
                {i < TIMELINE.length - 1 && (
                  <div className="mt-2 w-px flex-1 bg-border/50" />
                )}
              </div>
              <div className="pb-8">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-16 bg-border/50" />

      <section>
        <h2 className="text-2xl font-bold text-center">What We Believe</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {VALUES.map((value) => (
            <Card
              key={value.title}
              className="border-border/50 bg-card p-6"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${value.bg}`}>
                <value.icon className={`h-5 w-5 ${value.color}`} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{value.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {value.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-16 bg-border/50" />

      <section>
        <h2 className="text-2xl font-bold">The Three Problems We Solve</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <Card className="border-border/50 bg-card p-6 text-center">
            <Palette className="mx-auto h-8 w-8 text-neon-purple" />
            <h3 className="mt-4 font-semibold">Creative Expression</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Kids want to express themselves through what they wear. AI gives them the power to create art that matches what&apos;s in their head — no drawing skills needed.
            </p>
          </Card>
          <Card className="border-border/50 bg-card p-6 text-center">
            <Zap className="mx-auto h-8 w-8 text-neon-cyan" />
            <h3 className="mt-4 font-semibold">Speed of Culture</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A new game season drops, a new meme goes viral, a new artist blows up. Print-on-demand means merch can exist the same day the trend does.
            </p>
          </Card>
          <Card className="border-border/50 bg-card p-6 text-center">
            <Heart className="mx-auto h-8 w-8 text-neon-pink" />
            <h3 className="mt-4 font-semibold">Quality You Can Trust</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We test every print provider with real orders. Heavyweight hoodies, vibrant prints, durable stitching. No single-ply hoods. No peeling logos after one wash.
            </p>
          </Card>
        </div>
      </section>

      <Separator className="my-16 bg-border/50" />

      <section className="text-center">
        <h2 className="text-2xl font-bold">Built by Parents, for Families</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground leading-relaxed">
          We&apos;re Maile and Sitaram — two engineers, parents of three, and firm believers
          that kids are more creative than adults give them credit for. Gamerhood is our way
          of proving it.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Quality streetwear to the people.
        </p>
        <div className="mt-8">
          <Link href="/create">
            <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
              <Sparkles className="h-5 w-5" />
              Try the Design Studio
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
