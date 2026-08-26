import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/noto-naskh-arabic/400.css";
import "@fontsource/noto-naskh-arabic/500.css";
import "@fontsource/noto-naskh-arabic/700.css";
import "./globals.css";
import { brand } from "@/config/brand";
import { getLocale, dirFor } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: {
    default: `${brand.name} – Arabisch lernen online | Arabischkurs A1–C2 mit Live-Lehrkräften`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Arabisch lernen für Deutschsprachige: strukturierter Lernweg von A1 bis C2, Live-Einzelunterricht mit qualifizierten Lehrkräften, Quiz, Hausaufgaben und verifizierbare Zertifikate.",
  keywords: [
    "Arabisch lernen", "Arabisch online lernen", "Arabischkurs online", "Arabischunterricht",
    "Arabisch für Anfänger", "Hocharabisch lernen", "Arabisch lernen mit Lehrer", "Online Arabischkurs",
  ],
  openGraph: {
    title: `${brand.name} – Arabisch lernen online`,
    description:
      "Strukturierter Arabischkurs für Deutschsprachige: Niveaus A1–C2, echte Lehrkräfte, messbarer Fortschritt.",
    siteName: brand.name,
    type: "website",
    locale: "de_DE",
  },
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='#4338CA'/><text x='16' y='23' text-anchor='middle' font-size='18' font-family='serif' fill='#F59E0B'>م</text></svg>`
          ),
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#4338CA",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = dirFor(locale); // UI shell bleibt LTR (Deutsch)
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
