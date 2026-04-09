export interface ModerationResult {
  safe: boolean;
  flags: string[];
}

export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    // No Vision API configured — pass through (log a warning in dev)
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
              image: { source: { imageUri: imageUrl } },
              features: [{ type: "SAFE_SEARCH_DETECTION" }],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      console.error("[Moderation] Vision API error:", res.status);
      return { safe: true, flags: [] };
    }

    const data = await res.json();
    const annotation = data.responses?.[0]?.safeSearchAnnotation;

    if (!annotation) {
      return { safe: true, flags: [] };
    }

    const UNSAFE_LEVELS = ["LIKELY", "VERY_LIKELY"];
    const flags: string[] = [];

    if (UNSAFE_LEVELS.includes(annotation.adult)) flags.push("adult");
    if (UNSAFE_LEVELS.includes(annotation.violence)) flags.push("violence");
    if (UNSAFE_LEVELS.includes(annotation.racy)) flags.push("racy");
    if (UNSAFE_LEVELS.includes(annotation.medical)) flags.push("medical");

    return {
      safe: flags.length === 0,
      flags,
    };
  } catch (err) {
    console.error("[Moderation] Error:", err);
    return { safe: true, flags: [] };
  }
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
