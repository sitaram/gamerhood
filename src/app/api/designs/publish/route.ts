import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertDesign, insertProduct, getDefaultProfileForAuthUser } from "@/lib/supabase/queries";
import {
  uploadImage,
  createProduct as createPrintifyProduct,
  publishProduct,
} from "@/lib/printify/client";

const BLUEPRINT_MAP: Record<string, { id: number; providerId: number }> = {
  tshirt: { id: 6, providerId: 1 },
  hoodie: { id: 77, providerId: 1 },
  mug: { id: 635, providerId: 28 },
  poster: { id: 49, providerId: 15 },
  sticker: { id: 669, providerId: 47 },
  backpack: { id: 272, providerId: 27 },
  "phone-case": { id: 14, providerId: 24 },
};

const BASE_PRICES: Record<string, number> = {
  hoodie: 4200,
  tshirt: 2600,
  poster: 1500,
  mug: 1800,
  sticker: 600,
  backpack: 3700,
  "phone-case": 2200,
};

export async function POST(request: NextRequest) {
  let body: {
    imageUrl: string;
    prompt: string | null;
    style: string;
    productTypes: string[];
    title?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "No creator profile found" }, { status: 400 });
    }
    const profileId = profile.id;

    const designTitle = body.title || body.prompt?.slice(0, 50) || "My Design";

    const { data: design, error: designErr } = await insertDesign(supabase, {
      profile_id: profileId,
      title: designTitle,
      image_url: body.imageUrl,
      prompt: body.prompt,
      style: body.style,
    });

    if (designErr) {
      console.error("[Publish] Design insert error:", designErr);
      return NextResponse.json({ error: "Failed to save design" }, { status: 500 });
    }

    const hasPrintify = !!process.env.PRINTIFY_API_TOKEN && !!process.env.PRINTIFY_SHOP_ID;
    const products: { type: string; id: string }[] = [];

    for (const productType of body.productTypes) {
      const basePrice = BASE_PRICES[productType] || 2000;
      const markup = Math.round(basePrice * 0.3);
      const price = basePrice + markup;
      let printifyProductId: string | null = null;
      let printifyVariantId: number | null = null;

      if (hasPrintify) {
        try {
          const blueprint = BLUEPRINT_MAP[productType];
          if (blueprint) {
            const uploaded = await uploadImage(`${designTitle}-${productType}.png`, body.imageUrl);

            const printifyProduct = await createPrintifyProduct({
              title: `${designTitle} ${productType.charAt(0).toUpperCase() + productType.slice(1)}`,
              description: body.prompt || designTitle,
              blueprint_id: blueprint.id,
              print_provider_id: blueprint.providerId,
              variants: [{ id: 1, price, is_enabled: true }],
              print_areas: [
                {
                  variant_ids: [1],
                  placeholders: [
                    {
                      position: "front",
                      images: [
                        { id: uploaded.id, x: 0.5, y: 0.5, scale: 1, angle: 0 },
                      ],
                    },
                  ],
                },
              ],
            });

            printifyProductId = printifyProduct.id;
            printifyVariantId = printifyProduct.variants[0]?.id ?? null;

            await publishProduct(printifyProduct.id).catch((err) =>
              console.warn("[Publish] Printify publish warning:", err),
            );
          }
        } catch (err) {
          console.error(`[Publish] Printify product creation failed for ${productType}:`, err);
        }
      }

      const { data: product, error: productErr } = await insertProduct(supabase, {
        design_id: design.id,
        profile_id: profileId,
        title: `${designTitle} ${productType.charAt(0).toUpperCase() + productType.slice(1)}`,
        description: body.prompt || designTitle,
        product_type: productType,
        base_price_cents: basePrice,
        markup_cents: markup,
        mockup_url: body.imageUrl,
        colors: ["Default"],
        sizes: ["hoodie", "tshirt"].includes(productType)
          ? ["XS", "S", "M", "L", "XL", "2XL"]
          : null,
        is_published: true,
        printify_product_id: printifyProductId,
      });

      if (productErr) {
        console.error(`[Publish] Product insert error for ${productType}:`, productErr);
        continue;
      }

      products.push({ type: productType, id: product.id });
    }

    return NextResponse.json({
      designId: design.id,
      products,
      count: products.length,
    });
  } catch (err) {
    console.error("[Publish] Error:", err);
    return NextResponse.json(
      { error: "Failed to publish products" },
      { status: 500 },
    );
  }
}
