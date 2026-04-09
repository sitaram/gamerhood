"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Wand2,
  RotateCcw,
  ShoppingCart,
  Upload,
  Check,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";
import { DesignStyle, ProductType } from "@/lib/types";
import { toast } from "sonner";

const STYLES: { value: DesignStyle; label: string; emoji: string }[] = [
  { value: "anime", label: "Anime", emoji: "⚔️" },
  { value: "streetwear", label: "Streetwear", emoji: "🔥" },
  { value: "pixel-art", label: "Pixel Art", emoji: "👾" },
  { value: "graffiti", label: "Graffiti", emoji: "🎨" },
  { value: "minimalist", label: "Minimal", emoji: "✨" },
  { value: "vaporwave", label: "Vaporwave", emoji: "🌊" },
  { value: "comic", label: "Comic", emoji: "💥" },
  { value: "realistic", label: "Realistic", emoji: "📷" },
];

const PRODUCTS: { value: ProductType; label: string; emoji: string; base: number }[] = [
  { value: "hoodie", label: "Hoodie", emoji: "🧥", base: 42 },
  { value: "tshirt", label: "Tee", emoji: "👕", base: 26 },
  { value: "poster", label: "Poster", emoji: "🖼️", base: 15 },
  { value: "mug", label: "Mug", emoji: "☕", base: 18 },
  { value: "sticker", label: "Sticker", emoji: "🏷️", base: 6 },
  { value: "backpack", label: "Backpack", emoji: "🎒", base: 37 },
  { value: "phone-case", label: "Phone Case", emoji: "📱", base: 22 },
];

const PROMPTS = [
  "A dragon playing basketball in outer space with neon flames",
  "A cat wearing sunglasses surfing on a pizza through the galaxy",
  "A cyberpunk samurai with glowing purple sword in rain",
  "Pixel art knight fighting a robot in a retro castle",
  "A graffiti-style lion with a crown made of lightning",
];

export default function CreatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<DesignStyle>("anime");
  const [step, setStep] = useState<"prompt" | "generating" | "preview" | "products">("prompt");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<ProductType>>(new Set(["hoodie", "tshirt"]));
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setStep("generating");
    setError(null);

    try {
      const res = await fetch("/api/designs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), style }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setGeneratedImage(data.imageUrl);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("prompt");
    }
  }

  function handleRandomPrompt() {
    setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG, JPG, SVG)");
      return;
    }

    const url = URL.createObjectURL(file);
    setGeneratedImage(url);
    setStep("preview");
    setError(null);
  }

  function toggleProduct(type: ProductType) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleReset() {
    setPrompt("");
    setStep("prompt");
    setGeneratedImage(null);
    setSelectedProducts(new Set(["hoodie", "tshirt"]));
    setError(null);
  }

  async function handlePublish() {
    setPublishing(true);
    // In production: calls Printify API to create products, then saves to Supabase
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setPublishing(false);
    toast.success(
      `${selectedProducts.size} product${selectedProducts.size > 1 ? "s" : ""} published to your shop!`,
      { description: "Head to your dashboard to manage them." },
    );
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Design <span className="gradient-text">Studio</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Describe your design, pick a style, and watch the magic happen
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-12">
        <AnimatePresence mode="wait">
          {step === "prompt" && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <Card className="border-border/50 bg-card p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  What do you want to create?
                </h2>

                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your design... e.g., 'A dragon playing basketball in outer space with neon flames'"
                  className="min-h-[120px] resize-none border-border bg-background text-base"
                />

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRandomPrompt}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Random idea
                  </Button>
                  <span className="text-xs text-muted-foreground">or</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    Upload your own artwork
                  </Button>
                </div>
              </Card>

              <Card className="border-border/50 bg-card p-6">
                <h2 className="text-lg font-semibold mb-4">Pick a style</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                        style === s.value
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <span className="text-lg">{s.emoji}</span>
                      <span className="text-sm font-medium">{s.label}</span>
                    </button>
                  ))}
                </div>
              </Card>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="gap-2 bg-primary px-10 text-lg hover:bg-primary/90"
                >
                  <Wand2 className="h-5 w-5" />
                  Generate Design
                </Button>
              </div>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-20"
            >
              <div className="relative">
                <div className="h-32 w-32 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <Wand2 className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-primary" />
              </div>
              <p className="mt-8 text-xl font-semibold">Creating your design...</p>
              <p className="mt-2 text-muted-foreground">{`"${prompt}"`}</p>
              <div className="mt-4 flex gap-2">
                <Badge variant="outline" className="border-primary/30 text-primary">{style}</Badge>
              </div>
            </motion.div>
          )}

          {step === "preview" && generatedImage && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid gap-8 lg:grid-cols-2">
                <Card className="border-border/50 bg-card overflow-hidden">
                  <div className="relative aspect-square">
                    <Image
                      src={generatedImage}
                      alt="Generated design"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </Card>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Your Design is Ready!</h2>
                    {prompt && (
                      <p className="mt-2 text-muted-foreground">{`"${prompt}"`}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Badge variant="outline" className="border-primary/30 text-primary">{style}</Badge>
                      <Badge variant="outline" className="border-neon-green/30 text-neon-green">
                        {prompt ? "AI Generated" : "Uploaded"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => setStep("products")} className="gap-2 bg-primary hover:bg-primary/90">
                      <ShoppingCart className="h-4 w-4" />
                      Put It On Merch
                    </Button>
                    {prompt && (
                      <Button variant="outline" onClick={handleGenerate} className="gap-2">
                        <Wand2 className="h-4 w-4" />
                        Regenerate
                      </Button>
                    )}
                    <Button variant="outline" onClick={handleReset} className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Start Over
                    </Button>
                  </div>

                  <Card className="border-border/50 bg-card p-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3">Or upload your own artwork</h3>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 w-full border-dashed border-border"
                    >
                      <Upload className="h-4 w-4" />
                      Upload Image
                    </Button>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {step === "products" && generatedImage && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold">
                  Choose Your <span className="gradient-text">Merch</span>
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Select the products you want to create with your design
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {PRODUCTS.map((p) => {
                  const selected = selectedProducts.has(p.value);
                  return (
                    <button
                      key={p.value}
                      onClick={() => toggleProduct(p.value)}
                      className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/10 glow-border-purple"
                          : "border-border/50 bg-card hover:border-border"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="relative mx-auto mb-3 h-24 w-24 overflow-hidden rounded-lg bg-secondary">
                        <Image
                          src={generatedImage}
                          alt={p.label}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-2xl">{p.emoji}</span>
                        <h3 className="mt-1 font-semibold">{p.label}</h3>
                        <p className="text-sm text-muted-foreground">from ${p.base}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => setStep("preview")} className="gap-2">
                  Back to Preview
                </Button>
                <Button
                  disabled={selectedProducts.size === 0 || publishing}
                  onClick={handlePublish}
                  className="gap-2 bg-primary px-8 hover:bg-primary/90"
                >
                  {publishing ? (
                    <>
                      <Wand2 className="h-4 w-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Publish to My Shop ({selectedProducts.size} items)
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
