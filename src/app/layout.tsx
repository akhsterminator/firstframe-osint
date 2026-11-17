import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

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

const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: "FirstFrame: verify any viral video in 60 seconds", template: "%s · FirstFrame" },
  description:
    "Paste a TikTok, X or Instagram link. FirstFrame finds the earliest copy online, works out where and when it was filmed, checks the weather, and looks for signs of tampering.",
  openGraph: { type: "website", siteName: "FirstFrame", images: ["/api/reports/sample/card?format=og"] },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0d0d0c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
