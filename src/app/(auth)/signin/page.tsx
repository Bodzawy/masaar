import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeForRole } from "@/lib/routing";
import { getLocale } from "@/lib/i18n/server";
import { brand } from "@/config/brand";
import { isDemoMode } from "@/lib/demo-mode";
import { SignInForm, DemoAccountSelector } from "@/components/auth/signin-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));
  const locale = await getLocale();
  const sp = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">D</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">{brand.tagline}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <SignInForm nextPath={sp.next} />
        </div>

        <LanguageSwitcher current={locale} />

        {isDemoMode() && (
          <DemoAccountSelector />
        )}
      </div>
    </main>
  );
}
