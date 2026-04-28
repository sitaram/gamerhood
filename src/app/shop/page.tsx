import { createClient } from "@/lib/supabase/server";
import { getPublishedProducts } from "@/lib/supabase/queries";
import { ShopBrowser } from "@/components/storefront/shop-browser";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const supabase = await createClient();
  const products = await getPublishedProducts(supabase);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">
          Browse the <span className="gradient-text">Shop</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Discover unique merch created by young designers from around the world
        </p>
      </div>

      <ShopBrowser products={products} />
    </div>
  );
}
