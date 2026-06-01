import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { GenerateDesignRequest } from "@/lib/types";
import { moderateText, moderateImageBase64 } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProfileForAuthUser, insertDesign } from "@/lib/supabase/queries";
import { uploadDesignImage } from "@/lib/storage";
import { detectDesignTransparency } from "@/lib/print/transparency";
import { loadReferenceImageFromUrl } from "@/lib/design/reference-image";

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

/**
 * Server-Sent Events the streaming response emits. `status` ticks the
 * client-side progress UI through the 4-step pipeline; `done` carries the
 * full design payload that pre-streaming JSON used to return; `error`
 * carries a user-facing message and ends the stream cleanly without a
 * non-200 status code (the client treats either body shape as a failure).
 */
type StreamStep = "generating" | "moderation" | "analyzing" | "saving";

function sseEncoder() {
  const encoder = new TextEncoder();
  return (event: string, data: unknown) =>
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

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

  const isRefine = Boolean(body.referenceImageUrl?.trim());
  let referenceImage: { mimeType: string; base64: string } | null = null;
  if (isRefine) {
    referenceImage = await loadReferenceImageFromUrl(body.referenceImageUrl!.trim());
    if (!referenceImage) {
      return NextResponse.json(
        { error: "Couldn't load the design to refine. Try downloading it and starting fresh." },
        { status: 400 },
      );
    }
    const refCheck = await moderateImageBase64(referenceImage.base64);
    if (!refCheck.safe) {
      return NextResponse.json(
        { error: "This design can't be refined because it didn't pass our safety check." },
        { status: 400 },
      );
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const encode = sseEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encode(event, data));
        } catch {
          // Controller already closed (e.g. client aborted) — drop the event.
        }
      };
      const fail = (message: string) => {
        send("error", { error: message });
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      const finish = () => {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      /**
       * Dev/preview fallback: when Gemini isn't configured we serve a clearly
       * labelled placeholder so the rest of the flow (preview, publish,
       * dashboard) stays exercisable end-to-end. The placeholder image and
       * the `placeholder: true` flag both make it impossible to confuse this
       * with a real AI-generated design. Emitted as `done` immediately so the
       * client's progress UI flushes through to "ready" without spinning.
       */
      if (!apiKey) {
        if (isRefine) {
          send("error", {
            error:
              "Refining designs requires AI to be configured. Set GEMINI_API_KEY in .env.local and restart the dev server.",
          });
          finish();
          return;
        }
        const label = encodeURIComponent("DEMO MODE\nGEMINI_API_KEY\nnot set");
        const imageUrl = `https://placehold.co/1024x1024/1a1a2e/ff8906?text=${label}`;
        send("done", {
          imageUrl,
          prompt: body.prompt,
          style: body.style,
          designId: null,
          hasTransparency: null,
          placeholder: true,
          placeholderReason:
            "GEMINI_API_KEY is not set in .env.local — add your Google AI Studio key and restart the dev server to enable real AI image generation.",
        });
        finish();
        return;
      }

      const tick = (step: StreamStep, label: string) =>
        send("status", { step, label });

      try {
        tick(
          "generating",
          isRefine ? "Refining your design with AI…" : "Generating your design with AI…",
        );

        const ai = new GoogleGenAI({ apiKey });
        const styleHint = STYLE_MODIFIERS[body.style] || "";
        const fullPrompt = isRefine
          ? `Modify the attached design image according to these instructions: ${body.prompt.trim()}. ` +
            `Keep the overall composition, subject, and style unless the instructions explicitly ask to change them. ` +
            `${styleHint ? `Art direction: ${styleHint}. ` : ""}` +
            `Suitable for printing on merchandise, high quality, centered composition, no text or watermarks, square 1:1 aspect ratio.`
          : `${body.prompt.trim()}, ${styleHint}, suitable for printing on merchandise, high quality, centered composition, no text or watermarks, square 1:1 aspect ratio`;

        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image-preview",
          contents: referenceImage
            ? [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType: referenceImage.mimeType,
                        data: referenceImage.base64,
                      },
                    },
                    { text: fullPrompt },
                  ],
                },
              ]
            : fullPrompt,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
          fail("No response from Gemini");
          return;
        }

        for (const part of parts) {
          if (!part.inlineData) continue;

          const mimeType = part.inlineData.mimeType || "image/png";
          const base64 = part.inlineData.data ?? "";
          const imageUrl = `data:${mimeType};base64,${base64}`;

          // Run Vision SafeSearch on the generated bytes. Fails closed when
          // the API errors so we don't leak unmoderated AI output to a
          // kid-facing UI.
          tick("moderation", "Running safety checks…");
          const imageCheck = await moderateImageBase64(base64);
          if (!imageCheck.safe) {
            console.warn("[Design Generate] Image flagged:", imageCheck.flags);
            fail(
              "The generated image was flagged by our safety check. Please try a different description.",
            );
            return;
          }

          /**
           * Alpha-channel check on the raw Gemini bytes. Gemini's image model
           * routinely returns RGB-only PNGs with a literal checker pattern
           * painted into the background pixels when the prompt implies
           * "transparent" — which then prints as a solid checkered rectangle.
           * Persisting this here means the create-flow preview can flag the
           * design BEFORE the creator publishes anything.
           */
          tick("analyzing", "Inspecting transparency…");
          const transparencyBuf = Buffer.from(base64, "base64");
          const transparency = await detectDesignTransparency(transparencyBuf);
          if (!transparency.transparent) {
            console.warn(
              `[Design Generate] PNG has no usable alpha (reason=${transparency.reason}) — design will print as a solid rectangle.`,
            );
          }

          tick("saving", "Saving to your library…");
          let designId: string | null = null;
          const promptToSave = body.savedPrompt?.trim() || body.prompt.trim();
          try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
              if (profile) {
                const { data: design } = await insertDesign(supabase, {
                  profile_id: profile.id,
                  title: promptToSave.slice(0, 80),
                  image_url: imageUrl,
                  prompt: promptToSave,
                  style: body.style,
                  // Both text and image moderation passed, so the design is
                  // safe to surface in catalogs (RLS policy
                  // `designs_public_read` requires status = 'approved').
                  status: "approved",
                  content_safe: true,
                  has_transparency: transparency.transparent,
                });
                designId = design?.id ?? null;
                if (designId) {
                  try {
                    const publicUrl = await uploadDesignImage(designId, imageUrl);
                    if (publicUrl !== imageUrl) {
                      await supabase
                        .from("designs")
                        .update({ image_url: publicUrl })
                        .eq("id", designId)
                        .then(({ error: updateErr }) => {
                          if (updateErr) {
                            console.warn("[Design Generate] image_url rewrite failed:", updateErr);
                          }
                        });
                    }
                  } catch (uploadErr) {
                    console.warn("[Design Generate] Storage upload failed:", uploadErr);
                  }
                }
              }
            }
          } catch (err) {
            console.error("[Design Generate] Save error:", err);
          }

          send("done", {
            imageUrl,
            prompt: body.prompt,
            style: body.style,
            designId,
            /**
             * Surfaced so the /create preview can render the transparency
             * badge immediately, without a round-trip to /api/designs/[id].
             */
            hasTransparency: transparency.transparent,
          });
          finish();
          return;
        }

        fail("No image in Gemini response");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (message.includes("SAFETY") || message.includes("blocked")) {
          fail(
            "Your prompt was flagged by our safety system. Please try a different description.",
          );
          return;
        }

        console.error("[Design Generate] Gemini error:", err);
        fail("Failed to generate design. Please try again.");
      }
    },
    cancel() {
      // Client disconnected (cancel button / navigation). Nothing to clean
      // up — the in-flight Gemini / Supabase work is fire-and-forget on the
      // server, but we don't want unhandled-rejection noise from the
      // controller.enqueue calls in `send()`, which is why they're wrapped.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (e.g. on Vercel / NGINX) so events flush as
      // they're written instead of arriving in one chunk at the end.
      "X-Accel-Buffering": "no",
    },
  });
}
