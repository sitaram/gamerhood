import Image from "next/image";
import type { ProfileRow } from "@/lib/supabase/queries";

type ProfilePublic = Pick<
  ProfileRow,
  | "display_name"
  | "avatar_url"
  | "bio"
  | "storefront_hero_image_url"
  | "storefront_headline"
  | "storefront_subhead"
  | "storefront_hero_overlay"
>;

export function CreatorStorefrontHero({ profile }: { profile: ProfilePublic }) {
  const heroUrl = profile.storefront_hero_image_url;
  const overlay = profile.storefront_hero_overlay ?? "dark";
  const headline = profile.storefront_headline?.trim() || profile.display_name;
  const sub = profile.storefront_subhead?.trim() || profile.bio?.trim();

  const overlayClass =
    overlay === "none"
      ? ""
      : overlay === "light"
        ? "bg-white/75"
        : overlay === "gradient"
          ? "bg-gradient-to-t from-background via-background/70 to-transparent"
          : "bg-black/55";

  if (!heroUrl) {
    return null;
  }

  return (
    <div className="relative -mx-4 mb-10 overflow-hidden rounded-2xl border border-border/50 sm:-mx-0">
      <div className="relative h-[min(52vh,420px)] w-full md:h-[min(48vh,520px)]">
        <Image
          src={heroUrl}
          alt=""
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className={`absolute inset-0 ${overlayClass}`} aria-hidden />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="max-w-2xl">
            <h1
              className={`text-3xl font-bold tracking-tight text-balance drop-shadow-md sm:text-4xl md:text-5xl ${
                overlay === "light" ? "text-foreground" : "text-white"
              }`}
            >
              {headline}
            </h1>
            {sub && (
              <p
                className={`mt-3 max-w-xl text-pretty text-lg drop-shadow ${
                  overlay === "light" ? "text-muted-foreground" : "text-white/90"
                }`}
              >
                {sub}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
