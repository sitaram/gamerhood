import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductCard } from "@/components/storefront/product-card";
import { createClient } from "@/lib/supabase/server";
import {
  getPublishedProductsForBrowse,
  getBrowseCategoryBySlug,
} from "@/lib/supabase/queries";
import {
  RESERVED_BROWSE_FIRST_SEGMENTS,
  normalizeBrowseCategorySegment,
  merchSegmentToProductType,
  formatBrowseHeading,
} from "@/lib/browse-routes";
import { siteUrl } from "@/lib/site";
import { blockedSlugLanguageReason } from "@/lib/slug-content-policy";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ category: string; merch: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, merch } = await params;
  const cat = normalizeBrowseCategorySegment(category);
  const type = merchSegmentToProductType(merch);
  if (
    !cat ||
    !type ||
    RESERVED_BROWSE_FIRST_SEGMENTS.has(cat) ||
    blockedSlugLanguageReason(cat)
  ) {
    return { title: "Browse" };
  }

  const supabase = await createClient();
  const seo = await getBrowseCategoryBySlug(supabase, cat);
  const merchPretty = merch
    .trim()
    .toLowerCase()
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const defaultTitle = `${formatBrowseHeading(cat, type)} | Gamerhood`;
  const baseHuman = cat
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const title = seo?.seo_title?.trim()
    ? `${seo.seo_title.trim()} · ${merchPretty} | Gamerhood`
    : defaultTitle;

  const description =
    seo?.seo_description?.trim() ||
    `Shop ${baseHuman} ${merchPretty.toLowerCase()} designs on Gamerhood — independent creator merch.`;

  const path = `/${cat}/${merch.trim().toLowerCase()}`;
  const canonical = `${siteUrl()}${path}`;
  const keywordStr =
    seo?.keywords && seo.keywords.length > 0 ? seo.keywords.join(", ") : undefined;

  return {
    title,
    description,
    ...(keywordStr ? { keywords: keywordStr } : {}),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function BrowseCategoryMerchPage({ params }: Props) {
  const { category, merch } = await params;
  const cat = normalizeBrowseCategorySegment(category);
  const productType = merchSegmentToProductType(merch);

  if (!cat || !productType) {
    notFound();
  }

  if (RESERVED_BROWSE_FIRST_SEGMENTS.has(cat)) {
    notFound();
  }

  if (blockedSlugLanguageReason(cat)) {
    notFound();
  }

  const supabase = await createClient();
  const seo = await getBrowseCategoryBySlug(supabase, cat);
  const products = await getPublishedProductsForBrowse(supabase, cat, productType);

  const heading = formatBrowseHeading(cat, productType);
  const merchPretty = merch
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: seo?.seo_title?.trim() || heading,
    description: seo?.seo_description?.trim() || undefined,
    ...(seo?.keywords?.length ? { keywords: seo.keywords.join(", ") } : {}),
    numberOfItems: products.length,
    itemListElement: products.slice(0, 24).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl()}/product/${p.id}`,
      name: p.title,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground capitalize">{cat.replace(/-/g, " ")}</span>
        <span className="mx-2">/</span>
        <span className="text-foreground">{merchPretty}</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {seo?.name ? (
          <>
            <span className="gradient-text">{seo.name}</span>
            <span className="text-foreground"> · {merchPretty}</span>
          </>
        ) : (
          heading
        )}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Listings match your store <strong className="font-medium text-foreground">category</strong> or a{" "}
        <strong className="font-medium text-foreground">tag</strong> named{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{cat}</code> — set them when you publish or in
        storefront settings.
      </p>

      <p className="mt-4 text-sm text-muted-foreground">
        {products.length} {products.length === 1 ? "item" : "items"}
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {products.length === 0 && (
        <div className="mt-16 rounded-2xl border border-dashed border-border/50 bg-card/40 px-6 py-14 text-center">
          <p className="text-lg font-medium text-muted-foreground">No products in this browse view yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Use category <strong>{cat}</strong> (or tag it on your listings) and publish{" "}
            <strong>{merchPretty}</strong> merch.
          </p>
          <Link href="/create" className="mt-6 inline-block text-primary hover:underline text-sm font-medium">
            Create a design →
          </Link>
        </div>
      )}
    </div>
  );
}
