import { Boot } from "@/components/Boot";
import { SmoothScroll } from "@/components/fx/Interactions";
import { ScrollSpine } from "@/components/fx/ScrollSpine";
import { AppPreview } from "@/components/landing/AppPreview";
import { Bento } from "@/components/landing/Bento";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Marquee } from "@/components/landing/Marquee";
import { Nav } from "@/components/landing/Nav";
import { FinalCTA, Proof } from "@/components/landing/Proof";

/** Marketing only ("Cajal's notebook"). The product lives at /app. */
export default function Home() {
  return (
    <main className="paper-page relative overflow-x-clip">
      <SmoothScroll />
      <Boot />
      <ScrollSpine />
      <Nav />
      <Hero />
      <Marquee />
      <AppPreview />
      <HowItWorks />
      <Bento />
      <Proof />
      <FinalCTA />
    </main>
  );
}
