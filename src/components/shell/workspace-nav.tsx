"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dict } from "@/lib/i18n/de";
import { cn } from "@/lib/utils";
import { NAV_ICONS } from "@/config/nav";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: keyof typeof NAV_ICONS;
  exact?: boolean;
  badge?: number;
}

export function WorkspaceNav({ items, dict, unreadCount }: { items: NavItem[]; dict: Dict; unreadCount: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Workspace">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        const label = resolveLabel(dict, item.labelKey);
        const badge = item.labelKey === "nav.notifications" ? unreadCount : item.badge;
        const Icon = NAV_ICONS[item.icon] ?? NAV_ICONS.home!;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground/70")} aria-hidden />
            <span className="truncate">{label}</span>
            {!!badge && (
              <span className="ms-auto rounded-full bg-accent px-1.5 min-w-5 text-center text-[11px] font-semibold leading-5 text-accent-foreground">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function resolveLabel(dict: Dict, key: string): string {
  const value = key.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), dict);
  return typeof value === "string" ? value : key;
}
