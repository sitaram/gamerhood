import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GenerateDesignRequest } from "@/lib/types";
import { moderateText } from "@/lib/moderation";

const STYLE_MODIFIERS: Record<string, string> = {
  anime: "anime art style, cel shaded, vibrant colors, manga inspired",
  streetwear: "urban streetwear graphic design, bold typography, edgy",
  "pixel-art": "pixel art, 16-bit retro game style, crisp pixels",
  graffiti: "graffiti street art style, spray paint, dripping paint, bold",
  minimalist: "clean minimalist design, simple lines, modern, flat",
  vaporwave: "vaporwave aesthetic, pastel neons, retro 80s, glitch art",
  comic: "comic book style, halftone dots, bold outlines, pop art",
  realistic: "photorealistic digital art, highly detailed, dramatic lighting",
};

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

  const textCheck = await moderateText(body.prompt);
  if (!textCheck.safe) {
    return NextResponse.json(
      { error: "Your prompt contains content that isn't allowed. Please try a different description." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
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

    return NextResponse.json({ imageUrl, prompt: body.prompt, style: body.style });
  }

  try {
    const openai = new OpenAI({ apiKey });
    const styleHint = STYLE_MODIFIERS[body.style] || "";
    const fullPrompt = `${body.prompt.trim()}, ${styleHint}, suitable for printing on merchandise, high quality, centered composition, no text or watermarks`;

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    const imageData = response.data?.[0];
    if (!imageData) {
      throw new Error("No image returned from OpenAI");
    }

    let imageUrl: string;

    if (imageData.url) {
      imageUrl = imageData.url;
    } else if (imageData.b64_json) {
      imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error("No image URL or base64 in response");
    }

    return NextResponse.json({
      imageUrl,
      prompt: body.prompt,
      style: body.style,
    });
  } catch (err) {
    if (err instanceof OpenAI.APIError && err.status === 400) {
      return NextResponse.json(
        { error: "Your prompt was rejected by our safety system. Please try a different description." },
        { status: 400 },
      );
    }

    console.error("[Design Generate] OpenAI error:", err);
    return NextResponse.json(
      { error: "Failed to generate design. Please try again." },
      { status: 500 },
    );
  }
}
