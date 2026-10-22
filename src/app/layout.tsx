import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { MotionProvider } from "@/components/motion/motion-provider";
import { PwaRegister } from "@/components/pwa";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Träning",
  description: "Personlig tränare med automatisk progression",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Träning", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090909",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body className={`${inter.variable} antialiased`}>
        <PwaRegister />
        <MotionProvider>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </MotionProvider>
      </body>
    </html>
  );
}
