import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Cursor } from "@/components/fx/Cursor";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// SF Pro is not licensed for non-Apple sites; Inter Tight is the closest legal match for the display face.
const display = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Synaptogenesis",
  description: "An agent that grows its own tools, built live by Synapse.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="grain min-h-full">
        <Cursor />
        {children}
      </body>
    </html>
  );
}
