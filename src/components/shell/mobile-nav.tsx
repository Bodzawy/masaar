"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut, X } from "lucide-react";
import type { Dict } from "@/lib/i18n/de";
import { NAV_ICONS } from "@/config/nav";

function labelOf(dict: Dict, key: string): string {
  const v = key.split(".").reduce<unknown>((acc, p) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[p] : undefined), dict);
  return typeof v === "string" ? v : key;
}

export function MobileNav({
  items,
  dict,
  userName,
  unreadCount,
}: {
  items: Array<{ href: string; labelKey: string; icon: string }>;
  dict: Dict;
  userName: string;
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 start-0 flex w-72 flex-col bg-card shadow-xl animate-fade-in">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="font-semibold">{userName}</span>
              <button onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-md p-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Workspace">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = NAV_ICONS[item.icon] ?? NAV_ICONS.home!;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span>{labelOf(dict, item.labelKey)}</span>
                    {item.labelKey === "nav.notifications" && !!unreadCount && (
                      <span className="ms-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5">{unreadCount}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <form action="/api/auth/signout" method="post" className="border-t border-border p-3">
              <button type="submit" formAction="/api/auth/signout" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
