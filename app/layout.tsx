import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { SWRProvider } from "@/lib/swr-config";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PerformancePatch } from "@/components/PerformancePatch";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SplitEasy - Zero-Friction Expense Splitter",
  description: "Stop fighting over bills. Start splitting easier.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SplitEasy",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export const viewport = {
  themeColor: "#10B981",
};

// Next.js automatically calls this for web vitals:
export { reportWebVitals } from "@/lib/web-vitals";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PerformancePatch />
        <ServiceWorkerRegister />
        <SWRProvider>
          {children}
        </SWRProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}