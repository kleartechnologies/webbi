import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { publicEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "Webbi – Websites for Malaysian small businesses",
    template: "%s · Webbi",
  },
  description:
    "Tell us what you do. We'll build your website. Professional websites for Malaysian businesses, creators and salespeople. Free to preview, RM149.90 to publish.",
  applicationName: "Webbi",
};

export const viewport: Viewport = {
  themeColor: "#F6F5F1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontVariables} h-full`}>
      <body className="min-h-full flex flex-col bg-ground text-ink font-ui">
        {children}
      </body>
    </html>
  );
}
