export interface ModerationResult {
  safe: boolean;
  flags: string[];
}

// Safe-search levels that we treat as "fail closed". The kid-facing nature of
// this product means anything LIKELY+ should be blocked; "POSSIBLE" still
// passes since false positives there are common.
const UNSAFE_LEVELS = new Set(["LIKELY", "VERY_LIKELY"]);

interface SafeSearchAnnotation {
  adult?: string;
  violence?: string;
  racy?: string;
  medical?: string;
  spoof?: string;
}

function flagsFromAnnotation(annotation: SafeSearchAnnotation): string[] {
  const flags: string[] = [];
  if (annotation.adult && UNSAFE_LEVELS.has(annotation.adult)) flags.push("adult");
  if (annotation.violence && UNSAFE_LEVELS.has(annotation.violence)) flags.push("violence");
  if (annotation.racy && UNSAFE_LEVELS.has(annotation.racy)) flags.push("racy");
  if (annotation.medical && UNSAFE_LEVELS.has(annotation.medical)) flags.push("medical");
  return flags;
}

async function callVision(
  imagePayload: { source: { imageUri: string } } | { content: string },
): Promise<ModerationResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  // No Vision API configured — pass through with a warning. Dev/preview only;
  // in production we expect this to be set.
  if (!apiKey) {
    console.warn("[Moderation] GOOGLE_CLOUD_VISION_API_KEY not set, skipping moderation");
    return { safe: true, flags: [] };
  }

  try {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: imagePayload,
              features: [{ type: "SAFE_SEARCH_DETECTION" }],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      console.error("[Moderation] Vision API error:", res.status, await res.text().catch(() => ""));
      // Fail closed on API errors when handling base64 (untrusted) content;
      // for public URLs, fail open (likely a transient issue).
      const failClosed = "content" in imagePayload;
      return { safe: !failClosed, flags: failClosed ? ["api_error"] : [] };
    }

    const data = (await res.json()) as {
      responses?: { safeSearchAnnotation?: SafeSearchAnnotation }[];
    };
    const annotation = data.responses?.[0]?.safeSearchAnnotation;
    if (!annotation) return { safe: true, flags: [] };

    const flags = flagsFromAnnotation(annotation);
    return { safe: flags.length === 0, flags };
  } catch (err) {
    console.error("[Moderation] Error:", err);
    return { safe: true, flags: [] };
  }
}

/** Moderate a publicly-accessible image URL. */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  return callVision({ source: { imageUri: imageUrl } });
}

/**
 * Moderate a base64-encoded image (e.g. directly from an AI generator's data
 * URL). Accepts either a `data:image/...;base64,...` URL or raw base64.
 */
export async function moderateImageBase64(input: string): Promise<ModerationResult> {
  const content = input.replace(/^data:[^;]+;base64,/, "");
  return callVision({ content });
}

export async function moderateText(text: string): Promise<ModerationResult> {
  const blockedPatterns = [
    /\b(kill|murder|suicide|drug|weapon|gun|bomb|terror)\b/i,
    /\b(nude|naked|sex|porn|xxx)\b/i,
    /\b(hate|racist|nazi)\b/i,
  ];

  const flags: string[] = [];
  for (const pattern of blockedPatterns) {
    if (pattern.test(text)) {
      flags.push(pattern.source.replace(/\\b|\(|\)/g, ""));
    }
  }

  return {
    safe: flags.length === 0,
    flags,
  };
}
