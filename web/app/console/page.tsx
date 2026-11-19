import type { Metadata } from "next";
import { Console } from "@/components/console/Console";

export const metadata: Metadata = { title: "Live console · Synaptogenesis" };

export default function ConsolePage() {
  return <Console />;
}
