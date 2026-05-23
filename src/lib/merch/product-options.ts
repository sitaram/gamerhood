import type { ProductType } from "@/lib/types";

/** Apparel types that need size selection at checkout. */
export const MERCH_SIZED_TYPES = new Set<ProductType>([
  "hoodie",
  "kids-hoodie",
  "kids-heavyweight-tee",
  "kids-long-sleeve",
  "kids-sports-tee",
  "kids-tshirt",
  "tshirt",
  "joggers",
  "pet-sweater",
]);

export function apparelSizes(productType: ProductType): string[] {
  if (productType === "kids-hoodie") return ["S", "M", "L", "XL"];
  if (productType === "kids-tshirt" || productType === "kids-long-sleeve" || productType === "kids-heavyweight-tee")
    return ["S", "M", "L", "XL"];
  if (productType === "kids-sports-tee") return ["XS", "S", "M", "L", "XL"];
  if (productType === "pet-sweater") return ["XS", "S", "M", "L", "XL"];
  return ["XS", "S", "M", "L", "XL", "2XL"];
}

export function storefrontColors(productType: ProductType): string[] {
  if (productType === "kids-hoodie") {
    return ["Athletic Heather", "Black", "Navy Blazer", "White"];
  }
  if (productType === "kids-tshirt" || productType === "kids-long-sleeve" || productType === "kids-heavyweight-tee") {
    return ["Athletic Heather", "Black", "Navy", "White"];
  }
  if (productType === "kids-sports-tee") {
    return ["Black", "Dark Heather", "Navy", "White"];
  }
  return ["Default"];
}

export function publishTypeTitle(productType: ProductType): string {
  if (productType === "kids-hoodie") return "Kids hoodie";
  if (productType === "kids-tshirt") return "Kids tee";
  if (productType === "kids-heavyweight-tee") return "Kids heavyweight tee";
  if (productType === "kids-long-sleeve") return "Kids long sleeve";
  if (productType === "kids-sports-tee") return "Kids sports tee";
  if (productType === "blanket") return "Sherpa blanket";
  if (productType === "pet-sweater") return "Pet sweater";
  if (productType === "tote-bag") return "Eco tote";
  if (productType === "ornament") return "Metal ornament";
  if (productType === "puzzle") return "Jigsaw puzzle";
  if (productType === "embroidered-patch") return "Embroidered patch";
  if (productType === "hardcover-journal") return "Hardcover journal";
  return (
    productType.charAt(0).toUpperCase() +
    productType.slice(1).replace("-", " ")
  );
}
