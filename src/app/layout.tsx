import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PortalAnalyticsTracker from "@/components/PortalAnalyticsTracker";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";
import { hostedGuestPreview } from "@/lib/guest-events/preview-mode";
import PreviewBanner from "@/components/events/PreviewBanner";
import { connection } from "next/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IPN Member Portal",
  description:
    "Community discovery, events, and resources for the Intercollegiate Psychedelics Network.",
  icons: {
    icon: "/purple_icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The sandbox is browser-specific; never prerender live portal children at build time.
  if (hostedGuestPreview()) await connection();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        {!hostedGuestPreview() && <PortalAnalyticsTracker />}
        {hostedGuestPreview() && <PreviewBanner />}
        {children}
      </body>
    </html>
  );
}
