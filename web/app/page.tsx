import { Boot } from "@/components/Boot";
import { SmoothScroll } from "@/components/fx/Interactions";
import { AppPreview } from "@/components/landing/AppPreview";
import { Bento } from "@/components/landing/Bento";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Nav } from "@/components/landing/Nav";
import { FinalCTA, Proof } from "@/components/landing/Proof";

/** Marketing only. The product lives at /app. */
export default function Home() {
  return (
    <main className="relative">
      <SmoothScroll />
      <Boot />
      <Nav />
      <Hero />
      <AppPreview />
      <HowItWorks />
      <Bento />
      <Proof />
      <FinalCTA />
    </main>
  );
}
