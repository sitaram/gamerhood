import { Creator, Product, Design, Badge } from "./types";

const BADGES: Badge[] = [
  { id: "first-design", name: "First Drop", icon: "🎨", description: "Published your first design" },
  { id: "first-sale", name: "Cha-Ching!", icon: "💰", description: "Made your first sale" },
  { id: "ten-sales", name: "On Fire", icon: "🔥", description: "10 sales and counting" },
  { id: "hundred-sales", name: "Legend", icon: "⚡", description: "100 sales — legendary status" },
  { id: "five-designs", name: "Creative Machine", icon: "🎯", description: "5 designs published" },
  { id: "trending", name: "Trending", icon: "📈", description: "Made it to trending" },
];

export const MOCK_CREATORS: Creator[] = [
  {
    id: "c1",
    displayName: "DragonSlayer99",
    slug: "dragonslayer99",
    avatarUrl: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=DragonSlayer99",
    bio: "I draw dragons, swords, and epic boss fights. Level 42 in real life.",
    level: 12,
    xp: 3400,
    totalSales: 47,
    totalDesigns: 15,
    joinedAt: "2025-09-15",
    badges: [BADGES[0], BADGES[1], BADGES[2]],
  },
  {
    id: "c2",
    displayName: "PixelPrincess",
    slug: "pixelprincess",
    avatarUrl: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=PixelPrincess",
    bio: "Retro pixel art is my vibe. Making 8-bit cool again.",
    level: 8,
    xp: 1850,
    totalSales: 23,
    totalDesigns: 9,
    joinedAt: "2025-11-02",
    badges: [BADGES[0], BADGES[1]],
  },
  {
    id: "c3",
    displayName: "NeonNinja",
    slug: "neonninja",
    avatarUrl: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=NeonNinja",
    bio: "Cyberpunk aesthetics and neon everything. Future is now.",
    level: 15,
    xp: 5200,
    totalSales: 89,
    totalDesigns: 22,
    joinedAt: "2025-07-20",
    badges: [BADGES[0], BADGES[1], BADGES[2], BADGES[5]],
  },
  {
    id: "c4",
    displayName: "CosmicKid",
    slug: "cosmickid",
    avatarUrl: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=CosmicKid",
    bio: "Space, galaxies, and intergalactic drip. Houston, we have merch.",
    level: 6,
    xp: 1100,
    totalSales: 11,
    totalDesigns: 7,
    joinedAt: "2026-01-10",
    badges: [BADGES[0], BADGES[1]],
  },
  {
    id: "c5",
    displayName: "StreetArtSam",
    slug: "streetartsam",
    avatarUrl: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=StreetArtSam",
    bio: "Graffiti-inspired designs. Every wall is a canvas, every hoodie is a wall.",
    level: 10,
    xp: 2700,
    totalSales: 34,
    totalDesigns: 12,
    joinedAt: "2025-10-05",
    badges: [BADGES[0], BADGES[1], BADGES[2]],
  },
  {
    id: "c6",
    displayName: "AnimeAce",
    slug: "animeace",
    avatarUrl: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=AnimeAce",
    bio: "Anime-inspired original characters. No copies, only originals.",
    level: 18,
    xp: 7100,
    totalSales: 156,
    totalDesigns: 31,
    joinedAt: "2025-06-01",
    badges: [BADGES[0], BADGES[1], BADGES[2], BADGES[3], BADGES[4], BADGES[5]],
  },
];

const PLACEHOLDER_DESIGNS: string[] = [
  "https://placehold.co/800x800/1a1a2e/e94560?text=Dragon+Fire",
  "https://placehold.co/800x800/16213e/0f3460?text=Pixel+World",
  "https://placehold.co/800x800/1a1a2e/e94560?text=Neon+City",
  "https://placehold.co/800x800/0f0e17/ff8906?text=Space+Vibes",
  "https://placehold.co/800x800/2d00f7/e500a4?text=Street+Art",
  "https://placehold.co/800x800/240046/c77dff?text=Anime+Hero",
  "https://placehold.co/800x800/10002b/e0aaff?text=Galaxy+Drop",
  "https://placehold.co/800x800/001219/94d2bd?text=Retro+Wave",
];

