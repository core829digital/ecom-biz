import type { Metadata } from "next";
import "../globals.css";
import { getPlatformLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const name = process.env.PLATFORM_NAME || "Commerce";
  return { title: { default: name, template: `%s · ${name}` }, robots: { index: false } };
}

export default async function PlatformRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getPlatformLocale();
  return (
    <html lang={locale}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
