import type { Metadata } from "next";
import { Caveat, Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Cursor } from "@/components/fx/Cursor";
import { MotionPrefs } from "@/components/fx/MotionPrefs";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
// "Cajal's notebook": a characterful serif for headlines, a hand for margin notes.
const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"] });
const hand = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Synaptogenesis",
  description: "An agent that grows its own tools, built live by Synapse.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${hand.variable} ${jetbrains.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Before first paint: returning visitors never see (or get blocked by) the boot overlay. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('synapto-boot')==='1')document.documentElement.classList.add('booted');if(sessionStorage.getItem('synapto-launch')==='1')document.documentElement.classList.add('launching');var t=localStorage.getItem('synapto-theme');if(t)document.documentElement.setAttribute('data-app-theme',t)}catch(e){}" }} />
      </head>
      <body className="grain min-h-full">
        <Cursor />
        <MotionPrefs>{children}</MotionPrefs>
      </body>
    </html>
  );
}
