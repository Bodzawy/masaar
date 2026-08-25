import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import { brand } from "@/config/brand";
import { getLocale, dirFor } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description:
    "Structured CEFR-aligned German learning with live one-to-one lessons, certified teachers, and verifiable progress from A1 to C2.",
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#4338CA'/><path d='M10 22V10h6.2c3 0 5 2.3 5 6s-2 6-5 6H10zm3.1-2.6h2.9c1.5 0 2.4-1.2 2.4-3.4s-.9-3.4-2.4-3.4h-2.9v6.8z' fill='#F59E0B'/></svg>`
          ),
        type: "image/svg+xml",
      },
    ],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = dirFor(locale);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
