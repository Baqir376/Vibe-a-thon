import { Boot } from "@/components/Boot";
import { Bento } from "@/components/landing/Bento";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Nav } from "@/components/landing/Nav";
import { FinalCTA, Proof } from "@/components/landing/Proof";

export default function Home() {
  return (
    <main className="relative">
      <Boot />
      <Nav />
      <Hero />
      <HowItWorks />
      <Bento />
      <Proof />
      <FinalCTA />
    </main>
  );
}
