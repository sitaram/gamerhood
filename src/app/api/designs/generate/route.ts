import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
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

  const apiKey = process.env.GEMINI_API_KEY;

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
    const ai = new GoogleGenAI({ apiKey });
    const styleHint = STYLE_MODIFIERS[body.style] || "";
    const fullPrompt = `${body.prompt.trim()}, ${styleHint}, suitable for printing on merchandise, high quality, centered composition, no text or watermarks, square 1:1 aspect ratio`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: fullPrompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error("No response from Gemini");
    }

    for (const part of parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || "image/png";
        const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;

        return NextResponse.json({
          imageUrl,
          prompt: body.prompt,
          style: body.style,
        });
      }
    }

    throw new Error("No image in Gemini response");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("SAFETY") || message.includes("blocked")) {
      return NextResponse.json(
        { error: "Your prompt was flagged by our safety system. Please try a different description." },
        { status: 400 },
      );
    }

    console.error("[Design Generate] Gemini error:", err);
    return NextResponse.json(
      { error: "Failed to generate design. Please try again." },
      { status: 500 },
    );
  }
}
