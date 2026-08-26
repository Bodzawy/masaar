import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AdminCharts } from "@/components/admin/charts";

export const metadata = { title: "Analysen" };

export default async function AnalyticsPage() {
  await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "FINANCE_ADMIN", "SUPER_ADMIN");

  const [bookingsByDay, topLessons] = await Promise.all([
    db.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "scheduledAt") AS day, COUNT(*) AS count
      FROM "Booking"
      WHERE "scheduledAt" > now() - interval '14 days'
      GROUP BY 1 ORDER BY 1`,
    db.lesson.findMany({
      take: 5,
      include: { _count: { select: { bookings: true } }, chapter: { select: { titleDe: true } } },
      orderBy: { bookings: { _count: "desc" } },
    }),
  ]);

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lernaktivität auf der gesamten Plattform.</p>
      </header>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Buchungen pro Tag</CardTitle><CardDescription>Rollierendes 14-Tage-Fenster.</CardDescription></CardHeader>
        <CardContent>
          <AdminCharts bookingsPerDay={bookingsByDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Meistgebuchte Lektionen</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-1.5">
            {topLessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 odd:bg-muted/60 text-sm">
                <span className="w-5 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{l.titleDe}</span>
                <span className="text-xs text-muted-foreground">{l.chapter.titleDe}</span>
                <span className="tabular-nums text-xs font-medium">{l._count.bookings} Buchungen</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
