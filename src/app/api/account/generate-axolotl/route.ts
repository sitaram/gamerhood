import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  updateProfileById,
} from "@/lib/supabase/queries";
import {
  uploadProfileAvatar,
  uploadStorefrontProfileAvatar,
} from "@/lib/storage";
import { moderateImageBase64, moderateText } from "@/lib/moderation";

/**
 * POST /api/account/generate-axolotl
 *
 * Generates a custom chibi-axolotl avatar via Gemini, anchored on the
 * curated style reference at `public/brand/axolotl-style-reference.png`.
 *
 * Request body:
 *   {
 *     wearing: string,    // up to 80 chars, e.g. "a yellow raincoat"
 *     activity: string,   // up to 80 chars, e.g. "playing soccer"
 *     slot?: "personal" | "storefront"  // defaults to "personal"
 *   }
 *
 * Response:
 *   200 → { avatarUrl: string, slot: "personal" | "storefront" }
 *   400 → { error: string }                    (validation / moderation rejected)
 *   401 → { error: string }                    (not signed in)
 *   429 → { error: string }                    (rate-limited)
 *   503 → { error: string, placeholder: true } (GEMINI_API_KEY missing)
 *
 * Side effects on success:
 *   - Uploads the generated PNG to Supabase Storage via the existing
 *     `uploadProfileAvatar` / `uploadStorefrontProfileAvatar` helpers
 *     (overwrites the per-profile path, just like a regular upload).
 *   - Sets `profiles.avatar_url` (personal) or `profiles.storefront_avatar_url`
 *     (storefront) to the new public URL with a `?v={timestamp}` cache-buster
 *     so the browser refetches even though the storage key is reused.
 *   - Personal slot also syncs `auth.user.user_metadata.avatar_url` so the
 *     navbar avatar updates without a re-login (mirrors PATCH /api/account/profile).
 */

export const dynamic = "force-dynamic";
// Image generation typically takes 5–20s; allow up to 60s before Vercel
// times out (default for serverless functions on Hobby is much lower).
export const maxDuration = 60;

const MAX_FIELD_LEN = 80;

// Per-user min interval between AI generations. In-memory map → best-effort
// across Vercel lambdas; combined with the client-side 15s debounce in
// profile-settings-form.tsx this is enough to keep accidental spam from
// running up the Gemini bill. Tracked separately rather than persisted
// because the DB column would be over-engineered for this guardrail.
const MIN_GENERATION_INTERVAL_MS = 15_000;
const lastGenerationByUser = new Map<string, number>();

const REFERENCE_IMAGE_PATH = path.join(
  process.cwd(),
  "public/brand/axolotl-style-reference.png",
);

let cachedReferenceImage: { mimeType: string; base64: string } | null = null;

async function loadReferenceImage(): Promise<{ mimeType: string; base64: string }> {
  if (cachedReferenceImage) return cachedReferenceImage;
  const bytes = await fs.readFile(REFERENCE_IMAGE_PATH);
  cachedReferenceImage = { mimeType: "image/png", base64: bytes.toString("base64") };
  return cachedReferenceImage;
}

