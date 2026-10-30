import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { GiftProvider } from "@/contexts/GiftContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wp-earn-money - WhatsApp-style PWA",
  description: "A WhatsApp-inspired mobile-first PWA with live streaming, wallet, and 3D design elements.",
  keywords: ["Wp-earn-money", "WhatsApp", "PWA", "Live Streaming", "Social"],
  authors: [{ name: "Wp-earn-money Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Wp-earn-money",
  },
  openGraph: {
    title: "Wp-earn-money",
    description: "WhatsApp-inspired PWA with live streaming and social features",
    type: "website",
  },
  other: {
    // HilltopAds site-ownership verification tag.
    "73f796404bab0afead7fa20af7792cc3d4bc32a0": "73f796404bab0afead7fa20af7792cc3d4bc32a0",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#111B21",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <GiftProvider>
          {children}
        </GiftProvider>
        <Toaster />
      </body>
    </html>
  );
}
