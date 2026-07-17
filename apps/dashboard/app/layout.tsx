import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import QueryProvider from "./query-provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: messages.Meta.title,
    description: messages.Meta.description,
    manifest: "/manifest.webmanifest",
    applicationName: "Multi Village",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Multi Village" },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/apple-touch-icon.png" },
    openGraph: {
      title: "Multi Village",
      description: messages.Meta.openGraphDescription,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: messages.Meta.imageAlt }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#27333b" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>{children}</QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
