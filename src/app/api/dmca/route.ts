import { NextRequest, NextResponse } from "next/server";
import { sendDmcaAcknowledgment } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/admin";
import { insertDmcaReport } from "@/lib/supabase/queries";

export async function POST(request: NextRequest) {
  let body: {
    name: string;
    email: string;
    contentUrl: string;
    originalWorkUrl: string;
    description: string;
    attestOwner: boolean;
    attestPerjury: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.email || !body.contentUrl || !body.description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!body.attestOwner || !body.attestPerjury) {
    return NextResponse.json({ error: "Both attestations are required" }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();

    // Try to resolve the reported URL to a known design. The form gives us
    // an opaque URL, so we look for either a /product/<id> or /design/<id>
    // path. Anything we can't resolve becomes a report with design_id=null.
    const designId = extractDesignId(body.contentUrl);
    let resolvedDesignId: string | null = null;
    if (designId) {
      const { data: maybeDesign } = await supabase
        .from("designs")
        .select("id")
        .eq("id", designId)
        .maybeSingle();
      resolvedDesignId = maybeDesign?.id ?? null;

      if (!resolvedDesignId) {
        // Maybe the URL pointed to a product — fetch the linked design.
        const { data: maybeProduct } = await supabase
          .from("products")
          .select("design_id")
          .eq("id", designId)
          .maybeSingle();
        resolvedDesignId = maybeProduct?.design_id ?? null;
      }
    }

    const { error: insertErr } = await insertDmcaReport(supabase, {
      design_id: resolvedDesignId,
      reporter_email: body.email,
      reporter_name: body.name,
      // Concatenate the rest of the fields so they're searchable from the
      // single description column without a schema change.
      description: [
        body.description,
        body.contentUrl ? `Content URL: ${body.contentUrl}` : null,
        body.originalWorkUrl ? `Original work: ${body.originalWorkUrl}` : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    if (insertErr) {
      console.error("[DMCA] insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to record request" },
        { status: 500 },
      );
    }

    await sendDmcaAcknowledgment(body.email, {
      contentUrl: body.contentUrl,
      description: body.description,
    }).catch((err) => console.error("[DMCA] ack email error:", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DMCA] Error:", err);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractDesignId(url: string): string | null {
  const match = url.match(UUID_RE);
  return match ? match[0] : null;
}
