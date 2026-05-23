import { getServiceClient } from "@/lib/supabase/admin";

/** True if any purchase line references this catalog product (blocks hard delete). */
export async function productHasOrderHistory(productId: string): Promise<boolean> {
  const admin = getServiceClient();
  const { count, error } = await admin
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) {
    console.error("[delete-guards] order_items count product", error.message);
    throw new Error("Could not verify order history");
  }
  return (count ?? 0) > 0;
}

/** True if any product derived from this design has order lines. */
export async function designHasOrderHistoryViaProducts(designId: string): Promise<boolean> {
  const admin = getServiceClient();
  const { data: products, error: pErr } = await admin.from("products").select("id").eq("design_id", designId);
  if (pErr) {
    console.error("[delete-guards] products by design", pErr.message);
    throw new Error("Could not load design listings");
  }
  const ids = (products ?? []).map((r) => r.id as string);
  if (ids.length === 0) return false;
  const { count, error } = await admin
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .in("product_id", ids);
  if (error) {
    console.error("[delete-guards] order_items count design", error.message);
    throw new Error("Could not verify order history");
  }
  return (count ?? 0) > 0;
}

export async function designHasDmcaReports(designId: string): Promise<boolean> {
  const admin = getServiceClient();
  const { count, error } = await admin
    .from("dmca_reports")
    .select("*", { count: "exact", head: true })
    .eq("design_id", designId);
  if (error) {
    console.error("[delete-guards] dmca_reports count", error.message);
    throw new Error("Could not verify compliance records");
  }
  return (count ?? 0) > 0;
}
