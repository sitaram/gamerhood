import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listBrowseCategories } from "@/lib/supabase/queries";
import { isAdminEmail } from "@/lib/auth/admin";
import { AdminBrowseCategoriesPanel } from "@/components/dashboard/admin-browse-categories-panel";

export const dynamic = "force-dynamic";

export default async function AdminBrowseCategoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  const rows = await listBrowseCategories(supabase);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-primary">Platform admin</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Tag merch categories</h1>
      <p className="mt-2 text-muted-foreground">
        Create browse landings for game and topic tags. Each slug powers SEO pages like{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">/fortnite/hoodies</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">/geometry-dash/merch</code>. Creators should use the same
        slug as their listing <strong>category</strong> or <strong>tag</strong>.
      </p>

      <div className="mt-10">
        <AdminBrowseCategoriesPanel initial={rows} />
      </div>
    </div>
  );
}
