import { NextRequest, NextResponse } from "next/server";
import { GenerateDesignRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  let body: GenerateDesignRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  try {
    // In production, this calls an AI image generation API (Replicate/DALL-E/Flux)
    const styleColors: Record<string, { bg: string; fg: string }> = {
      anime: { bg: "1a1a2e", fg: "e94560" },
      streetwear: { bg: "0f0e17", fg: "ff8906" },
      "pixel-art": { bg: "16213e", fg: "0f3460" },
      graffiti: { bg: "2d00f7", fg: "e500a4" },
      minimalist: { bg: "1a1a2e", fg: "c77dff" },
      vaporwave: { bg: "10002b", fg: "e0aaff" },
      comic: { bg: "001219", fg: "94d2bd" },
      realistic: { bg: "0f172a", fg: "38bdf8" },
    };

    const colors = styleColors[body.style] || styleColors.anime;
    const label = encodeURIComponent(body.prompt.slice(0, 30));
    const imageUrl = `https://placehold.co/1024x1024/${colors.bg}/${colors.fg}?text=${label}`;

    return NextResponse.json({
      imageUrl,
      prompt: body.prompt,
      style: body.style,
    });
  } catch (err) {
    console.error("[Design Generate] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate design" },
      { status: 500 },
    );
  }
}
