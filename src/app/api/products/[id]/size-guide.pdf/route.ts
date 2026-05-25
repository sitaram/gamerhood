import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getProductByIdWithCreator } from "@/lib/supabase/queries";
import { sanitizeSlugInput, MAX_STORE_SLUG_LEN } from "@/lib/slug-utils";
import { siteUrl } from "@/lib/site";
import {
  SizeGuideDocument,
  buildSizeGuideGroups,
  pickDiagramUrl,
  type SizeGuideGroup,
} from "@/lib/pdf/size-guide-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8000;

async function fetchImageBytes(
  url: string,
): Promise<{ data: Buffer; format: "png" | "jpg" } | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const data = Buffer.from(ab);
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const format: "png" | "jpg" =
      ct.includes("png") ? "png" : ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : "png";
    return { data, format };
  } catch {
    return null;
  }
}

async function loadLogo(): Promise<{ data: Buffer; format: "png" | "jpg" } | null> {
  try {
    const p = path.join(process.cwd(), "public", "brand", "logo-mark.png");
    const data = await fs.readFile(p);
    return { data, format: "png" };
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await context.params;
  const supabase = await createClient();
  const product = await getProductByIdWithCreator(supabase, productId);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const meta = product.printfulCatalogMeta;
  if (!meta || meta.sizeGuides.length === 0) {
    return NextResponse.json(
      { error: "Size guide not available for this product" },
      { status: 404 },
    );
  }

  const groups: SizeGuideGroup[] = buildSizeGuideGroups(meta);
  const diagramUrl = pickDiagramUrl(meta);

  const [logo, diagram] = await Promise.all([
    loadLogo(),
    diagramUrl ? fetchImageBytes(diagramUrl) : Promise.resolve(null),
  ]);

  if (diagram && groups.length > 0) {
    groups[0].diagramBytes = diagram.data;
    groups[0].diagramFormat = diagram.format;
  }

  const slug =
    sanitizeSlugInput(product.title || "product", MAX_STORE_SLUG_LEN) || "product";
  const productUrl = `${siteUrl()}/product/${product.id}`;

  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(
      SizeGuideDocument({
        productName: product.title,
        productSlug: slug,
        productUrl,
        creatorName: product.creator?.displayName ?? null,
        groups,
        logoBuffer: logo?.data ?? null,
        logoFormat: logo?.format ?? null,
        generatedAt: new Date(),
      }),
    );
  } catch (err) {
    console.error("[size-guide.pdf] render failed", productId, err);
    return NextResponse.json({ error: "Could not generate size guide" }, { status: 500 });
  }

  const filename = `gamerhood-${slug}-size-guide.pdf`;
  const body = new Uint8Array(pdf);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
