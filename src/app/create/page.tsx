"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sparkles,
  Wand2,
  RotateCcw,
  ShoppingCart,
  Upload,
  AlertCircle,
  Pencil,
  Download,
  LogIn,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DesignStyle, ProductType } from "@/lib/types";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import {
  MAX_FREE_GENERATIONS,
  addAnonDesign,
  getAnonDesigns,
} from "@/lib/anon-designs";
import { sanitizeSlugInput, MAX_PRODUCT_CATEGORY_SLUG_LEN } from "@/lib/slug-utils";
import { PrintPlacementEditor } from "@/components/create/print-placement-editor";
import { CategoryProductPicker } from "@/components/create/category-product-picker";
import { PRODUCT_TYPE_LABELS } from "@/components/storefront/product-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_STORED } from "@/lib/print/placement";
import type { StoredPrintPlacement } from "@/lib/print/placement";

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


/** Same host as `/api/designs/generate` when `GEMINI_API_KEY` is unset. */
const DEV_DEMO_HOODIE_ART_URL =
  "https://placehold.co/1024x1024/1a1a2e/e94560/png?text=Demo+hoodie+art";

const PROMPTS = [
  "A dragon playing basketball in outer space with neon flames",
  "A cat wearing sunglasses surfing on a pizza through the galaxy",
  "A cyberpunk samurai with glowing purple sword in rain",
  "Pixel art knight fighting a robot in a retro castle",
  "A graffiti-style lion with a crown made of lightning",
];

