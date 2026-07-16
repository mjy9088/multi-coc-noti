import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import "./globals.css";
import { localeCookie, normalizeLocale } from "./i18n-config";
import { loadMessages } from "./load-messages";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get(localeCookie)?.value);
  const messages = await loadMessages(locale);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: messages.Meta.title,
    description: messages.Meta.description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Multi Village",
      description: messages.Meta.openGraphDescription,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: messages.Meta.imageAlt }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = normalizeLocale((await cookies()).get(localeCookie)?.value);
  const messages = await loadMessages(locale);
  return <html lang={locale}><body className={`${geistSans.variable} ${geistMono.variable}`}><NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Seoul">{children}</NextIntlClientProvider></body></html>;
}
