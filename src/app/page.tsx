import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturedProducts } from "@/components/landing/featured-products";
import { CreatorSpotlight } from "@/components/landing/creator-spotlight";
import { CTA } from "@/components/landing/cta";

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <HowItWorks />
      <CreatorSpotlight />
      <CTA />
    </>
  );
}
