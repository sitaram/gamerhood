import Image from "next/image";
import { cn } from "@/lib/utils";

/** PNG lockups — SVG versions use `<text>` which often fails when loaded via `<img>` (embedded previews, some browsers). */
const WORDMARK = "/brand/logo-wordmark.png";
/** Horizontal lockup for the sticky header (`public/brand/logo-nav-v2.png` — versioned to dodge Next image-optimizer cache). */
const NAV_LOGO = "/brand/logo-nav-v2.png";
/** Large above-the-fold lockup on Home hero (`public/brand/logo-hero.png`). */
const HERO_LOGO = "/brand/logo-hero.png";
/** Illustrated hero scene with the `GamerHood.GG` wordmark baked into the artwork. */
const HERO_SCENE = "/brand/home-hero-scene-v2.jpg";
/** Square mark — SVG is path-only (no `<text>`); renders reliably as `img`. */
const MARK = "/brand/logo-mark.svg";

/** Intrinsic pixels — match the file's actual width/height when swapping artwork. */
const NAV_LOGO_W = 883;
const NAV_LOGO_H = 268;

/** Wide horizontal lockup for the home hero (~3.3:1). Keep replacement art near this ratio (roughly 3:1–3.5:1). */
const HERO_LOGO_W = 882;
const HERO_LOGO_H = 268;

/** Hero scene illustration intrinsic dimensions (source asset — wordmark is baked into the artwork). */
const HERO_SCENE_W = 1024;
const HERO_SCENE_H = 434;

type Props = { className?: string; priority?: boolean };

/** Full branding for hero/footer. */
export function BrandWordmark({ className, priority }: Props) {
  return (
    <img
      src={WORDMARK}
      alt="Gamerhood.GG"
      width={1024}
      height={571}
      sizes="(max-width: 640px) 92vw, (max-width: 1024px) 480px, 560px"
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "h-[3rem] w-auto shrink-0 object-contain object-left sm:h-[3.5rem] md:h-16 lg:h-[4.25rem]",
        className,
      )}
    />
  );
}

/**
 * Navbar logo — horizontal lockup (~3.3:1). Height is capped for a normal sticky header; width follows aspect.
 */
export function BrandNavLogo({ className, priority }: Props) {
  return (
    <img
      src={NAV_LOGO}
      alt="Gamerhood.GG"
      width={NAV_LOGO_W}
      height={NAV_LOGO_H}
      sizes="(max-width: 640px) 200px, (max-width: 1024px) 240px, 280px"
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn(
        "h-9 w-auto shrink-0 object-contain object-left sm:h-10 md:h-11 lg:h-12",
        "max-w-[min(72vw,17.5rem)] sm:max-w-[min(55vw,20rem)] md:max-w-none",
        className,
      )}
    />
  );
}

/** Home hero masthead — full content width up to container. */
export function BrandHeroLogo({ className, priority }: Props) {
  return (
    <img
      src={HERO_LOGO}
      alt="Gamerhood.GG"
      width={HERO_LOGO_W}
      height={HERO_LOGO_H}
      sizes="(max-width: 768px) 100vw, (max-width: 1400px) 95vw, 1280px"
      decoding="sync"
      fetchPriority={priority ?? true ? "high" : "auto"}
      className={cn(
        "mx-auto h-auto w-full max-w-none min-w-0 object-contain object-center",
        className,
      )}
    />
  );
}

/**
 * Cinematic home hero scene. The `GamerHood.GG` wordmark is part of the artwork itself
 * (no separate overlay needed — the source PNG already includes the typography).
 */
export function BrandHeroScene({ className, priority }: Props) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-2xl shadow-[0_20px_60px_-20px_rgba(255,140,80,0.25)]",
        className,
      )}
      style={{ aspectRatio: `${HERO_SCENE_W} / ${HERO_SCENE_H}` }}
    >
      <Image
        src={HERO_SCENE}
        alt="GamerHood.GG — friendly axolotl mascots gaming on a castle in the clouds"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 95vw, 1280px"
        priority={priority}
        fetchPriority={priority ? "high" : "auto"}
        className="object-cover object-center"
      />
    </div>
  );
}

export function BrandMark({ className, priority }: Props) {
  return (
    <img
      src={MARK}
      alt="Gamerhood"
      width={144}
      height={144}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      className={cn("h-9 w-9 object-contain sm:h-10 sm:w-10", className)}
    />
  );
}
