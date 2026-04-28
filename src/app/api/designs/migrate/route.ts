import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProfileForAuthUser, insertDesign } from "@/lib/supabase/queries";

interface MigrateDesign {
  prompt: string;
  style: string;
  imageUrl: string;
  createdAt?: string;
}

const MAX_BATCH = 10;

export async function POST(request: NextRequest) {
  let body: { designs: MigrateDesign[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(body.designs) || body.designs.length === 0) {
    return NextResponse.json({ error: "No designs to migrate" }, { status: 400 });
  }

  const designs = body.designs.slice(0, MAX_BATCH);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No creator profile found" }, { status: 400 });
  }

  const inserted: { id: string; createdAt?: string }[] = [];

  for (const d of designs) {
    if (!d.imageUrl || typeof d.imageUrl !== "string") continue;

    const { data, error } = await insertDesign(supabase, {
      profile_id: profile.id,
      title: (d.prompt || "Untitled").slice(0, 80),
      image_url: d.imageUrl,
      prompt: d.prompt ?? null,
      style: d.style || "anime",
    });

    if (error) {
      console.error("[Migrate] insert error:", error);
      continue;
    }
    if (data?.id) inserted.push({ id: data.id, createdAt: d.createdAt });
  }

  return NextResponse.json({ migrated: inserted.length, designs: inserted });
}
