import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProductByIdWithCreator } from "@/lib/supabase/queries";
import { ProductDetail } from "@/components/storefront/product-detail";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProductByIdWithCreator(supabase, id);

  if (!product) notFound();

  return <ProductDetail product={product} />;
}
