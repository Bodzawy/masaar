import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Benachrichtigungen" };

export default async function NotificationsPage() {
  const session = await requireRole("STUDENT");
  const notifications = await db.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="container max-w-3xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Benachrichtigungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Stunden-Erinnerungen, Feedback und Plattform-Updates.</p>
      </header>

      {notifications.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center p-10 text-center">
          <BellOff className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">No notifications yet</p>
        </CardContent></Card>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <Link
                href={n.link ?? "/student"}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  n.readAt ? "border-border bg-card" : "border-primary/30 bg-primary/5"
                }`}
              >
                <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.readAt ? "text-muted-foreground" : "text-primary"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.readAt ? "text-muted-foreground" : "font-medium"}`}>{n.titleKey}</span>
                  <time className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</time>
                </span>
                {!n.readAt && <Badge variant="accent">Neu</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
