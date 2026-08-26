import Link from "next/link";
import { ArrowRight, BookOpenCheck, ShieldCheck, Users, CheckCircle2, Lock, Languages } from "lucide-react";
import { brand } from "@/config/brand";
import { CEFR_LEVELS } from "@/config/domain";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function LandingPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const tr = (key: string): string => {
    const v = key.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), dict);
    return typeof v === "string" ? v : key;
  };

  const features = [
    { icon: BookOpenCheck, title: tr("landing.featureCurriculumTitle"), body: tr("landing.featureCurriculumBody") },
    { icon: Users, title: tr("landing.featureTeachersTitle"), body: tr("landing.featureTeachersBody") },
    { icon: ShieldCheck, title: tr("landing.featureProofTitle"), body: tr("landing.featureProofBody") },
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight">{brand.name}</span>
            <span className="font-arabic text-sm text-muted-foreground" lang="ar" aria-hidden>مسار</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher current={locale} />
            </div>
            <Button variant="ghost" asChild className="px-3 sm:px-4">
              <Link href="/signin">{tr("common.signIn")}</Link>
            </Button>
            <Button asChild className="px-3 sm:px-4">
              <Link href="/signup">{tr("common.signUp")}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60rem 30rem at 85% -10%, hsl(243 63% 55% / .10), transparent), radial-gradient(40rem 22rem at -10% 20%, hsl(38 92% 50% / .07), transparent)",
            }}
          />
          <div className="container grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
            <div className="max-w-xl animate-fade-in">
              <Badge variant="accent" className="mb-5">{tr("landing.heroKicker")}</Badge>
              <h1 className="text-balance text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
                {tr("landing.heroTitle")}
              </h1>
              <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
                {tr("landing.heroSubtitle")}
              </p>
              {/* Arabisches Schriftprobe-Element: RTL-Insel im LTR-Layout */}
              <p className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-muted-foreground">
                Deine ersten Wörter:{" "}
                <span dir="rtl" lang="ar" className="font-arabic text-lg text-foreground">مَرْحَبًا</span>{" "}
                ·{" "}
                <span dir="rtl" lang="ar" className="font-arabic text-lg text-foreground">شُكْرًا</span>
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link href="/signup">
                    {tr("landing.ctaPrimary")}
                    <ArrowRight className="ms-1 rtl:rotate-180" aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/signin">{tr("landing.ctaSecondary")}</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">{brand.companyName}</p>
            </div>

            {/* Level-Pfad-Visual */}
            <div className="relative mx-auto w-full max-w-md" aria-hidden>
              <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr("landing.levelsLabel")}</p>
                <ol className="mt-4 space-y-2.5">
                  {CEFR_LEVELS.map((lvl, i) => (
                    <li key={lvl} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-4 py-2.5">
                      <span
                        className={
                          i < 3
                            ? "flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success"
                            : i === 3
                              ? "flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                              : "flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        }
                      >
                        {i < 3 ? <CheckCircle2 className="h-4 w-4" /> : i === 3 ? <BookOpenCheck className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
                      </span>
                      <span className={i === 3 ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>{lvl}</span>
                      {i === 3 && (
                        <span className="ms-auto h-1.5 w-24 overflow-hidden rounded-full bg-primary/10">
                          <span className="block h-full w-2/5 rounded-full bg-primary" />
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="absolute -bottom-5 end-6 rotate-2 rounded-lg border border-accent/40 bg-accent px-3 py-1.5 text-xs font-semibold shadow-card">
                {tr("landing.currentBadgeDemo")}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-card py-20">
          <div className="container grid gap-10 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-background p-7">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">{f.title}</h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Was du lernst */}
        <section className="py-20">
          <div className="container max-w-3xl text-center">
            <Languages className="mx-auto h-8 w-8 text-primary" aria-hidden />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Modernes Hocharabisch – solide und praxisnah</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              Du lernst Modernes Hocharabisch (فصحى) – verständlich in der ganzen arabischen Welt. Auf Wunsch vertiefen
              Lehrkräfte mit Schwerpunkten wie ägyptischem oder levantinischem Dialekt, Aussprache oder Konversation.
            </p>
            <div className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-2">
              {["Modernes Hocharabisch", "Arabisch für Anfänger", "Konversation", "Grammatik", "Lesen & Schreiben", "Aussprache"].map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-10">
          <div className="container flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BrandMark />
              <span>{brand.name}</span>
            </div>
            <p>{tr("landing.ctaSecondary")} · {brand.supportEmail}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function BrandMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-xs" aria-hidden>
      م
    </span>
  );
}
