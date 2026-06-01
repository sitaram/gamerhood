import type { StoredPrintPlacement } from "@/lib/print/placement";

export interface Creator {
  id: string;
  displayName: string;
  slug: string;
  avatarUrl: string;
  bio: string;
  level: number;
  xp: number;
  totalSales: number;
  totalDesigns: number;
  joinedAt: string;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Design {
  id: string;
  creatorId: string;
  title: string;
  imageUrl: string;
  prompt?: string;
  style: DesignStyle;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export type DesignStyle =
  | "anime"
  | "streetwear"
  | "pixel-art"
  | "graffiti"
  | "minimalist"
  | "vaporwave"
  | "comic"
  | "realistic";

export interface Product {
  id: string;
  designId: string;
  creatorId: string;
  creator?: Creator;
  design?: Design;
  title: string;
  description: string;
  productType: ProductType;
  basePrice: number;
  markup: number;
  price: number;
  mockupUrl: string;
  /** Source artwork URL when `designs` row is joined — powers placement previews. */
  designImageUrl?: string;
  /** Saved zoom/pan/aspect per listing; fulfillment + thumbnails. */
  printPlacement?: StoredPrintPlacement | null;
  colors: string[];
  sizes?: string[];
  isPublished: boolean;
  createdAt: string;
  salesCount: number;
  printfulCatalogVariantId?: number;
  creatorStripeAccountId?: string;
  /** SEO / discovery — comma or list in DB */
  tags?: string[];
  /** Broad grouping for filters + SEO, e.g. `gaming`, `streetwear` */
  category?: string;
  /** Optional long copy for listings / meta; falls back to `description` */
  seoDescription?: string;
  /** Snapshot from Printful catalog (blank description, size charts, etc.). */
  printfulCatalogMeta?: PrintfulCatalogMeta;
}

export type ProductType =
  | "hoodie"
  | "kids-hoodie"
  | "kids-heavyweight-tee"
  | "kids-long-sleeve"
  | "kids-sports-tee"
  | "kids-tshirt"
  | "tshirt"
  | "joggers"
  | "mug"
  | "poster"
  | "backpack"
  | "phone-case"
  | "sticker"
  | "pillow"
  | "blanket"
  | "pet-sweater"
  | "tote-bag"
  | "ornament"
  | "puzzle"
  | "embroidered-patch"
  | "hardcover-journal";

/** Rows built from Printful `GET /catalog-products/{id}/sizes`. */
export interface PrintfulSizeGuideTable {
  guideType: string;
  unit: string;
  introPlain: string;
  imageUrl: string | null;
  measurementHelpPlain: string;
  rows: { dimension: string; valuesBySize: Record<string, string> }[];
}

/** Persisted JSON on `products.printful_catalog_meta`. */
export interface PrintfulCatalogMeta {
  fetchedAt: string;
  catalogProductId: number;
  catalogVariantId: number;
  productName: string;
  brand: string | null;
  model: string | null;
  printfulType: string | null;
  blankDescription: string;
  availableSizes: string[];
  catalogColors: Array<{ name: string; hex: string | null }>;
  sizeGuides: PrintfulSizeGuideTable[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor: string;
  selectedSize?: string;
}

export interface Order {
  id: string;
  buyerEmail: string;
  items: CartItem[];
  total: number;
  platformFee: number;
  creatorEarnings: number;
  status: "pending" | "processing" | "shipped" | "delivered";
  trackingNumber?: string;
  createdAt: string;
}

export interface GenerateDesignRequest {
  prompt: string;
  style: DesignStyle;
  negativePrompt?: string;
  /** When set, Gemini edits this image instead of generating from scratch. */
  referenceImageUrl?: string;
  /** Full prompt text to store on the design row (e.g. refine history). */
  savedPrompt?: string;
}

export interface GenerateDesignResponse {
  imageUrl: string;
  prompt: string;
  style: DesignStyle;
}
