import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Multi Village · Clash Dashboard",
  description: "여러 Clash of Clans 마을의 빌더, 자원, 업그레이드와 Bark 알림을 한곳에서 관리하세요.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Multi Village",
    description: "여러 마을의 업그레이드, 빌더, 자원과 Bark 알림을 한눈에.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Multi Village 업그레이드 대시보드" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
