import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProductByIdWithCreator } from "@/lib/supabase/queries";
import { ProductDetail } from "@/components/storefront/product-detail";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProductByIdWithCreator(supabase, id);
  if (!product) {
    return { title: "Product" };
  }
  const desc =
    product.seoDescription?.trim() || product.description?.trim() || product.title;
  const url = `${siteUrl()}/product/${id}`;
  const keywords = product.tags?.length ? product.tags.join(", ") : undefined;

  const previewImage =
    product.designImageUrl?.trim() || product.mockupUrl?.trim() || undefined;

  return {
    title: product.title,
    description: desc,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      title: product.title,
      description: desc,
      url,
      type: "website",
      ...(previewImage ? { images: [{ url: previewImage }] } : {}),
    },
    twitter: {
      card: previewImage ? "summary_large_image" : "summary",
      title: product.title,
      description: desc,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProductByIdWithCreator(supabase, id);

  if (!product) notFound();

  const shareUrl = `${siteUrl()}/product/${id}`;
  return <ProductDetail product={product} shareUrl={shareUrl} />;
}
