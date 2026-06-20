"use client";

import { useState, useRef, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SlugTextInput } from "@/components/ui/slug-text-input";
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
  Store,
  X,
  Trash2,
  Images,
  Check,
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
import { MAX_PRODUCT_CATEGORY_SLUG_LEN } from "@/lib/slug-utils";
import { PrintPlacementEditor } from "@/components/create/print-placement-editor";
import { CategoryProductPicker } from "@/components/create/category-product-picker";
import { PRODUCT_TYPE_LABELS } from "@/components/storefront/product-card";
import { TransparencyBadge } from "@/components/design/transparency-badge";
import { TransparencyStatus } from "@/components/design/transparency-status";
import { TransparencyPreviewBackdrop } from "@/components/create/transparency-preview-backdrop";
import { designPreviewImageSrc } from "@/lib/design-image-url";
import { isSvgDataUrl } from "@/lib/design/source-format";
import {
  GenerationProgress,
  type GenerationStep,
} from "@/components/create/generation-progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_STORED } from "@/lib/print/placement";
import { MerchPricingStep, type MerchPricingRow } from "@/components/create/merch-pricing-step";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import { XpBadge } from "@/components/xp/xp-badge";
import { showXpToasts } from "@/components/xp/show-xp-toasts";
import { XP_RULES } from "@/lib/xp/rules";
import { DesignLibraryInfiniteGrid } from "@/components/designs/design-library-infinite-grid";
import type { DashboardDesignCard } from "@/components/dashboard/dashboard-designs-grid";

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
type PublishStage = "uploading" | "creating" | "finalizing";

/**
 * Shape of the `event: done` payload from /api/designs/generate. Mirrors the
 * old JSON response so the preview step doesn't need to know we switched
 * transports.
 */
type GenerateResult = {
  imageUrl: string;
  prompt: string;
  style: string;
  designId: string | null;
  hasTransparency: boolean | null;
  placeholder?: boolean;
  placeholderReason?: string;
};

