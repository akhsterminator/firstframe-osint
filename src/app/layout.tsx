import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { asset } from "@/lib/web/paths";

const geist = localFont({
  src: [
    { path: "../../assets/fonts/geist-sans-latin-400-normal.woff", weight: "400" },
    { path: "../../assets/fonts/geist-sans-latin-500-normal.woff", weight: "500" },
    { path: "../../assets/fonts/geist-sans-latin-600-normal.woff", weight: "600" },
  ],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "../../assets/fonts/geist-mono-latin-400-normal.woff", weight: "400" },
    { path: "../../assets/fonts/geist-mono-latin-500-normal.woff", weight: "500" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrument = localFont({
  src: [
    { path: "../../assets/fonts/instrument-serif-latin-400-normal.woff", weight: "400", style: "normal" },
    { path: "../../assets/fonts/instrument-serif-latin-400-italic.woff", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "FirstFrame: everyone shared it, nobody checked", template: "%s · FirstFrame" },
  description:
    "Check a viral video in a minute: when it was really posted, where it was filmed, whether the sun and the weather match, and signs of tampering.",
  openGraph: { type: "website", siteName: "FirstFrame" },
  twitter: { card: "summary_large_image" },
  icons: { icon: asset("/icon.svg") },
};

export const viewport: Viewport = { themeColor: "#0d0d0c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