type AuthState = "unknown" | "anon" | "signed-in";

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreatePageInner />
    </Suspense>
  );
}

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Local-only: `/create?demo=hoodie` loads placeholder art + hoodie-only to exercise publish without AI. */
  const demoHoodieDev =
    process.env.NODE_ENV === "development" && searchParams.get("demo") === "hoodie";
  const demoHoodieProducts =
    demoHoodieDev && searchParams.get("step") === "products";
  const demoHoodieAppliedRef = useRef(false);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<DesignStyle>("anime");
  const [step, setStep] = useState<
    "prompt" | "generating" | "preview" | "placement" | "products"
  >("prompt");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  // "ai" → image came from /api/designs/generate (already moderated server-side).
  // "upload" → user picked a file from disk; needs server-side moderation on publish.
  const [imageSource, setImageSource] = useState<"ai" | "upload">("ai");
  /** Set when `/api/designs/generate` falls back to a placeholder (no GEMINI_API_KEY). */
  const [placeholderNotice, setPlaceholderNotice] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<ProductType>>(new Set(["hoodie", "tshirt"]));
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  /** Optional shopper-facing copy + discovery fields applied to each product in this publish batch. */
  const [listingDescription, setListingDescription] = useState("");
  const [productTags, setProductTags] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [browseCategorySlugs, setBrowseCategorySlugs] = useState<string[]>([]);

  const [printPlacement, setPrintPlacement] = useState<StoredPrintPlacement>(() => ({
    ...DEFAULT_STORED,
  }));
  /** Per–product-type framing overrides on top of `printPlacement` (publish + previews). */
  const [placementOverrides, setPlacementOverrides] = useState<
    Partial<Record<ProductType, StoredPrintPlacement>>
  >({});
  const [tuningType, setTuningType] = useState<ProductType | null>(null);
  const [dialogPlacement, setDialogPlacement] = useState<StoredPrintPlacement>(() => ({
    ...DEFAULT_STORED,
  }));

  const handleAspectDetected = useCallback((aspect: number) => {
    setPrintPlacement((prev) =>
      prev.imageAspect === aspect ? prev : { ...prev, imageAspect: aspect },
    );
  }, []);

  const handleDialogAspectDetected = useCallback((aspect: number) => {
    setDialogPlacement((prev) =>
      prev.imageAspect === aspect ? prev : { ...prev, imageAspect: aspect },
    );
  }, []);

  const openTune = useCallback(
    (type: ProductType) => {
      setDialogPlacement({ ...(placementOverrides[type] ?? printPlacement) });
      setTuningType(type);
    },
    [placementOverrides, printPlacement],
  );

  function applyTune() {
    if (!tuningType) return;
    setPlacementOverrides((prev) => ({ ...prev, [tuningType]: dialogPlacement }));
    setTuningType(null);
  }

  const [authState, setAuthState] = useState<AuthState>("unknown");
  const [anonRemaining, setAnonRemaining] = useState<number>(MAX_FREE_GENERATIONS);

  const refreshAnonCount = useCallback(() => {
    setAnonRemaining(Math.max(0, MAX_FREE_GENERATIONS - getAnonDesigns().length));
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    let mounted = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      setAuthState(user ? "signed-in" : "anon");
      refreshAnonCount();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthState(session?.user ? "signed-in" : "anon");
      refreshAnonCount();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshAnonCount]);

  useEffect(() => {
    if (authState !== "signed-in") return;
    let cancelled = false;
    fetch("/api/browse-categories")
      .then((r) => r.json())
      .then((j: { categories?: { slug: string }[] }) => {
        if (cancelled || !Array.isArray(j.categories)) return;
        setBrowseCategorySlugs(j.categories.map((c) => c.slug));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authState]);

  useEffect(() => {
    if (
      !demoHoodieDev ||
      demoHoodieAppliedRef.current ||
      searchParams.get("designId")
    ) {
      return;
    }
    demoHoodieAppliedRef.current = true;
    setSelectedProducts(new Set<ProductType>(["hoodie"]));
    setPrompt((prev) =>
      prev.trim() ? prev : "Friendly alien in a cozy hoodie for local demo",
    );
    setGeneratedImage(DEV_DEMO_HOODIE_ART_URL);
    setImageSource("ai");
    setStep(demoHoodieProducts ? "products" : "preview");
  }, [demoHoodieDev, demoHoodieProducts, searchParams]);

  // Hydrate from ?designId (signed-in users coming from dashboard)
  useEffect(() => {
    const designId = searchParams.get("designId");
    if (!designId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/designs/${designId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setPrompt(data.prompt || "");
        if (data.style) setStyle(data.style);
        setGeneratedImage(data.imageUrl);
        setStep("preview");
      } catch {
        // ignore — user lands on blank prompt screen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Hydrate latest anon design from localStorage on mount (so refresh doesn't kill work)
  useEffect(() => {
    if (authState !== "anon") return;
    if (searchParams.get("designId")) return;
    if (generatedImage) return;

    const designs = getAnonDesigns();
    if (designs.length === 0) return;

    const latest = designs[0];
    setPrompt(latest.prompt || "");
    setStyle((latest.style as DesignStyle) || "anime");
    setGeneratedImage(latest.imageUrl);
    setStep("preview");
  }, [authState, searchParams, generatedImage]);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (authState === "anon" && anonRemaining <= 0) return;

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
      setImageSource("ai");
      setPlaceholderNotice(data.placeholder ? (data.placeholderReason ?? "") : null);
      setStep("preview");

      if (authState === "anon") {
        addAnonDesign({ prompt: prompt.trim(), style, imageUrl: data.imageUrl });
        refreshAnonCount();
      }
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
      setError("Please upload PNG, JPG, WebP, GIF, or SVG");
      return;
    }

    // 8 MB raw → ~10.7 MB base64 once encoded. Keeps us under Next.js
    // route-handler body limits and keeps Storage uploads snappy.
    const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image is too large — please pick something under 8 MB.");
      e.target.value = "";
      return;
    }

    // Read the file as a base64 data URL so the bytes can travel over the
    // wire to /api/designs/publish (which uploads to Supabase Storage and
    // hands the public URL to Printful). A blob: URL only exists in this
    // tab and is invalid both server-side and after refresh.
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        setError("Couldn't read that image — try a different file.");
        return;
      }
      setGeneratedImage(dataUrl);
      setImageSource("upload");
      setStep("preview");
      setError(null);
    };
    reader.onerror = () => setError("Couldn't read that image — try a different file.");
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function toggleProduct(type: ProductType) {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        setPlacementOverrides((overrides) => {
          const { [type]: _, ...rest } = overrides;
          return rest;
        });
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function handleEdit() {
    setStep("prompt");
    setError(null);
  }

  function handleReset() {
    setPrompt("");
    setStep("prompt");
    setGeneratedImage(null);
    setImageSource("ai");
    setSelectedProducts(
      new Set([
        "hoodie",
        "kids-hoodie",
        "kids-tshirt",
        "kids-heavyweight-tee",
        "kids-long-sleeve",
        "kids-sports-tee",
        "tshirt",
      ]),
    );
    setPrintPlacement({ ...DEFAULT_STORED });
    setPlacementOverrides({});
    setTuningType(null);
    setError(null);
  }

  function handleDownload() {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = generatedImage;
    a.download = `gamerhood-${(prompt || "design").slice(0, 24).replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Saved to your downloads");
  }

  async function handlePublish() {
    setPublishing(true);
    setError(null);

    try {
      const res = await fetch("/api/designs/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: generatedImage,
          imageSource,
          prompt: prompt || null,
          style,
          productTypes: [...selectedProducts],
          listingDescription: listingDescription.trim() || null,
          productTags: productTags.trim() || null,
          productCategory: productCategory.trim() || null,
          printPlacement,
          ...(Object.keys(placementOverrides).length > 0
            ? { printPlacementsByType: placementOverrides }
            : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Publish failed" }));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const data = await res.json();

      const failures = Array.isArray((data as { failures?: unknown }).failures)
          ? (data as { failures: { productType: string; message: string }[] }).failures
          : [];

      if (failures.length > 0 && data.count === 0) {
        throw new Error(
          failures.map((f) => `${f.productType}: ${f.message}`).join("; ") ||
            "No listings were saved.",
        );
      }

      toast.success(
        `${data.count} product${data.count > 1 ? "s" : ""} published to your shop!`,
        {
          description:
            failures.length > 0
              ? `Skipped: ${failures.map((f) => `${f.productType}`).join(", ")} (${failures[0]?.message ?? "error"}${failures.length > 1 ? ", …" : ""})`
              : "Head to your dashboard to manage them.",
        },
      );
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
      setPublishing(false);
    }
  }

  const isAnon = authState === "anon";
  const generationsExhausted = isAnon && anonRemaining <= 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Design <span className="gradient-text">Studio</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Describe your design, pick a style, and watch the magic happen
        </p>
        {isAnon && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">
              {anonRemaining > 0 ? (
                <>
                  <strong className="font-semibold">{anonRemaining}</strong> free creation
                  {anonRemaining === 1 ? "" : "s"} left — sign in to keep going
                </>
              ) : (
                <>You&apos;ve used your free creations — sign in to keep going</>
              )}
            </span>
          </div>
        )}
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

      {demoHoodieDev && (
        <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <p className="font-medium text-amber-950 dark:text-amber-100">Developer hoodie demo</p>
          <p className="mt-1 text-muted-foreground">
            Loaded placeholder artwork and hoodie-only merch. Publishing still signs you in (
            <Link href="/auth/login" className="underline underline-offset-2 hover:text-foreground">
              /auth/login
            </Link>
            ) then runs{" "}
            <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">/api/designs/publish</code>.
            Drop{" "}
            <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-xs">?demo=hoodie</code> from the
            URL when you&apos;re done.
          </p>
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
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  PNG, JPG, WebP, GIF, or SVG (max 8 MB). SVG uploads are rasterized server-side before
                  print so logos stay crisp; transparency is preserved when your file has alpha.
                </p>
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

              {generationsExhausted ? (
                <SignInGate
                  title="Sign in to keep creating"
                  description="You've used your free creations. Sign in and we'll save everything you've made so far."
                />
              ) : (
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
              )}
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
              {placeholderNotice && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
                  <p className="font-medium text-amber-950 dark:text-amber-100">
                    AI generation is in demo / placeholder mode
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {placeholderNotice} Until then, this image is a placeholder so you can still test
                    placement, publishing, and checkout flows.
                  </p>
                </div>
              )}
              <div className="grid gap-8 lg:grid-cols-2">
                <Card className="border-border/50 bg-card overflow-hidden">
                  <div className="relative aspect-square">
                    <Image
                      src={generatedImage}
                      alt={placeholderNotice ? "Placeholder design (AI not configured)" : "Generated design"}
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
                    <Button onClick={() => setStep("placement")} className="gap-2 bg-primary hover:bg-primary/90">
                      <ShoppingCart className="h-4 w-4" />
                      Put It On Merch
                    </Button>
                    {prompt && (
                      <>
                        <Button variant="outline" onClick={handleEdit} className="gap-2">
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        {!generationsExhausted && (
                          <Button variant="outline" onClick={handleGenerate} className="gap-2">
                            <Wand2 className="h-4 w-4" />
                            Recreate
                          </Button>
                        )}
                      </>
                    )}
                    <Button variant="outline" onClick={handleDownload} className="gap-2">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Start Over
                    </Button>
                  </div>

                  {generationsExhausted && (
                    <SignInGate
                      title="Sign in to keep this — and create more"
                      description="Your designs live in your browser for now. Sign in to save them to your gallery and keep creating."
                    />
                  )}

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
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                      SVG uploads are converted to print-ready PNG (high resolution); keep transparent
                      backgrounds only where you intend them — that is what prints as “knockout” on merch.
                    </p>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {step === "placement" && generatedImage && (
            <motion.div
              key="placement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto max-w-3xl space-y-8"
            >
              <Card className="border-border/50 bg-card p-6 sm:p-8">
                <PrintPlacementEditor
                  imageUrl={generatedImage}
                  selectedProductTypes={selectedProducts}
                  value={printPlacement}
                  onChange={setPrintPlacement}
                  onAspectDetected={handleAspectDetected}
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3 border-t border-border/60 pt-6">
                  <Button variant="outline" onClick={() => setStep("preview")} className="gap-2">
                    Back to flat preview
                  </Button>
                  <Button onClick={() => setStep("products")} className="gap-2 bg-primary hover:bg-primary/90">
                    <ShoppingCart className="h-4 w-4" />
                    Continue — choose products
                  </Button>
                </div>
              </Card>
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
                <p className="mt-2 max-w-xl mx-auto text-muted-foreground">
                  Pick a category to expand the available Printful blanks, then check off the exact items you want to
                  publish. Each preview shows your batch framing — use Fine-tune to adjust a single item without
                  changing the rest.
                </p>
              </div>

              <CategoryProductPicker
                imageUrl={generatedImage}
                selected={selectedProducts}
                onToggle={toggleProduct}
                basePlacement={printPlacement}
                placementOverrides={placementOverrides}
                onTune={openTune}
              />

              <Dialog open={tuningType !== null} onOpenChange={(open) => !open && setTuningType(null)}>
                <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      Fine-tune — {tuningType ? PRODUCT_TYPE_LABELS[tuningType] ?? tuningType : ""}
                    </DialogTitle>
                  </DialogHeader>
                  {generatedImage && tuningType && (
                    <PrintPlacementEditor
                      imageUrl={generatedImage}
                      selectedProductTypes={new Set<ProductType>([tuningType])}
                      value={dialogPlacement}
                      onChange={setDialogPlacement}
                      onAspectDetected={handleDialogAspectDetected}
                      hideBatchPlacementNote
                    />
                  )}
                  <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setTuningType(null)}>
                      Cancel
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90" onClick={applyTune}>
                      Apply to this product type
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Card className="border-border/50 bg-card p-6 text-left">
                <h3 className="text-base font-semibold tracking-tight">Listing details</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  These parts are&nbsp;
                  <strong className="font-medium text-foreground">instructions only</strong>
                  — you don&apos;t type here. Scroll to the bordered section for the actual text boxes.
                </p>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Whatever you enter applies to{' '}
                  <strong className="font-medium text-foreground">every product</strong> in this publish
                  batch. You can refine each listing later under{' '}
                  <span className="font-medium text-foreground">Dashboard → Storefront</span>.
                </p>

                <div
                  role="group"
                  aria-labelledby="create-listing-fields-title"
                  className="mt-5 space-y-4 rounded-xl border-2 border-dashed border-primary/35 bg-muted/50 p-4 shadow-inner dark:bg-muted/25 dark:border-primary/40"
                >
                  <div id="create-listing-fields-title" className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground"
                      aria-hidden
                    >
                      Type here
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Optional fields — tap or click inside each box
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-listing-description" className="text-sm font-medium text-foreground">
                      Description{' '}
                      <span className="font-normal text-muted-foreground">(multi-line)</span>
                    </Label>
                    <Textarea
                      id="create-listing-description"
                      value={listingDescription}
                      onChange={(e) => setListingDescription(e.target.value)}
                      placeholder="Type a short description shoppers will see..."
                      rows={3}
                      className="resize-none bg-background text-sm shadow-sm md:text-sm"
                      aria-describedby="create-listing-description-hint"
                    />
                    <p id="create-listing-description-hint" className="text-xs text-muted-foreground">
                      Larger box — your product story for search snippets and product pages.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-product-tags" className="text-sm font-medium text-foreground">
                        Tags{' '}
                        <span className="font-normal text-muted-foreground">(single line)</span>
                      </Label>
                      <Input
                        id="create-product-tags"
                        value={productTags}
                        onChange={(e) => setProductTags(e.target.value)}
                        placeholder="Type tags: gaming, retro, kids..."
                        className="h-9 bg-background text-sm shadow-sm"
                        aria-describedby="create-product-tags-hint"
                      />
                      <p id="create-product-tags-hint" className="text-xs text-muted-foreground">
                        One rounded row — separate words with commas. These help shoppers find your design when they
                        search and browse — not for old HTML meta-keywords tags.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-product-category" className="text-sm font-medium text-foreground">
                        Category slug{' '}
                        <span className="font-normal text-muted-foreground">(single line)</span>
                      </Label>
                      <Input
                        id="create-product-category"
                        list="browse-seo-categories"
                        value={productCategory}
                        onChange={(e) =>
                          setProductCategory(
                            sanitizeSlugInput(e.target.value, MAX_PRODUCT_CATEGORY_SLUG_LEN),
                          )
                        }
                        placeholder="Type a category, e.g. streetwear-style"
                        className="h-9 bg-background text-sm shadow-sm"
                        aria-describedby="create-product-category-hint"
                      />
                      <datalist id="browse-seo-categories">
                        {browseCategorySlugs.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                      <p id="create-product-category-hint" className="text-xs text-muted-foreground">
                        Same shape as Tags — lowercase and hyphens. Match an{' '}
                        <Link href="/dashboard/categories" className="text-primary underline-offset-2 hover:underline">
                          SEO category
                        </Link>{' '}
                        so browse URLs pick up your meta.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {isAnon ? (
                <>
                  <SignInGate
                    title="Sign in to publish your merch"
                    description="Publishing creates a real shop where people can buy this. We'll save your designs the moment you sign in."
                  />
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={() => setStep("placement")} className="gap-2">
                      Back to print layout
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => setStep("placement")} className="gap-2">
                    Back to print layout
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
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SignInGate({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mx-auto max-w-md border-primary/30 bg-card p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LogIn className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-5">
        <OAuthButtons next="/create" />
      </div>
    </Card>
  );
}
