import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelBooking } from "@/app/actions/booking";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users2, Video } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Unterrichtsstunden" };

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "muted" | "destructive" | "default" }> = {
  SCHEDULED: { label: "Geplant", variant: "default" },
  IN_PROGRESS: { label: "Läuft", variant: "warning" },
  COMPLETED: { label: "Abgeschlossen", variant: "success" },
  CANCELLED_BY_STUDENT: { label: "Von dir storniert", variant: "muted" },
  CANCELLED_BY_TEACHER: { label: "Von der Lehrkraft storniert", variant: "destructive" },
  NO_SHOW: { label: "Nicht erschienen", variant: "destructive" },
};

export default async function SchedulePage() {
  const session = await requireRole("STUDENT");
  const bookings = await db.booking.findMany({
    where: { studentId: session.userId },
    orderBy: { scheduledAt: "desc" },
    take: 30,
    include: { teacher: true, lesson: true, rating: true },
  });

  const upcoming = bookings.filter((b) => b.status === "SCHEDULED" || b.status === "IN_PROGRESS");
  const past = bookings.filter((b) => b.status !== "SCHEDULED" && b.status !== "IN_PROGRESS");

  return (
    <div className="container max-w-4xl space-y-8 animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unterrichtsstunden</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deine individuellen Live-Stunden.</p>
        </div>
        <Button asChild><Link href="/student/teachers">Unterricht buchen</Link></Button>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bevorstehend</h2>
        {upcoming.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center p-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" aria-hidden />
            <p className="mt-3 font-medium">Keine Stunden geplant</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Buche eine Sofortstunde bei einer online-Lehrkraft oder plane eine Stunde für später.
            </p>
            <Button size="sm" className="mt-4" asChild><Link href="/student/teachers">Lehrkraft finden</Link></Button>
          </CardContent></Card>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li key={b.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-[140px]">
                      <p className="font-semibold">{formatDateTime(b.scheduledAt)}</p>
                      <Badge variant={STATUS_LABEL[b.status]!.variant} className="mt-1">{STATUS_LABEL[b.status]!.label}</Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.lesson.titleDe}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users2 className="h-3 w-3" aria-hidden />{b.teacher.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" asChild><Link href={`/student/classroom/${b.id}`}><Video aria-hidden /> Klassenzimmer</Link></Button>
                      <CancelForm bookingId={b.id} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Verlauf</h2>
        {past.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Noch keine vergangenen Stunden.</p>
        ) : (
          <ul className="space-y-2">
            {past.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{formatDate(b.scheduledAt)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{b.lesson.titleDe}</span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">{b.teacher.name}</span>
                <Badge variant={STATUS_LABEL[b.status]!.variant}>{STATUS_LABEL[b.status]!.label}</Badge>
                {b.rating ? (
                  <span className="text-xs font-medium text-accent">{b.rating.overall}★ given</span>
                ) : b.status === "COMPLETED" ? (
                  <Button size="sm" variant="outline" asChild><Link href={`/student/post-lesson/${b.id}`}>Bewerten</Link></Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CancelForm({ bookingId }: { bookingId: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await cancelBooking(bookingId);
      }}
    >
      <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">Stornieren</Button>
    </form>
  );
}