async function parseErrorMessageFromResponse(
  res: Response,
  fallback: string,
): Promise<string> {
  const statusLabel = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`;
  let raw = "";
  try {
    raw = (await res.text()).trim();
  } catch {
    // Ignore read failures and fall back to status + default text.
  }

  let message = "";
  let debugId = "";
  if (raw.length > 0) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: unknown;
        message?: unknown;
        debugId?: unknown;
      } | null;
      if (typeof parsed?.error === "string" && parsed.error.trim().length > 0) {
        message = parsed.error.trim();
      } else if (typeof parsed?.message === "string" && parsed.message.trim().length > 0) {
        message = parsed.message.trim();
      }
      if (typeof parsed?.debugId === "string" && parsed.debugId.trim().length > 0) {
        debugId = parsed.debugId.trim();
      }
    } catch {
      // Non-JSON response (often an HTML error page or plain text).
      if (raw.startsWith("<")) {
        const title = raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
        if (title) message = title;
      } else {
        message = raw.slice(0, 240);
      }
    }
  }

  if (!message) message = `${fallback} (empty error response body)`;
  const withStatus = `${message} (${statusLabel})`;
  return debugId ? `${withStatus} [debugId: ${debugId}]` : withStatus;
}

function inferImageSourceFromUrl(imageUrl: unknown): "ai" | "upload" {
  if (typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
    return "upload";
  }
  // Any persisted/public URL should publish as server-fetchable media.
  return "ai";
}

function isInlineDesignUrl(imageUrl: string): boolean {
  return imageUrl.startsWith("data:") || imageUrl.startsWith("blob:");
}

const MERCH_DRAFT_STORAGE_KEY = "gh:create:merch-draft:v1";
const MERCH_DRAFT_AUTOSAVE_MS = 30_000;
const MERCH_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type CreateMerchDraft = {
  version: 1;
  savedAtMs: number;
  prompt: string;
  style: DesignStyle;
  step: "preview" | "placement" | "products";
  generatedImage: string;
  imageSource: "ai" | "upload";
  hasTransparency: boolean | null;
  uploadedAsSvg: boolean;
  placeholderNotice: string | null;
  selectedProducts: ProductType[];
  printPlacement: StoredPrintPlacement;
  placementOverrides: Partial<Record<ProductType, StoredPrintPlacement>>;
  listingDescription: string;
  productTags: string;
  productCategory: string;
  merchPricing: Record<string, MerchPricingRow>;
  selectedStorefrontIds: string[];
  savedDesignId: string | null;
};

/**
 * Parse the streaming SSE response from /api/designs/generate, invoking
 * `onStatus` whenever a `status` event lands so the progress UI can advance.
 * Resolves with the `done` payload, or rejects with the message from an
 * `error` event (or a generic message if the stream ends without either).
 */
async function consumeGenerateStream(
  res: Response,
  onStatus: (step: GenerationStep) => void,
): Promise<GenerateResult> {
  if (!res.body) throw new Error("Generation stream was empty");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: GenerateResult | null = null;
  let streamError: string | null = null;

  outer: while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE event boundaries are blank lines. Use a regex so we handle both
    // \n\n and \r\n\r\n (some proxies normalize line endings).
    let match = buffer.match(/\r?\n\r?\n/);
    while (match && match.index !== undefined) {
      const raw = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);

      let eventType = "message";
      const dataLines: string[] = [];
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length === 0) {
        match = buffer.match(/\r?\n\r?\n/);
        continue;
      }
      let payload: unknown = null;
      try {
        payload = JSON.parse(dataLines.join("\n"));
      } catch {
        // Malformed event — skip it rather than tearing down the stream.
        match = buffer.match(/\r?\n\r?\n/);
        continue;
      }

      if (eventType === "status") {
        const stepValue = (payload as { step?: string } | null)?.step;
        if (
          stepValue === "generating" ||
          stepValue === "moderation" ||
          stepValue === "analyzing" ||
          stepValue === "saving"
        ) {
          onStatus(stepValue);
        }
      } else if (eventType === "done") {
        result = payload as GenerateResult;
        break outer;
      } else if (eventType === "error") {
        const errMsg = (payload as { error?: string } | null)?.error;
        streamError = errMsg || "Generation failed";
        break outer;
      }

      match = buffer.match(/\r?\n\r?\n/);
    }
  }

  if (streamError) throw new Error(streamError);
  if (!result) throw new Error("Generation ended without a result. Please try again.");
  return result;
}

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
  /**
   * Latest SSE `status` step from /api/designs/generate. `null` means the
   * request is in flight but the first event hasn't landed yet (the progress
   * UI treats that as "step 1 active" so the spinner row lights up
   * immediately).
   */
  const [generationStep, setGenerationStep] = useState<GenerationStep | null>(null);
  /**
   * Lives as long as a generate request is in flight so the Cancel button on
   * `<GenerationProgress />` can actually abort the fetch (Network tab
   * shows the request as cancelled rather than just hidden in the UI).
   */
  const generateAbortRef = useRef<AbortController | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  // "ai" → image came from /api/designs/generate (already moderated server-side).
  // "upload" → user picked a file from disk; needs server-side moderation on publish.
  const [imageSource, setImageSource] = useState<"ai" | "upload">("ai");
  /** Delta instructions when refining the current AI design (preview step). */
  const [refinePrompt, setRefinePrompt] = useState("");
  /** Whether the in-flight /api/designs/generate call is a fresh gen or a refine. */
  const [generationMode, setGenerationMode] = useState<"generate" | "refine">("generate");
  /**
   * Alpha-channel check result for the currently-previewed design.
   * `null` until the API answers (or for direct file uploads, which we
   * don't pre-check client-side); the badge renders a neutral "?" state
   * until it lands.
   */
  const [hasTransparency, setHasTransparency] = useState<boolean | null>(null);
  const [uploadedAsSvg, setUploadedAsSvg] = useState(false);
  /** Set when `/api/designs/generate` falls back to a placeholder (no GEMINI_API_KEY). */
  const [placeholderNotice, setPlaceholderNotice] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<ProductType>>(new Set(["hoodie", "tshirt"]));
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStage, setPublishStage] = useState<PublishStage>("uploading");
  const [publishStatus, setPublishStatus] = useState("");
  const [deletingImage, setDeletingImage] = useState(false);
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
  /** True when `/create?designId=` loaded a design that already has published listings. */
  const [editingPublishedDesign, setEditingPublishedDesign] = useState(false);
  /** Row id in `designs` when the current artwork is already saved to the library. */
  const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
  /** Bumps the infinite-scroll library grid after a new save/generate. */
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  // Storefronts the signed-in user owns. Used to surface the
  // "Publish to which storefront?" picker only when there's more than
  // one — single-storefront users never see chrome they don't need.
  const [ownedStorefronts, setOwnedStorefronts] = useState<
    { id: string; slug: string; display_name: string; is_default: boolean }[]
  >([]);
  const [selectedStorefrontIds, setSelectedStorefrontIds] = useState<string[]>([]);

  const formatPublishError = useCallback((err: unknown): string => {
    const base =
      err instanceof Error ? err.message : "Failed to publish (non-error exception thrown)";
    // Keep generic publish-only messages from reaching the UI.
    const normalized = base.trim().toLowerCase();
    if (normalized === "publish failed" || normalized.startsWith("publish failed (")) {
      return "Publish failed, but the server returned no details. Please retry and inspect /api/designs/publish in Network.";
    }
    return base;
  }, []);

  // Listing-details pre-fill plumbing. We track per-field interaction
  // so switching storefronts mid-flow can refill empty fields without
  // wiping anything the seller already typed; the "source" string
  // drives the small badge that tells them where the pre-filled copy
  // came from.
  const [prefilledSource, setPrefilledSource] = useState<
    "storefront-defaults" | "last-listing" | "none"
  >("none");
  const [merchPricing, setMerchPricing] = useState<Record<string, MerchPricingRow>>({});
  const [storefrontDefaultMarkupPercent, setStorefrontDefaultMarkupPercent] =
    useState<number | undefined>(undefined);
  const descriptionTouchedRef = useRef(false);
  const tagsTouchedRef = useRef(false);
  const categoryTouchedRef = useRef(false);
  /** Last storefront whose defaults we successfully applied — guards against re-applying on every render. */
  const lastPrefilledStorefrontIdRef = useRef<string | null>(null);
  /** Prevents restoring the same local merch draft more than once per mount. */
  const merchDraftHydratedRef = useRef(false);
  /** Exact uploaded file bytes for API calls (data URL from FileReader). */
  const uploadDataUrlRef = useRef<string | null>(null);
  /** Object URL for faithful on-screen preview of the picked file. */
  const uploadObjectUrlRef = useRef<string | null>(null);
  const [hasAttemptedMerch, setHasAttemptedMerch] = useState(false);

  const revokeUploadObjectUrl = useCallback(() => {
    if (uploadObjectUrlRef.current) {
      URL.revokeObjectURL(uploadObjectUrlRef.current);
      uploadObjectUrlRef.current = null;
    }
  }, []);

  const clearMerchDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(MERCH_DRAFT_STORAGE_KEY);
  }, []);

  const clearDesignIdFromUrl = useCallback(() => {
    if (!searchParams.get("designId")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("designId");
    const qs = next.toString();
    router.replace(qs ? `/create?${qs}` : "/create", { scroll: false });
  }, [router, searchParams]);

  const resetCreateFlow = useCallback(() => {
    revokeUploadObjectUrl();
    uploadDataUrlRef.current = null;
    setPrompt("");
    setRefinePrompt("");
    setStep("prompt");
    setGeneratedImage(null);
    setImageSource("ai");
    setHasTransparency(null);
    setUploadedAsSvg(false);
    setPlaceholderNotice(null);
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
    setEditingPublishedDesign(false);
    setSavedDesignId(null);
    setError(null);
    setHasAttemptedMerch(false);
    clearMerchDraft();
    clearDesignIdFromUrl();
  }, [clearMerchDraft, clearDesignIdFromUrl, revokeUploadObjectUrl]);

  const saveMerchDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draftImage = uploadDataUrlRef.current ?? generatedImage;
    if (!hasAttemptedMerch || !draftImage) return;
    const payload: CreateMerchDraft = {
      version: 1,
      savedAtMs: Date.now(),
      prompt,
      style,
      step: step === "prompt" || step === "generating" ? "preview" : step,
      generatedImage: draftImage,
      imageSource,
      hasTransparency,
      uploadedAsSvg,
      placeholderNotice,
      selectedProducts: [...selectedProducts],
      printPlacement,
      placementOverrides,
      listingDescription,
      productTags,
      productCategory,
      merchPricing,
      selectedStorefrontIds,
      savedDesignId,
    };
    try {
      window.localStorage.setItem(MERCH_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota / privacy mode issues shouldn't break create flow.
    }
  }, [
    generatedImage,
    hasAttemptedMerch,
    imageSource,
    hasTransparency,
    uploadedAsSvg,
    placeholderNotice,
    selectedProducts,
    printPlacement,
    placementOverrides,
    listingDescription,
    productTags,
    productCategory,
    merchPricing,
    selectedStorefrontIds,
    savedDesignId,
    prompt,
    style,
    step,
  ]);

  const refreshAnonCount = useCallback(() => {
    setAnonRemaining(Math.max(0, MAX_FREE_GENERATIONS - getAnonDesigns().length));
  }, []);

  // Abort any in-flight generate stream if the page unmounts (e.g. user
  // navigates away mid-generate) so we don't keep holding a connection open.
  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (step === "placement" || step === "products") {
      setHasAttemptedMerch(true);
    }
  }, [step]);

  useEffect(() => {
    return () => {
      revokeUploadObjectUrl();
    };
  }, [revokeUploadObjectUrl]);

  useEffect(() => {
    if (!publishing) {
      setPublishProgress(0);
      setPublishStage("uploading");
      setPublishStatus("");
      return;
    }

    const startedAt = Date.now();
    setPublishStage("uploading");
    setPublishStatus("Uploading design and creating listings…");
    setPublishProgress((prev) => Math.max(prev, 8));

    const timer = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > 3_000) {
        setPublishStage("creating");
      }
      setPublishProgress((prev) => {
        const cap = elapsedMs < 15_000 ? 72 : elapsedMs < 45_000 ? 90 : 96;
        const stepSize = elapsedMs < 15_000 ? 3 : elapsedMs < 45_000 ? 1.2 : 0.4;
        return Math.min(cap, prev + stepSize);
      });
      if (elapsedMs > 30_000) {
        setPublishStatus("Still publishing — slow connection detected.");
      } else if (elapsedMs > 3_000) {
        setPublishStatus("Creating product listings…");
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [publishing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (merchDraftHydratedRef.current) return;
    if (authState === "unknown") return;
    if (searchParams.get("designId")) {
      merchDraftHydratedRef.current = true;
      return;
    }
    if (generatedImage) {
      merchDraftHydratedRef.current = true;
      return;
    }

    void (async () => {
      try {
        let raw: string | null = null;
        try {
          raw = window.localStorage.getItem(MERCH_DRAFT_STORAGE_KEY);
        } catch {
          return;
        }
        if (!raw) return;

        const parsed = JSON.parse(raw) as CreateMerchDraft | null;
        if (
          !parsed ||
          parsed.version !== 1 ||
          typeof parsed.generatedImage !== "string" ||
          parsed.generatedImage.length === 0
        ) {
          clearMerchDraft();
          return;
        }
        if (
          typeof parsed.savedAtMs !== "number" ||
          Date.now() - parsed.savedAtMs > MERCH_DRAFT_MAX_AGE_MS
        ) {
          clearMerchDraft();
          return;
        }

        if (parsed.savedDesignId) {
          try {
            const res = await fetch(`/api/designs/${parsed.savedDesignId}`);
            if (!res.ok) {
              clearMerchDraft();
              toast.info("Your saved merch draft pointed at a removed design — starting fresh.");
              return;
            }
          } catch {
            clearMerchDraft();
            return;
          }
        }

        setPrompt(parsed.prompt ?? "");
        setStyle(parsed.style ?? "anime");
        setGeneratedImage(parsed.generatedImage);
        uploadDataUrlRef.current =
          parsed.imageSource === "upload" ? parsed.generatedImage : null;
        revokeUploadObjectUrl();
        setImageSource(inferImageSourceFromUrl(parsed.generatedImage));
        setHasTransparency(
          typeof parsed.hasTransparency === "boolean" ? parsed.hasTransparency : null,
        );
        setUploadedAsSvg(Boolean(parsed.uploadedAsSvg));
        setPlaceholderNotice(parsed.placeholderNotice ?? null);
        setSelectedProducts(new Set(parsed.selectedProducts ?? ["hoodie", "tshirt"]));
        setPrintPlacement(
          parsed.printPlacement && typeof parsed.printPlacement === "object"
            ? parsed.printPlacement
            : { ...DEFAULT_STORED },
        );
        setPlacementOverrides(
          parsed.placementOverrides && typeof parsed.placementOverrides === "object"
            ? parsed.placementOverrides
            : {},
        );
        setListingDescription(parsed.listingDescription ?? "");
        setProductTags(parsed.productTags ?? "");
        setProductCategory(parsed.productCategory ?? "");
        setMerchPricing(
          parsed.merchPricing && typeof parsed.merchPricing === "object"
            ? parsed.merchPricing
            : {},
        );
        const legacySelectedStorefrontId =
          typeof (parsed as { selectedStorefrontId?: unknown }).selectedStorefrontId === "string"
            ? (parsed as { selectedStorefrontId?: string }).selectedStorefrontId ?? null
            : null;
        setSelectedStorefrontIds(
          Array.isArray(parsed.selectedStorefrontIds)
            ? parsed.selectedStorefrontIds.filter(
                (id): id is string => typeof id === "string" && id.length > 0,
              )
            : legacySelectedStorefrontId
              ? [legacySelectedStorefrontId]
              : [],
        );
        setSavedDesignId(parsed.savedDesignId ?? null);
        setStep(parsed.step ?? "products");
        setHasAttemptedMerch(true);
        setError(null);
        toast.success("Restored your merch draft");
      } catch {
        clearMerchDraft();
      } finally {
        merchDraftHydratedRef.current = true;
      }
    })();
  }, [authState, clearMerchDraft, generatedImage, searchParams]);

  /** Drop stale drafts when the linked library design was deleted server-side. */
  useEffect(() => {
    if (authState !== "signed-in" || !savedDesignId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/designs/${savedDesignId}`);
        if (cancelled || res.ok) return;
        resetCreateFlow();
        toast.info("That design was removed — starting fresh.");
      } catch {
        // Network blip — don't wipe a valid in-progress draft.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState, resetCreateFlow, savedDesignId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasAttemptedMerch || !generatedImage) return;

    saveMerchDraft();
    const id = window.setInterval(saveMerchDraft, MERCH_DRAFT_AUTOSAVE_MS);
    const onBeforeUnload = () => saveMerchDraft();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [generatedImage, hasAttemptedMerch, saveMerchDraft]);

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
    if (authState !== "signed-in") return;
    let cancelled = false;
    fetch("/api/storefronts")
      .then((r) => r.json())
      .then(
        (j: {
          storefronts?: {
            id: string;
            slug: string;
            display_name: string;
            is_default: boolean;
          }[];
        }) => {
          if (cancelled || !Array.isArray(j.storefronts)) return;
          setOwnedStorefronts(j.storefronts);
          setSelectedStorefrontIds((prev) => {
            const ownedIds = new Set(j.storefronts!.map((s) => s.id));
            const retained = prev.filter((id) => ownedIds.has(id));
            if (retained.length > 0) return retained;
            const def =
              j.storefronts!.find((s) => s.is_default) ?? j.storefronts![0];
            return def?.id ? [def.id] : [];
          });
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authState]);

  // Fetch and apply the chosen storefront's listing defaults whenever
  // the picker selection changes. We only fill empty + untouched fields
  // so a seller who already typed something won't be overwritten when
  // they later flip the storefront radio. If they HAVE typed and we
  // have fresh defaults that would otherwise be discarded, we surface a
  // toast offering a one-tap apply.
  useEffect(() => {
    if (authState !== "signed-in") return;
    const storefrontId = selectedStorefrontIds[0] ?? null;
    if (!storefrontId) return;
    if (lastPrefilledStorefrontIdRef.current === storefrontId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/storefronts/${storefrontId}/listing-defaults`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          defaults?: {
            description?: string;
            tags?: string[];
            categorySlug?: string;
            defaultMarkupPercent?: number;
            source?: "storefront-defaults" | "last-listing" | "none";
          };
        };
        if (cancelled) return;

        const defaults = data.defaults ?? {};
        if (
          typeof defaults.defaultMarkupPercent === "number" &&
          Number.isFinite(defaults.defaultMarkupPercent)
        ) {
          setStorefrontDefaultMarkupPercent(
            Math.min(100, Math.max(0, Math.round(defaults.defaultMarkupPercent))),
          );
        }
        const source = defaults.source ?? "none";
        const description = (defaults.description ?? "").trim();
        const tagsJoined = Array.isArray(defaults.tags)
          ? defaults.tags.join(", ")
          : "";
        const categorySlug = (defaults.categorySlug ?? "").trim();

        const wasInitialFill = lastPrefilledStorefrontIdRef.current === null;
        lastPrefilledStorefrontIdRef.current = storefrontId;

        if (source === "none") {
          setPrefilledSource("none");
          return;
        }

        let appliedAny = false;
        if (description && !descriptionTouchedRef.current) {
          setListingDescription((prev) => {
            if (prev.trim()) return prev;
            appliedAny = true;
            return description;
          });
        }
        if (tagsJoined && !tagsTouchedRef.current) {
          setProductTags((prev) => {
            if (prev.trim()) return prev;
            appliedAny = true;
            return tagsJoined;
          });
        }
        if (categorySlug && !categoryTouchedRef.current) {
          setProductCategory((prev) => {
            if (prev.trim()) return prev;
            appliedAny = true;
            return categorySlug;
          });
        }

        if (appliedAny) {
          setPrefilledSource(source);
        } else if (!wasInitialFill) {
          // Seller switched storefronts but every relevant field is
          // already filled with their own input. Surface the option to
          // pull the new store's defaults instead of silently dropping
          // them.
          const sfName =
            ownedStorefronts.find((s) => s.id === storefrontId)?.display_name ??
            "this storefront";
          toast(`Switched to “${sfName}”.`, {
            description:
              "Defaults for that store are available — apply them?",
            action: {
              label: "Use defaults",
              onClick: () => {
                if (description) setListingDescription(description);
                if (tagsJoined) setProductTags(tagsJoined);
                if (categorySlug) setProductCategory(categorySlug);
                descriptionTouchedRef.current = false;
                tagsTouchedRef.current = false;
                categoryTouchedRef.current = false;
                setPrefilledSource(source);
              },
            },
          });
        }
      } catch {
        // Network blip — leave the form blank rather than crashing the
        // page. Source stays "none" so no badge renders.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authState, selectedStorefrontIds, ownedStorefronts]);

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
    setUploadedAsSvg(false);
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
        if (!res.ok) {
          if (!cancelled) {
            resetCreateFlow();
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setPrompt(data.prompt || "");
        if (data.style) setStyle(data.style);
        setGeneratedImage(data.imageUrl);
        setImageSource(data.prompt ? "ai" : "upload");
        uploadDataUrlRef.current = null;
        revokeUploadObjectUrl();
        setHasTransparency(
          typeof data.hasTransparency === "boolean" ? data.hasTransparency : null,
        );
        setUploadedAsSvg(Boolean(data.uploadedAsSvg));
        setSavedDesignId(designId);
        setEditingPublishedDesign(Boolean(data.hasPublishedProducts));
        setStep("preview");
      } catch {
        // ignore — user lands on blank prompt screen
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, resetCreateFlow]);

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
    setImageSource("ai");
    setStep("preview");
  }, [authState, searchParams, generatedImage]);

  async function runGeneration(
    mode: "generate" | "refine",
    refineInstructions?: string,
    options?: { useReference?: boolean },
  ) {
    const isRefine = mode === "refine";
    const textPrompt = isRefine ? refineInstructions?.trim() : prompt.trim();
    if (!textPrompt) return;
    if (isRefine && !generatedImage) return;
    if (authState === "anon" && anonRemaining <= 0) return;

    const useReference =
      options?.useReference !== false &&
      Boolean(generatedImage) &&
      (isRefine || mode === "generate");

    // Tear down any leftover request (e.g. user clicked Recreate while a
    // previous attempt was still streaming).
    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    setGenerationMode(useReference ? "refine" : "generate");
    setStep("generating");
    setGenerationStep(null);
    setError(null);
    if (!isRefine) {
      setSavedDesignId(null);
      clearDesignIdFromUrl();
    }

    const returnStepOnCancel: typeof step = isRefine ? "preview" : "prompt";
    const nextPrompt = isRefine
      ? prompt
        ? `${prompt} → ${textPrompt}`
        : textPrompt
      : prompt.trim();
    const savedPrompt = isRefine ? nextPrompt : textPrompt;

    try {
      const res = await fetch("/api/designs/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          prompt: textPrompt,
          style,
          ...(useReference && generatedImage
            ? { referenceImageUrl: generatedImage, savedPrompt }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Pre-stream rejection (prompt-moderation, invalid body). The route
        // returns plain JSON in that case so we don't have to parse SSE.
        throw new Error(await parseErrorMessageFromResponse(res, "Generation failed"));
      }

      const result = await consumeGenerateStream(res, (next) => {
        setGenerationStep(next);
      });

      setGeneratedImage(result.imageUrl);
      setImageSource("ai");
      setUploadedAsSvg(false);
      setHasTransparency(
        typeof result.hasTransparency === "boolean" ? result.hasTransparency : null,
      );
      setPlaceholderNotice(
        result.placeholder ? (result.placeholderReason ?? "") : null,
      );
      if (result.designId) {
        setSavedDesignId(result.designId);
        setLibraryRefreshKey((k) => k + 1);
      }
      if (isRefine) {
        setPrompt(nextPrompt);
        setRefinePrompt("");
      }
      setStep("preview");

      if (authState === "anon") {
        addAnonDesign({ prompt: nextPrompt, style, imageUrl: result.imageUrl });
        refreshAnonCount();
      }
    } catch (err) {
      // User-initiated cancel — return to preview when refining, prompt otherwise.
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        setStep(returnStepOnCancel);
        setGenerationStep(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep(returnStepOnCancel);
      setGenerationStep(null);
    } finally {
      if (generateAbortRef.current === controller) {
        generateAbortRef.current = null;
      }
    }
  }

  function handleGenerate() {
    void runGeneration("generate");
  }

  function handleRecreate() {
    void runGeneration("generate", undefined, { useReference: false });
  }

  function handleRefine() {
    void runGeneration("refine", refinePrompt);
  }

  function handleCancelGenerate() {
    generateAbortRef.current?.abort();
  }

  function handleRandomPrompt() {
    setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }

  async function loadDesignFromLibrary(d: DashboardDesignCard) {
    try {
      const res = await fetch(`/api/designs/${d.id}`);
      if (!res.ok) throw new Error("Could not load that design");
      const data = await res.json();
      setSavedDesignId(d.id);
      setPrompt(data.prompt || "");
      if (data.style) setStyle(data.style as DesignStyle);
      setGeneratedImage(data.imageUrl);
      setImageSource(data.prompt ? "ai" : "upload");
      uploadDataUrlRef.current = null;
      revokeUploadObjectUrl();
      setHasTransparency(
        typeof data.hasTransparency === "boolean" ? data.hasTransparency : null,
      );
      setUploadedAsSvg(Boolean(data.uploadedAsSvg));
      setEditingPublishedDesign(Boolean(data.hasPublishedProducts));
      setPlaceholderNotice(null);
      setStep("preview");
      setError(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Design loaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load design");
    }
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
      void (async () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : null;
        if (!dataUrl) {
          setError("Couldn't read that image — try a different file.");
          return;
        }
        // Show the exact picked file in the UI; send the data URL to the server.
        uploadDataUrlRef.current = dataUrl;
        revokeUploadObjectUrl();
        const objectUrl = URL.createObjectURL(file);
        uploadObjectUrlRef.current = objectUrl;
        let aspect = 1;
        try {
          const { detectContentAspect } = await import("@/lib/print/image-content-bounds");
          aspect = await detectContentAspect(objectUrl);
        } catch {
          //
        }
        setGeneratedImage(objectUrl);
        setPrintPlacement((prev) =>
          prev.imageAspect === aspect ? prev : { ...prev, imageAspect: aspect },
        );
        setSavedDesignId(null);
        clearDesignIdFromUrl();
        setImageSource("upload");
        setUploadedAsSvg(
          file.type === "image/svg+xml" || isSvgDataUrl(dataUrl),
        );
        // Local-file uploads don't carry a pre-computed transparency check.
        setHasTransparency(null);
        setStep("preview");
        setError(null);

        if (authState === "signed-in") {
          try {
            const saveRes = await fetch("/api/designs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageUrl: uploadDataUrlRef.current ?? dataUrl,
                style,
                prompt: prompt.trim() || null,
                title: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Uploaded artwork",
              }),
            });
            const saved = await saveRes.json().catch(() => ({}));
            if (saveRes.ok && typeof saved.designId === "string") {
              setSavedDesignId(saved.designId);
              if (typeof saved.hasTransparency === "boolean") {
                setHasTransparency(saved.hasTransparency);
              }
              if (typeof saved.uploadedAsSvg === "boolean") {
                setUploadedAsSvg(saved.uploadedAsSvg);
              }
              setLibraryRefreshKey((k) => k + 1);
            } else if (!saveRes.ok) {
              toast.error(
                typeof saved.error === "string"
                  ? saved.error
                  : "Upload saved locally but couldn't add to your library",
              );
            }
          } catch {
            toast.error("Couldn't save upload to your library — you can still publish it");
          }
        }
      })();
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

  function handleBackToPreview() {
    if (!generatedImage) return;
    setStep("preview");
    setError(null);
  }

  function handleRemoveAttachment() {
    setGeneratedImage(null);
    setImageSource("ai");
    setHasTransparency(null);
    setUploadedAsSvg(false);
    setPlaceholderNotice(null);
    setEditingPublishedDesign(false);
    setSavedDesignId(null);
    setHasAttemptedMerch(false);
    clearMerchDraft();
    clearDesignIdFromUrl();
  }

  function handleDesignDeletedFromLibrary(designId: string) {
    if (savedDesignId !== designId) return;
    resetCreateFlow();
    toast.info("Design removed — starting fresh.");
  }

  async function handleDeleteImage() {
    if (!generatedImage) return;

    const deletingSavedDesign = authState === "signed-in" && Boolean(savedDesignId);
    const message = deletingSavedDesign
      ? "Delete this image from your library? This cannot be undone."
      : "Remove this image from your current draft?";
    if (!window.confirm(message)) return;

    setDeletingImage(true);
    setError(null);

    try {
      if (deletingSavedDesign && savedDesignId) {
        const res = await fetch(`/api/designs/${savedDesignId}`, { method: "DELETE" });
        if (!res.ok) {
          throw new Error(
            await parseErrorMessageFromResponse(res, "Could not delete image"),
          );
        }
        setLibraryRefreshKey((k) => k + 1);
        toast.success("Image deleted");
      } else {
        toast.success("Image removed");
      }

      handleRemoveAttachment();
      setRefinePrompt("");
      setStep("prompt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete image");
    } finally {
      setDeletingImage(false);
    }
  }

  function handleReset() {
    resetCreateFlow();
  }

  function handleStaleArtworkPreview() {
    resetCreateFlow();
    toast.info("That design is no longer available — starting fresh.");
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
    setPublishProgress(8);
    setPublishStage("uploading");
    setPublishStatus("Uploading design and creating listings…");

    try {
      const normalizedImageUrl =
        uploadDataUrlRef.current ??
        (typeof generatedImage === "string" ? generatedImage.trim() : generatedImage);
      const publishImageSource =
        imageSource === "upload" && typeof normalizedImageUrl === "string"
          ? inferImageSourceFromUrl(normalizedImageUrl)
          : imageSource;
      const useSavedDesign =
        typeof savedDesignId === "string" && savedDesignId.length > 0;
      const requestBody = {
        ...(useSavedDesign ? {} : { imageUrl: normalizedImageUrl }),
        imageSource: useSavedDesign ? imageSource : publishImageSource,
        designId: savedDesignId ?? undefined,
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
        ...(selectedStorefrontIds.length > 0
          ? { storefrontIds: selectedStorefrontIds }
          : {}),
        ...(Object.keys(merchPricing).length > 0
          ? {
              pricesByType: Object.fromEntries(
                [...selectedProducts]
                  .map((pt) => [pt, merchPricing[pt]?.priceCents] as const)
                  .filter(([, cents]) => typeof cents === "number" && cents > 0),
              ),
            }
          : {}),
      };

      let res = await fetch("/api/designs/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const firstError = await parseErrorMessageFromResponse(res, "Publish failed");
        const shouldRetryAsHosted =
          firstError.includes("Upload must be provided as inline image data.") &&
          typeof normalizedImageUrl === "string" &&
          !normalizedImageUrl.startsWith("data:") &&
          !normalizedImageUrl.startsWith("blob:");
        if (!shouldRetryAsHosted) {
          throw new Error(firstError);
        }
        res = await fetch("/api/designs/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...requestBody, imageSource: "ai" }),
        });
        if (!res.ok) {
          throw new Error(await parseErrorMessageFromResponse(res, "Publish failed"));
        }
      }

      const data = await res.json();
      setPublishProgress((prev) => Math.max(prev, 95));
      setPublishStage("finalizing");
      setPublishStatus("Finalizing publish…");

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
        `${data.count} product${data.count > 1 ? "s" : ""} published to your shop${selectedStorefrontIds.length > 1 ? "s" : ""}!`,
        {
          description:
            failures.length > 0
              ? `Skipped: ${failures.map((f) => `${f.productType}`).join(", ")} (${failures[0]?.message ?? "error"}${failures.length > 1 ? ", …" : ""})`
              : "Head to My Listings to manage them.",
        },
      );
      if (Array.isArray((data as { xpAwards?: unknown }).xpAwards)) {
        showXpToasts(
          (data as { xpAwards: Parameters<typeof showXpToasts>[0] }).xpAwards,
        );
      }
      setPublishProgress(100);
      clearMerchDraft();
      setHasAttemptedMerch(false);
      router.push("/dashboard/listings");
    } catch (err) {
      setError(formatPublishError(err));
      setPublishing(false);
    }
  }

  const isAnon = authState === "anon";
  const generationsExhausted = isAnon && anonRemaining <= 0;
  const canRefine =
    imageSource === "ai" && Boolean(prompt) && !placeholderNotice && !uploadedAsSvg;
  const hasAttachment = Boolean(generatedImage);
  /**
   * Compositing URL — preview derivative when showing a saved/hosted design;
   * inline data URLs (fresh upload before/during save) must win over stale ids.
   */
  const artworkPreviewSrc =
    imageSource === "upload" && generatedImage
      ? generatedImage
      : savedDesignId != null &&
          generatedImage &&
          !isInlineDesignUrl(generatedImage)
        ? designPreviewImageSrc(savedDesignId)
        : generatedImage;
  const useTransparencyBackdrop =
    imageSource === "upload" || hasTransparency === true || uploadedAsSvg;
  const attachmentLabel =
    imageSource === "upload" ? "Uploaded artwork" : "Current design";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Design <span className="gradient-text">Studio</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Describe your design, pick a style, and watch the magic happen
        </p>
        {authState === "signed-in" && (
          <div className="mt-4">
            <Link
              href="/dashboard/designs"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <Images className="h-4 w-4" />
              My Images &amp; Uploads
            </Link>
          </div>
        )}
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
                  {!editingPublishedDesign && (
                    <>
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
                    </>
                  )}
                </div>
                {!editingPublishedDesign && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    PNG, JPG, WebP, GIF, or SVG (max 8 MB). SVG uploads are rasterized server-side before
                    print so logos stay crisp; transparency is preserved when your file has alpha.
                  </p>
                )}
              </Card>

              {hasAttachment && generatedImage && (
                <Card className="border-border/50 bg-card p-4">
                  <div className="flex items-start gap-4">
                    <TransparencyPreviewBackdrop
                      active={useTransparencyBackdrop}
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/60"
                    >
                      <Image
                        src={artworkPreviewSrc ?? generatedImage}
                        alt={attachmentLabel}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </TransparencyPreviewBackdrop>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{attachmentLabel} attached</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Keep this to refine from your existing artwork, or remove it to generate something
                        new from scratch.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveAttachment}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remove attached design"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDeleteImage()}
                      disabled={deletingImage}
                      className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingImage ? "Deleting..." : "Delete image"}
                    </Button>
                  </div>
                </Card>
              )}

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
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  {hasAttachment && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleBackToPreview}
                      className="gap-2 px-8"
                    >
                      Back to preview
                    </Button>
                  )}
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    className="gap-2 bg-primary px-10 text-lg hover:bg-primary/90"
                  >
                    <Wand2 className="h-5 w-5" />
                    {hasAttachment ? "Refine from attached design" : "Generate Design"}
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-10"
            >
              <GenerationProgress
                prompt={generationMode === "refine" ? refinePrompt : prompt}
                activeStep={generationStep}
                onCancel={handleCancelGenerate}
                mode={generationMode}
              />
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
                  <TransparencyPreviewBackdrop
                    active={useTransparencyBackdrop}
                    className="relative aspect-square"
                  >
                    <Image
                      src={artworkPreviewSrc ?? generatedImage}
                      alt={placeholderNotice ? "Placeholder design (AI not configured)" : "Generated design"}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </TransparencyPreviewBackdrop>
                </Card>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">Your Design is Ready!</h2>
                    {prompt && (
                      <p className="mt-2 text-muted-foreground">{`"${prompt}"`}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-primary/30 text-primary">{style}</Badge>
                      <Badge variant="outline" className="border-neon-green/30 text-neon-green">
                        {prompt ? "AI Generated" : "Uploaded"}
                      </Badge>
                      {/**
                       * Only surfaces transparent SVG uploads — the one case
                       * where the screen preview may diverge from print.
                       */}
                      <TransparencyBadge
                        hasTransparency={hasTransparency}
                        uploadedAsSvg={uploadedAsSvg}
                      />
                    </div>
                    <div className="mt-3">
                      <TransparencyStatus
                        hasTransparency={hasTransparency}
                        uploadedAsSvg={uploadedAsSvg}
                        imageSource={imageSource}
                      />
                    </div>
                  </div>

                  {canRefine && !editingPublishedDesign && (
                    <Card className="border-border/50 bg-card p-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Refine this design
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Describe what to change — the AI keeps your current artwork as a starting point.
                      </p>
                      <Textarea
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder='e.g., "make the flames purple" or "add a basketball"'
                        className="mt-3 min-h-[80px] resize-none border-border bg-background text-sm"
                      />
                      <Button
                        onClick={handleRefine}
                        disabled={!refinePrompt.trim() || generationsExhausted}
                        className="mt-3 w-full gap-2 bg-primary hover:bg-primary/90"
                      >
                        <Sparkles className="h-4 w-4" />
                        Refine with AI
                      </Button>
                    </Card>
                  )}

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
                          <Button variant="outline" onClick={handleRecreate} className="gap-2">
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
                    <Button
                      variant="outline"
                      onClick={() => void handleDeleteImage()}
                      disabled={deletingImage}
                      className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingImage ? "Deleting..." : "Delete image"}
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

                  {!editingPublishedDesign && (
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
                  )}
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
                  imageUrl={artworkPreviewSrc ?? generatedImage}
                  selectedProductTypes={selectedProducts}
                  value={printPlacement}
                  onChange={setPrintPlacement}
                  onAspectDetected={handleAspectDetected}
                  onArtworkError={handleStaleArtworkPreview}
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3 border-t border-border/60 pt-6">
                  <Button variant="outline" onClick={handleReset} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Start over
                  </Button>
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
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Start over
                  </Button>
                </div>
              </div>

              <CategoryProductPicker
                imageUrl={artworkPreviewSrc ?? generatedImage}
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
                      imageUrl={artworkPreviewSrc ?? generatedImage}
                      selectedProductTypes={new Set<ProductType>([tuningType])}
                      value={dialogPlacement}
                      onChange={setDialogPlacement}
                      onAspectDetected={handleDialogAspectDetected}
                      hideBatchPlacementNote
                      onArtworkError={handleStaleArtworkPreview}
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

              {!isAnon && selectedProducts.size > 0 && (
                <MerchPricingStep
                  productTypes={[...selectedProducts]}
                  pricing={merchPricing}
                  onPricingChange={setMerchPricing}
                  defaultMarkupPercent={storefrontDefaultMarkupPercent}
                />
              )}

              <Card className="border-border/50 bg-card p-6 text-left">
                <h3 className="text-base font-semibold tracking-tight">Listing details</h3>
                <div
                  role="note"
                  className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 dark:text-amber-200"
                >
                  <span aria-hidden className="mt-0.5 text-base leading-none">⚠️</span>
                  <p className="leading-relaxed">
                    <strong className="font-semibold">Heads up:</strong> whatever you enter below applies to{' '}
                    <strong className="font-semibold underline underline-offset-2">every product</strong> in this publish batch. You can refine each listing individually later under{' '}
                    <strong className="font-semibold">Dashboard → Storefront</strong>.
                  </p>
                </div>

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

                  {prefilledSource !== "none" && (
                    <p
                      className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-foreground"
                      role="status"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      {prefilledSource === "storefront-defaults"
                        ? "Pre-filled from your store defaults — edit anytime"
                        : "Pre-filled from your last listing — edit anytime"}
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="create-listing-description"
                      className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground"
                    >
                      <span>
                        Add a description{' '}
                        <span className="font-normal text-muted-foreground">(multi-line, 20+ chars)</span>
                      </span>
                      <XpBadge points={XP_RULES.PRODUCT_DESCRIPTION.points} variant="inline" />
                    </Label>
                    <Textarea
                      id="create-listing-description"
                      value={listingDescription}
                      onChange={(e) => {
                        descriptionTouchedRef.current = true;
                        setListingDescription(e.target.value);
                      }}
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
                      <Label
                        htmlFor="create-product-tags"
                        className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground"
                      >
                        <span>
                          Add at least 3 tags{' '}
                          <span className="font-normal text-muted-foreground">(single line)</span>
                        </span>
                        <XpBadge points={XP_RULES.PRODUCT_TAGS.points} variant="inline" />
                      </Label>
                      <Input
                        id="create-product-tags"
                        value={productTags}
                        onChange={(e) => {
                          tagsTouchedRef.current = true;
                          setProductTags(e.target.value);
                        }}
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
                      <SlugTextInput
                        id="create-product-category"
                        list="browse-seo-categories"
                        value={productCategory}
                        onChange={(value) => {
                          categoryTouchedRef.current = true;
                          setProductCategory(value);
                        }}
                        placeholder="Type a category, e.g. streetwear-style"
                        className="h-9 bg-background text-sm shadow-sm"
                        aria-describedby="create-product-category-hint"
                        maxLength={MAX_PRODUCT_CATEGORY_SLUG_LEN}
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

              {!isAnon && ownedStorefronts.length > 1 && (
                <Card className="border-border/50 bg-card p-6 text-left">
                  <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                    <Store className="h-4 w-4 text-primary" />
                    Publish to which storefronts?
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Each storefront has its own URL and audience. Your default is
                    pre-selected — add or remove storefronts for this batch.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {ownedStorefronts.map((s) => {
                      const active = selectedStorefrontIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setSelectedStorefrontIds((prev) => {
                              if (prev.includes(s.id)) {
                                if (prev.length <= 1) {
                                  toast.error("Choose at least one storefront");
                                  return prev;
                                }
                                return prev.filter((id) => id !== s.id);
                              }
                              return [...prev, s.id];
                            })
                          }
                          aria-pressed={active}
                          className={`rounded-lg border p-3 text-left transition ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-border/60 hover:border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{s.display_name}</span>
                            {s.is_default && (
                              <Badge
                                variant="outline"
                                className="border-primary/40 text-primary"
                              >
                                Default
                              </Badge>
                            )}
                          </div>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            /shop/{s.slug}
                          </span>
                          {active && (
                            <span className="mt-2 inline-flex rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Included
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedStorefrontIds.length} storefront
                    {selectedStorefrontIds.length === 1 ? "" : "s"} selected
                  </p>
                </Card>
              )}

              {isAnon ? (
                <>
                  <SignInGate
                    title="Sign in to publish your merch"
                    description="Publishing creates a real shop where people can buy this. We'll save your designs the moment you sign in."
                  />
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => void handleDeleteImage()}
                      disabled={deletingImage}
                      className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingImage ? "Deleting..." : "Delete image"}
                    </Button>
                    <Button variant="outline" onClick={() => setStep("placement")} className="gap-2">
                      Back to print layout
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex w-full flex-col items-center justify-center gap-4">
                  {publishing && (
                    <div
                      className="w-full max-w-xl rounded-lg border border-primary/30 bg-primary/10 p-3"
                      aria-live="polite"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-foreground">{publishStatus}</span>
                        <span className="tabular-nums text-foreground/90">
                          {Math.round(publishProgress)}%
                        </span>
                      </div>
                      <div className="mb-2 grid grid-cols-3 gap-2 text-[11px]">
                        {(
                          [
                            { key: "uploading", label: "Uploading" },
                            { key: "creating", label: "Creating products" },
                            { key: "finalizing", label: "Finalizing" },
                          ] as const
                        ).map((s) => {
                          const order: Record<PublishStage, number> = {
                            uploading: 0,
                            creating: 1,
                            finalizing: 2,
                          };
                          const state =
                            order[publishStage] > order[s.key]
                              ? "done"
                              : order[publishStage] === order[s.key]
                                ? "active"
                                : "pending";
                          return (
                            <div
                              key={s.key}
                              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${
                                state === "done"
                                  ? "border-primary/40 bg-primary/15 text-primary"
                                  : state === "active"
                                    ? "border-primary/50 bg-primary/20 text-foreground"
                                    : "border-border/60 bg-background/30 text-muted-foreground"
                              }`}
                            >
                              {state === "done" ? (
                                <Check className="h-3 w-3 shrink-0" />
                              ) : (
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                    state === "active" ? "bg-primary" : "bg-muted-foreground/70"
                                  }`}
                                />
                              )}
                              <span className="truncate">{s.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                          style={{
                            width: `${Math.max(6, Math.min(100, publishProgress))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => void handleDeleteImage()}
                    disabled={deletingImage || publishing}
                    className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingImage ? "Deleting..." : "Delete image"}
                  </Button>
                  <Button variant="outline" onClick={() => setStep("placement")} className="gap-2">
                    Back to print layout
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={
                      selectedProducts.size === 0 ||
                      publishing ||
                      [...selectedProducts].some(
                        (pt) => (merchPricing[pt]?.markupPercent ?? 0) === 0,
                      )
                    }
                      onClick={handlePublish}
                      className="relative gap-2 overflow-hidden bg-primary px-8 hover:bg-primary/90"
                    >
                      {publishing && (
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-primary-foreground/20">
                          <span
                            className="block h-full bg-primary-foreground/80 transition-[width] duration-700 ease-out"
                            style={{
                              width: `${Math.max(6, Math.min(100, publishProgress))}%`,
                            }}
                          />
                        </span>
                      )}
                      {publishing ? (
                        <>
                          <Wand2 className="h-4 w-4 animate-spin" />
                          <span>
                            Publishing... ({Math.round(publishProgress)}%)
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Publish to My Shop ({selectedProducts.size} items)
                        </>
                      )}
                    </Button>
                    <XpBadge
                      points={XP_RULES.PRODUCT_PUBLISHED.points}
                      variant="prominent"
                    />
                  </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {authState === "signed-in" && (
        <section className="mt-16 border-t border-border/50 pt-12">
          <DesignLibraryInfiniteGrid
            enabled
            mode="pick"
            showActions
            refreshKey={libraryRefreshKey}
            onPick={(d) => void loadDesignFromLibrary(d)}
            onDeleted={handleDesignDeletedFromLibrary}
            title="Your saved designs"
            description="Everything you've generated or uploaded is kept here. Click any image to pick it back up — scroll for more."
          />
        </section>
      )}
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