export const MOCK_DESIGNS: Design[] = [
  { id: "d1", creatorId: "c1", title: "Dragon's Fury", imageUrl: PLACEHOLDER_DESIGNS[0], prompt: "An epic fire-breathing dragon in neon colors", style: "anime", status: "approved", createdAt: "2026-03-01" },
  { id: "d2", creatorId: "c2", title: "8-Bit Adventure", imageUrl: PLACEHOLDER_DESIGNS[1], prompt: "Pixel art adventure landscape with hero", style: "pixel-art", status: "approved", createdAt: "2026-03-05" },
  { id: "d3", creatorId: "c3", title: "Neon Skyline", imageUrl: PLACEHOLDER_DESIGNS[2], prompt: "Cyberpunk city skyline with neon lights", style: "vaporwave", status: "approved", createdAt: "2026-03-08" },
  { id: "d4", creatorId: "c4", title: "Cosmic Explorer", imageUrl: PLACEHOLDER_DESIGNS[3], prompt: "Astronaut surfing through a colorful nebula", style: "comic", status: "approved", createdAt: "2026-03-10" },
  { id: "d5", creatorId: "c5", title: "Urban Canvas", imageUrl: PLACEHOLDER_DESIGNS[4], prompt: "Graffiti-style abstract art with bold colors", style: "graffiti", status: "approved", createdAt: "2026-03-12" },
  { id: "d6", creatorId: "c6", title: "Shadow Warrior", imageUrl: PLACEHOLDER_DESIGNS[5], prompt: "Anime warrior with glowing sword in moonlight", style: "anime", status: "approved", createdAt: "2026-03-14" },
  { id: "d7", creatorId: "c4", title: "Nebula Drift", imageUrl: PLACEHOLDER_DESIGNS[6], prompt: "Galaxy with swirling purple and blue nebula", style: "realistic", status: "approved", createdAt: "2026-03-15" },
  { id: "d8", creatorId: "c2", title: "Retro Runner", imageUrl: PLACEHOLDER_DESIGNS[7], prompt: "Pixel art character running through retro landscape", style: "pixel-art", status: "approved", createdAt: "2026-03-16" },
];

const PRODUCT_TYPES = ["hoodie", "tshirt", "poster", "mug", "sticker", "backpack", "phone-case"] as const;
const PRODUCT_COLORS: Record<string, string[]> = {
  hoodie: ["Black", "Navy", "Charcoal", "Forest Green"],
  tshirt: ["Black", "White", "Navy", "Red", "Heather Gray"],
  joggers: ["Black", "Charcoal", "Navy"],
  poster: ["N/A"],
  mug: ["White", "Black"],
  sticker: ["N/A"],
  backpack: ["Black", "Navy"],
  "phone-case": ["Clear", "Black"],
};
const SIZES = ["XS", "S", "M", "L", "XL", "2XL"];

function makeProduct(
  id: string,
  designIdx: number,
  type: (typeof PRODUCT_TYPES)[number],
  basePrice: number,
  markup: number,
): Product {
  const design = MOCK_DESIGNS[designIdx];
  const creator = MOCK_CREATORS.find((c) => c.id === design.creatorId)!;
  return {
    id,
    designId: design.id,
    creatorId: design.creatorId,
    creator,
    design,
    title: `${design.title} ${type.charAt(0).toUpperCase() + type.slice(1).replace("-", " ")}`,
    description: `Original "${design.title}" design by ${creator.displayName} on a premium ${type}.`,
    productType: type,
    basePrice,
    markup,
    price: basePrice + markup,
    mockupUrl: design.imageUrl,
    colors: PRODUCT_COLORS[type] || ["Black"],
    sizes: ["hoodie", "tshirt", "joggers"].includes(type) ? SIZES : undefined,
    isPublished: true,
    createdAt: design.createdAt,
    salesCount: ((designIdx * 7 + PRODUCT_TYPES.indexOf(type) * 13 + 3) % 47) + 2,
  };
}

export const MOCK_PRODUCTS: Product[] = [
  makeProduct("p1", 0, "hoodie", 28, 14),
  makeProduct("p2", 0, "tshirt", 16, 10),
  makeProduct("p3", 1, "tshirt", 16, 9),
  makeProduct("p4", 1, "poster", 8, 7),
  makeProduct("p5", 2, "hoodie", 28, 15),
  makeProduct("p6", 2, "mug", 10, 8),
  makeProduct("p7", 3, "hoodie", 28, 12),
  makeProduct("p8", 3, "sticker", 3, 3),
  makeProduct("p9", 4, "tshirt", 16, 11),
  makeProduct("p10", 4, "backpack", 22, 15),
  makeProduct("p11", 5, "hoodie", 28, 16),
  makeProduct("p12", 5, "phone-case", 12, 10),
  makeProduct("p13", 6, "poster", 8, 8),
  makeProduct("p14", 6, "tshirt", 16, 10),
  makeProduct("p15", 7, "hoodie", 28, 13),
  makeProduct("p16", 7, "mug", 10, 7),
];

export function getCreatorBySlug(slug: string): Creator | undefined {
  return MOCK_CREATORS.find((c) => c.slug === slug);
}

export function getProductsByCreator(creatorId: string): Product[] {
  return MOCK_PRODUCTS.filter((p) => p.creatorId === creatorId);
}

export function getProductById(id: string): Product | undefined {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}

export function getFeaturedProducts(count = 8): Product[] {
  return [...MOCK_PRODUCTS].sort((a, b) => b.salesCount - a.salesCount).slice(0, count);
}

export function getTrendingCreators(count = 4): Creator[] {
  return [...MOCK_CREATORS].sort((a, b) => b.totalSales - a.totalSales).slice(0, count);
}
