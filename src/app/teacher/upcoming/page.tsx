import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Video, CalendarClock } from "lucide-react";

export const metadata = { title: "Upcoming Lessons" };

export default async function UpcomingPage() {
  const session = await requireRole("TEACHER");
  const bookings = await db.booking.findMany({
    where: { teacherId: session.userId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    orderBy: { scheduledAt: "asc" },
    include: { student: true, lesson: true },
  });

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Upcoming Lessons</h1>
        <p className="mt-1 text-sm text-muted-foreground">The platform assigns each student&apos;s lesson — open the classroom when it&apos;s time.</p>
      </header>

      {bookings.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center p-10 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">Nothing scheduled</p>
          <p className="mt-1 text-sm text-muted-foreground">Go online to receive instant requests, or wait for scheduled bookings.</p>
        </CardContent></Card>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <span className="min-w-[150px] text-sm font-semibold">{new Date(b.scheduledAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <UserAvatar name={b.student.name} color={b.student.avatarColor} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.student.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.lesson.titleDe} · {b.lesson.chapterId ? "" : ""}{b.durationMinutes} min</p>
                  </div>
                  <Badge variant={b.mode === "INSTANT" ? "accent" : "secondary"}>{b.mode.toLowerCase()}</Badge>
                  <Button size="sm" asChild><Link href={`/teacher/classroom/${b.id}`}><Video aria-hidden /> Classroom</Link></Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
