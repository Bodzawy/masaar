import Link from "next/link";
import { LogOut } from "lucide-react";
import type { RoleType } from "@prisma/client";
import { brand } from "@/config/brand";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { WorkspaceNav, type NavItem } from "@/components/shell/workspace-nav";
import { MobileNav } from "@/components/shell/mobile-nav";

export async function WorkspaceShell({
  role,
  items,
  userName,
  unreadCount,
  children,
}: {
  role: RoleType;
  items: NavItem[];
  userName: string;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden>D</span>
          <Link href="/" className="font-semibold tracking-tight">{brand.name}</Link>
        </div>
        <WorkspaceNav items={items} dict={dict} unreadCount={unreadCount} />
        <div className="mt-auto space-y-3 border-t border-border p-4">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
              aria-hidden
            >
              {userName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="text-xs capitalize text-muted-foreground">{role.toLowerCase().replace("_", " ")}</p>
            </div>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              formAction="/api/auth/signout"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
          <MobileNav items={items} dict={dict} userName={userName} unreadCount={unreadCount} />
          <Link href="#" className="font-semibold">{brand.name}</Link>
          <div className="ms-auto"><LanguageSwitcher current={locale} /></div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <div className="fixed bottom-4 end-4 z-40 hidden lg:block">
        <LanguageSwitcher current={locale} />
      </div>
    </div>
  );
}
