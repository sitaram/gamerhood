import { NextRequest, NextResponse } from "next/server";
import { sendDmcaAcknowledgment } from "@/lib/email";

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
    // In production: save to Supabase dmca_reports table
    console.log("[DMCA] Takedown request received:", {
      from: body.email,
      contentUrl: body.contentUrl,
      originalWorkUrl: body.originalWorkUrl,
    });

    await sendDmcaAcknowledgment(body.email, {
      contentUrl: body.contentUrl,
      description: body.description,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DMCA] Error:", err);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
