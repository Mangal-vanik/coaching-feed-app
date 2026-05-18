import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap"
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "ProPulse | Realtime Coaching Feed Dashboard",
  description: "Instantly stream strategies, motivation, and elite mindset updates from pro coaches in real-time.",
  applicationName: "ProPulse Coaching",
  keywords: ["Coaching", "Realtime", "Feed", "Dashboard", "Mentorship", "Strategy", "Mindset"],
  authors: [{ name: "Antigravity Team" }],
  openGraph: {
    title: "ProPulse | Realtime Coaching Feed Dashboard",
    description: "Stream premium strategies and elite mindset updates from professional coaches in real-time.",
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
