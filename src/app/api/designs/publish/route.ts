import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { insertDesign, insertProduct, getDefaultProfileForAuthUser } from "@/lib/supabase/queries";

const BASE_PRICES_CENTS: Record<string, number> = {
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
    designId?: string;
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

    let resolvedDesignId = body.designId;
    if (!resolvedDesignId) {
      const { data: design, error: designErr } = await insertDesign(supabase, {
        profile_id: profileId,
        title: designTitle,
        image_url: body.imageUrl,
        prompt: body.prompt,
        style: body.style,
      });

      if (designErr || !design) {
        console.error("[Publish] Design insert error:", designErr);
        return NextResponse.json({ error: "Failed to save design" }, { status: 500 });
      }
      resolvedDesignId = design.id;
    }
    if (!resolvedDesignId) {
      return NextResponse.json({ error: "Failed to resolve design" }, { status: 500 });
    }
    const designId = resolvedDesignId;

    const products: { type: string; id: string }[] = [];

    for (const productType of body.productTypes) {
      const basePrice = BASE_PRICES_CENTS[productType] ?? 2000;
      const markup = Math.round(basePrice * 0.3);

      const { data: product, error: productErr } = await insertProduct(supabase, {
        design_id: designId,
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
        printify_product_id: null,
      });

      if (productErr || !product) {
        console.error(`[Publish] Product insert error for ${productType}:`, productErr);
        continue;
      }

      products.push({ type: productType, id: product.id });
    }

    return NextResponse.json({
      designId,
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
