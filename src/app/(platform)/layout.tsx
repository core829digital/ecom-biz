import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "../globals.css";
import { getPlatformLocale } from "@/lib/i18n/server";
import { getAppearance } from "@/lib/appearance-server";
import { htmlAppearanceAttrs } from "@/lib/appearance";
import { Toaster } from "@/components/ui/toast";

export async function generateMetadata(): Promise<Metadata> {
  const name = process.env.PLATFORM_NAME || "Commerce";
  return { title: { default: name, template: `%s · ${name}` }, applicationName: name };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default async function PlatformRootLayout({ children }: { children: React.ReactNode }) {
  const [locale, { theme, accent }] = await Promise.all([getPlatformLocale(), getAppearance()]);
  return (
    <html lang={locale} {...htmlAppearanceAttrs(theme, accent)} suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