function parseField(
  raw: unknown,
  label: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: `${label} is required.` };
  const v = raw.trim();
  if (!v) return { ok: false, error: `${label} can't be empty.` };
  if (v.length > MAX_FIELD_LEN) {
    return { ok: false, error: `${label} must be ${MAX_FIELD_LEN} characters or fewer.` };
  }
  return { ok: true, value: v };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to design an axolotl." },
      { status: 401 },
    );
  }

  let body: { wearing?: unknown; activity?: unknown; slot?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const wearing = parseField(body.wearing, "What it's wearing");
  if (!wearing.ok) return NextResponse.json({ error: wearing.error }, { status: 400 });
  const activity = parseField(body.activity, "What it's doing");
  if (!activity.ok) return NextResponse.json({ error: activity.error }, { status: 400 });

  const slot: "personal" | "storefront" =
    body.slot === "storefront" ? "storefront" : "personal";

  const last = lastGenerationByUser.get(user.id) ?? 0;
  const sinceLast = Date.now() - last;
  if (sinceLast < MIN_GENERATION_INTERVAL_MS) {
    const wait = Math.ceil((MIN_GENERATION_INTERVAL_MS - sinceLast) / 1000);
    return NextResponse.json(
      { error: `Hold on a sec — try again in about ${wait}s.` },
      { status: 429 },
    );
  }

  const [wearingCheck, activityCheck] = await Promise.all([
    moderateText(wearing.value),
    moderateText(activity.value),
  ]);
  if (!wearingCheck.safe || !activityCheck.safe) {
    return NextResponse.json(
      {
        error:
          "Hmm, let's try a different idea. Try something like \u201ca knight's helmet\u201d or \u201ca chef's hat\u201d.",
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        placeholder: true,
        error:
          "AI generation isn't configured yet \u2014 add GEMINI_API_KEY on the deployment to enable Design Your Own.",
      },
      { status: 503 },
    );
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No creator profile" }, { status: 400 });
  }

  let referenceImage: { mimeType: string; base64: string };
  try {
    referenceImage = await loadReferenceImage();
  } catch (err) {
    console.error("[Generate Axolotl] Could not read reference image:", err);
    return NextResponse.json(
      { error: "AI generation is misconfigured. Please try again later." },
      { status: 500 },
    );
  }

  const promptText =
    `Generate a single cute chibi pink axolotl character in EXACTLY the same illustration ` +
    `style as the reference image: feathered pink gills on the sides of the head, large ` +
    `expressive cartoon eyes, soft cel shading, clean dark outlines, sticker-like cartoon ` +
    `design. The axolotl is wearing ${wearing.value} and is ${activity.value}. The character ` +
    `is centered on a solid black background. Single character only, no text, no watermarks, ` +
    `no extra unrelated objects, kid-safe and friendly. Output a square 1:1 PNG.`;

  let generatedDataUrl: string | null = null;
  let generatedBase64 = "";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: referenceImage.mimeType,
                data: referenceImage.base64,
              },
            },
            { text: promptText },
          ],
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No response from Gemini");

    for (const part of parts) {
      if (!part.inlineData) continue;
      const mimeType = part.inlineData.mimeType || "image/png";
      generatedBase64 = part.inlineData.data ?? "";
      generatedDataUrl = `data:${mimeType};base64,${generatedBase64}`;
      break;
    }

    if (!generatedDataUrl) throw new Error("No image in Gemini response");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("SAFETY") || message.includes("blocked")) {
      return NextResponse.json(
        {
          error:
            "Hmm, that idea got flagged. Try something like \u201ca knight's helmet\u201d or \u201criding a unicycle\u201d.",
        },
        { status: 400 },
      );
    }
    console.error("[Generate Axolotl] Gemini error:", err);
    return NextResponse.json(
      { error: "Couldn't draw your axolotl right now. Please try again." },
      { status: 500 },
    );
  }

  const safetyCheck = await moderateImageBase64(generatedBase64);
  if (!safetyCheck.safe) {
    console.warn("[Generate Axolotl] Image flagged:", safetyCheck.flags);
    return NextResponse.json(
      {
        error:
          "Hmm, the picture didn't pass our kid-safe check. Try a different idea.",
      },
      { status: 400 },
    );
  }

  let publicUrl: string;
  try {
    publicUrl =
      slot === "storefront"
        ? await uploadStorefrontProfileAvatar(profile.id, generatedDataUrl!)
        : await uploadProfileAvatar(profile.id, generatedDataUrl!);
  } catch (err) {
    console.error("[Generate Axolotl] Storage upload failed:", err);
    return NextResponse.json(
      { error: "We made the axolotl but couldn't save it. Try again." },
      { status: 500 },
    );
  }

  // Append a cache-buster so the browser refetches — the storage path is
  // reused (`profile-avatars/${profileId}.png`) so the bare public URL
  // would otherwise stay byte-identical across regenerations.
  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

  const profilePatch: Parameters<typeof updateProfileById>[2] = {};
  const authPatch: Record<string, string | null> = {};
  if (slot === "storefront") {
    profilePatch.storefront_avatar_url = cacheBustedUrl;
  } else {
    profilePatch.avatar_url = cacheBustedUrl;
    authPatch.avatar_url = cacheBustedUrl;
  }

  const { error: profileError } = await updateProfileById(
    supabase,
    profile.id,
    profilePatch,
  );
  if (profileError) {
    console.error("[Generate Axolotl] profile update error:", profileError);
    return NextResponse.json(
      { error: "Couldn't save your new axolotl. Try again." },
      { status: 500 },
    );
  }

  if (Object.keys(authPatch).length > 0) {
    const { error: authError } = await supabase.auth.updateUser({ data: authPatch });
    if (authError) {
      // Non-fatal: the profiles row is the source of truth on every surface.
      // The auth metadata sync just keeps the navbar fresh without a re-login.
      console.warn("[Generate Axolotl] auth metadata sync failed:", authError);
    }
  }

  lastGenerationByUser.set(user.id, Date.now());

  return NextResponse.json({
    avatarUrl: cacheBustedUrl,
    slot,
  });
}
