import type { Metadata } from "next";
import { Console } from "@/components/console/Console";

export const metadata: Metadata = { title: "App · Synaptogenesis" };

export default function AppPage() {
  return <Console />;
}
