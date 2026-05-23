import type { ProductType } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Stylized garment outlines — contextual backdrop only (not supplier artwork). */
export function MerchGarmentSilhouette({
  type,
  className,
}: {
  type: ProductType;
  className?: string;
}) {
  const tone = "text-foreground";

  if (type === "hoodie" || type === "kids-hoodie") {
    /**
     * Flat-lay hoodie front: dome hood + sloped shoulders + horizontal sleeves
     * draping to cuffs + rectangular body + kangaroo pocket + drawstrings.
     * Path winds clockwise from left shoulder; viewBox 140×152 matches
     * `getMerchPreviewLayout` `garmentAspect` so the print band overlay aligns.
     */
    return (
      <svg
        viewBox="0 0 140 152"
        className={cn("block h-full w-full overflow-visible", tone, className)}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Single closed silhouette: hood → right shoulder → right sleeve → right body → hem → left body → left sleeve → left shoulder → back to start */}
        <path
          fill="currentColor"
          fillOpacity={0.14}
          stroke="currentColor"
          strokeWidth={2.2}
          strokeOpacity={0.92}
          strokeLinejoin="round"
          strokeLinecap="round"
          d="
            M 40 50
            C 40 28 54 14 70 14
            C 86 14 100 28 100 50
            L 128 58
            L 124 138
            L 102 142
            L 100 70
            L 102 144
            L 38 144
            L 40 70
            L 38 142
            L 16 138
            L 12 58
            Z
          "
        />

        {/* Hood opening — visible interior of the hood when the garment lies flat */}
        <ellipse
          cx={70}
          cy={36}
          rx={18}
          ry={14}
          fill="currentColor"
          fillOpacity={0.18}
          stroke="currentColor"
          strokeWidth={1.2}
          strokeOpacity={0.45}
        />

        {/* Neckline (hood-to-body seam) */}
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeOpacity={0.55}
          strokeLinecap="round"
          d="M 48 52 Q 70 60 92 52"
        />

        {/* Drawstrings + aglets */}
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeOpacity={0.55}
          strokeLinecap="round"
          d="M 62 56 L 60 82 M 78 56 L 80 82"
        />
        <circle cx={60} cy={84} r={1.6} fill="currentColor" fillOpacity={0.55} />
        <circle cx={80} cy={84} r={1.6} fill="currentColor" fillOpacity={0.55} />

        {/* Kangaroo pocket trapezoid */}
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeOpacity={0.5}
          strokeLinejoin="round"
          d="M 50 100 L 90 100 L 96 130 L 44 130 Z"
        />
        {/* Pocket hand-slit hints (subtle) */}
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeOpacity={0.35}
          strokeLinecap="round"
          d="M 50 100 L 56 114 M 90 100 L 84 114"
        />

        {/* Hem + cuff rib lines */}
        <line x1={38} y1={140} x2={102} y2={140} stroke="currentColor" strokeWidth={0.9} strokeOpacity={0.35} />
        <line x1={16} y1={134} x2={38} y2={138} stroke="currentColor" strokeWidth={0.9} strokeOpacity={0.35} />
        <line x1={102} y1={138} x2={124} y2={134} stroke="currentColor" strokeWidth={0.9} strokeOpacity={0.35} />
      </svg>
    );
  }

  if (type === "kids-long-sleeve") {
    return (
      <svg
        viewBox="0 0 120 146"
        className={cn("h-full w-full", tone, className)}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          fill="currentColor"
          fillOpacity={0.28}
          stroke="currentColor"
          strokeWidth={1.35}
          strokeOpacity={0.58}
          d="M38 28h44l12 8 16 8 8 24-16 12-20-16v78c0 8-12 14-26 14S40 144 40 136V64l-20 16-16-12 8-24 16-8 12-8z"
        />
      </svg>
    );
  }

  if (
    type === "tshirt" ||
    type === "kids-tshirt" ||
    type === "kids-heavyweight-tee" ||
    type === "kids-sports-tee"
  ) {
    return (
      <svg
        viewBox="0 0 120 138"
        className={cn("h-full w-full", tone, className)}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          fill="currentColor"
          fillOpacity={0.28}
          stroke="currentColor"
          strokeWidth={1.35}
          strokeOpacity={0.58}
          d="M42 28h36l10 8 14 6 8 22-14 10-12-8V118c0 8-8 14-18 14H52c-10 0-18-6-18-14V66l-12 8-14-10 8-22 14-6 10-8z"
        />
      </svg>
    );
  }

  if (type === "poster") {
    return (
      <svg viewBox="0 0 100 160" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <rect x="14" y="18" width="72" height="124" rx="3" ry="3" fill="currentColor" opacity={0.1} stroke="currentColor" strokeOpacity={0.22} strokeWidth={1} />
        <rect x="20" y="26" width="60" height="108" rx="1.5" fill="currentColor" opacity={0.14} />
      </svg>
    );
  }

  if (type === "pillow") {
    return (
      <svg viewBox="0 0 120 100" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <ellipse cx="58" cy="52" rx="48" ry="38" fill="currentColor" opacity={0.14} stroke="currentColor" strokeOpacity={0.24} strokeWidth={1.2} />
        <ellipse cx="64" cy="48" rx="42" ry="32" fill="currentColor" opacity={0.1} />
      </svg>
    );
  }

  if (type === "blanket") {
    return (
      <svg viewBox="0 0 160 110" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <path fill="currentColor" opacity={0.12} d="M12 76c28-42 136-62 154-62 26 72-118 146-154 146-24 0 8-114 154-154" />
        <path fill="currentColor" opacity={0.16} d="M18 82c22-48 138-74 154-74 38 108-154 174-174 174-42 4-52-174 154-228" />
        <path fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} d="M24 94c48-56 154-104 218-138" strokeLinecap="round" transform="scale(.66) translate(26 54)" />
      </svg>
    );
  }

  if (type === "pet-sweater") {
    return (
      <svg viewBox="0 0 130 100" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <ellipse cx="64" cy="78" rx="38" ry="18" fill="currentColor" opacity={0.1} />
        <ellipse cx="64" cy="56" rx="42" ry="38" fill="currentColor" opacity={0.15} />
        <circle cx="64" cy="34" r="18" fill="currentColor" opacity={0.16} />
        <path
          fill="currentColor"
          opacity={0.2}
          d="M38 48h52c4 0 8 4 8 10v18c0 8-6 14-14 14H44c-8 0-14-6-14-14V58c0-6 4-10 8-10z"
        />
        <path fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={1} d="M46 72h34" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "tote-bag") {
    return (
      <svg viewBox="0 0 110 132" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <path
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={2.2}
          strokeLinecap="round"
          d="M32 52c0-22 18-36 40-36s40 14 40 36"
        />
        <path
          d="M30 58h50l4 8h36v70c0 10-8 18-22 18H48c-14 0-22-8-22-18V66c0-5 4-8 9-8h-5z"
          fill="currentColor"
          opacity={0.14}
        />
      </svg>
    );
  }

  if (type === "sticker") {
    return (
      <svg viewBox="0 0 100 100" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <rect x="18" y="18" width="64" height="64" rx="12" ry="12" fill="currentColor" opacity={0.15} stroke="currentColor" strokeOpacity={0.26} strokeWidth={1.2} />
        <path fill="currentColor" opacity={0.1} d="M66 74l16-26 8 10z" />
      </svg>
    );
  }

  if (type === "phone-case") {
    return (
      <svg viewBox="0 0 72 144" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <rect x="16" y="12" width="40" height="120" rx="8" ry="8" fill="currentColor" opacity={0.12} stroke="currentColor" strokeOpacity={0.24} strokeWidth={1.4} />
        <rect x="22" y="22" width="28" height="96" rx="3" ry="3" fill="currentColor" opacity={0.16} />
        <circle cx="36" cy="128" r="4" fill="currentColor" opacity={0.2} />
      </svg>
    );
  }

  if (type === "ornament") {
    return (
      <svg viewBox="0 0 100 120" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <path fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={2} d="M50 14v14" strokeLinecap="round" />
        <circle cx="46" cy="10" r="4" fill="currentColor" opacity={0.2} />
        <circle cx="50" cy="68" r="44" fill="currentColor" opacity={0.12} stroke="currentColor" strokeOpacity={0.28} strokeWidth={1.4} />
        <ellipse cx="50" cy="68" rx="36" ry="36" fill="currentColor" opacity={0.14} />
      </svg>
    );
  }

  if (type === "puzzle") {
    return (
      <svg viewBox="0 0 110 140" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <rect x="16" y="18" width="78" height="104" rx="4" ry="4" fill="currentColor" opacity={0.14} stroke="currentColor" strokeOpacity={0.22} strokeWidth={1.2} />
        <path
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1.4}
          d="M48 18v16c-6 10 6 18 10 10v78M74 74c8-6 20 4 28 14v54"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "embroidered-patch") {
    return (
      <svg viewBox="0 0 100 100" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <polygon
          points="50,14 82,34 74,74 26,74 18,34"
          fill="currentColor"
          opacity={0.14}
          stroke="currentColor"
          strokeOpacity={0.32}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        <circle cx="50" cy="52" r="22" fill="currentColor" opacity={0.1} stroke="currentColor" strokeOpacity={0.22} strokeWidth={1} />
      </svg>
    );
  }

  if (type === "hardcover-journal") {
    return (
      <svg viewBox="0 0 170 96" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
        <path fill="currentColor" opacity={0.22} d="M22 20h26v62H22z" />
        <rect x="36" y="14" width="120" height="72" rx="2" ry="2" fill="currentColor" opacity={0.12} stroke="currentColor" strokeOpacity={0.28} strokeWidth={1} />
        <rect x="44" y="22" width="106" height="56" rx="1" ry="1" fill="currentColor" opacity={0.15} />
        <path fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} d="M64 54h74" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "joggers") {
    return (
      <svg
        viewBox="0 0 140 130"
        className={cn("h-full w-full", tone, className)}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Waist + two legs — faint strip on viewer-left leg matches leg_left DTG */}
        <path fill="currentColor" opacity={0.13} d="M46 22h48l6 22H40l6-22z" />
        <rect x="34" y="46" width="30" height="72" rx="11" ry="11" fill="currentColor" opacity={0.14} />
        <rect x="76" y="46" width="30" height="72" rx="11" ry="11" fill="currentColor" opacity={0.14} />
        <rect x="32" y="50" width="14" height="58" rx="5" ry="5" fill="currentColor" opacity={0.09} />
      </svg>
    );
  }

  if (type === "mug") {
    return (
      <svg
        viewBox="0 0 140 110"
        className={cn("h-full w-full", tone, className)}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          fill="currentColor"
          opacity={0.16}
          d="M26 34h62v54c0 10-10 18-22 18H42c-12 0-22-8-22-18V42c0-5 5-8 11-8h52"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          opacity={0.22}
          d="M88 38h24c12 0 20 10 20 22s-8 22-20 22H88"
        />
      </svg>
    );
  }

  if (type === "backpack") {
    return (
      <svg
        viewBox="0 0 110 130"
        className={cn("h-full w-full", tone, className)}
        aria-hidden
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          fill="currentColor"
          opacity={0.15}
          d="M34 38h42l8 10h16v74c0 8-8 14-18 14H44c-10 0-18-6-18-14V48c0-6 6-10 14-10h10v48z"
        />
        <path fill="currentColor" opacity={0.12} d="M46 28h28v14H46z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 100" className={cn("h-full w-full", tone, className)} aria-hidden preserveAspectRatio="xMidYMid meet">
      <rect
        x="14"
        y="14"
        width="72"
        height="72"
        rx="8"
        fill="currentColor"
        opacity={0.12}
        stroke="currentColor"
        strokeOpacity={0.26}
        strokeWidth={1.2}
      />
    </svg>
  );
}
