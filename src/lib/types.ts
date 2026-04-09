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
  colors: string[];
  sizes?: string[];
  isPublished: boolean;
  createdAt: string;
  salesCount: number;
  printifyProductId?: string;
  printifyVariantId?: number;
  creatorStripeAccountId?: string;
}

export type ProductType =
  | "hoodie"
  | "tshirt"
  | "joggers"
  | "mug"
  | "poster"
  | "backpack"
  | "phone-case"
  | "sticker";

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
}

export interface GenerateDesignResponse {
  imageUrl: string;
  prompt: string;
  style: DesignStyle;
}
