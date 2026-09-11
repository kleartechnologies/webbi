import type { Metadata } from "next";
import { StartView } from "./StartView";

export const metadata: Metadata = { title: "What do you do?" };

export default function StartPage() {
  return <StartView />;
}
