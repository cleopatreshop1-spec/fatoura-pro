import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { GlobalShortcuts } from "@/components/shared/GlobalShortcuts";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Fatoura Pro", template: "%s — Fatoura Pro" },
  description: "Gestion de facturation électronique conforme TTN/ElFatoora pour les entreprises tunisiennes.",
  applicationName: "Fatoura Pro",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a0b0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0f1118',
              border: '1px solid #1a1b22',
              color: '#e5e7eb',
              fontSize: '13px',
              borderRadius: '12px',
            },
          }}
          richColors
        />
        <GlobalShortcuts />
        <Analytics />
      </body>
    </html>
  );
}
