import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { setOnlineStatus } from "@/app/actions/teacher";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/avatar";
import {
  CalendarClock, GraduationCap, Power, Star, TrendingUp, Users2, Video,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Teacher Overview" };

const QUALITY_LABEL: Record<string, string> = {
  GOOD_STANDING: "Good Standing", WARNING: "Warning", UNDER_REVIEW: "Under Review", SUSPENDED: "Suspended",
};

export default async function TeacherDashboard() {
  const session = await requireRole("TEACHER");
  const profile = await db.teacherProfile.findUnique({ where: { userId: session.userId } });
  if (!profile) return <p className="text-sm text-muted-foreground">Profile missing.</p>;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

  const [todayBookings, nextBooking, ratingsAgg, pendingSubs] = await Promise.all([
    db.booking.findMany({
      where: { teacherId: session.userId, scheduledAt: { gte: todayStart, lt: todayEnd }, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      orderBy: { scheduledAt: "asc" },
      include: { student: true, lesson: true },
    }),
    db.booking.findFirst({
      where: { teacherId: session.userId, scheduledAt: { gte: new Date() }, status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      include: { student: true, lesson: true },
    }),
    db.teacherRating.aggregate({ where: { teacherId: session.userId }, _avg: { overall: true }, _count: { overall: true } }),
    db.homeworkSubmission.findMany({
      where: { status: "SUBMITTED", homework: { lesson: { bookings: { some: { teacherId: session.userId } } } } },
      take: 3,
      include: { student: true, homework: { include: { lesson: true } } },
    }).catch(() => []),
  ]);

  // Incoming instant requests (demo): INSTANT bookings scheduled within now±15min
  const instantRequests = await db.booking.findMany({
    where: { teacherId: session.userId, mode: "INSTANT", status: "SCHEDULED", scheduledAt: { gte: new Date(Date.now() - 30 * 60000) } },
    include: { student: true, lesson: true },
  });

  const qualityTone = profile.qualityScore >= 80 ? "success" : profile.qualityScore >= 70 ? "warning" : profile.qualityScore >= 60 ? "accent" : "destructive";

  return (
    <div className="container max-w-6xl space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guten Tag, {session.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.isOnline ? "You are online — students can book you instantly." : "You are offline."}
          </p>
        </div>
        {/* Online toggle (server action) */}
        <form
          action={async () => {
            "use server";
            await setOnlineStatus(!profile.isOnline);
          }}
        >
          <Button type="submit" variant={profile.isOnline ? "outline" : "success"} size="lg" aria-pressed={profile.isOnline}>
            <Power aria-hidden />
            {profile.isOnline ? "Go offline" : "Go online"}
          </Button>
        </form>
      </header>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Star} label="Average rating" value={`${(ratingsAgg._avg.overall ?? 0).toFixed(1)} ★`} sub={`${ratingsAgg._count.overall} reviews`} />
        <StatCard icon={GraduationCap} label="Lessons completed" value={profile.completedLessons.toLocaleString()} />
        <StatCard icon={TrendingUp} label="Cancellation rate" value={`${profile.cancellationRatePct}%`} />
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">Quality score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{profile.qualityScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
            <Progress
              value={profile.qualityScore}
              indicatorClassName={qualityTone === "success" ? "bg-success" : qualityTone === "warning" ? "bg-warning" : qualityTone === "accent" ? "bg-accent" : "bg-destructive"}
              className="mt-2"
            />
            <Badge variant={qualityTone as "success"} className="mt-2">{QUALITY_LABEL[profile.qualityState]}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Instant request banner */}
      {instantRequests.length > 0 && (
        <Card className="border-accent bg-accent/10 animate-scale-in">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <Video className="h-6 w-6 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Incoming instant lesson request</p>
              <p className="text-sm text-muted-foreground truncate">
                {instantRequests[0]!.student.name} · {instantRequests[0]!.lesson.titleDe}
              </p>
            </div>
            <Button asChild><Link href={`/teacher/classroom/${instantRequests[0]!.id}`}>Open classroom</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today&apos;s schedule */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Today&apos;s schedule</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/teacher/upcoming">All upcoming</Link></Button>
          </CardHeader>
          <CardContent>
            {todayBookings.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <CalendarClock className="mx-auto h-7 w-7 text-muted-foreground/50" aria-hidden />
                <p className="mt-2 text-sm text-muted-foreground">
                  No lessons today.{nextBooking ? ` Next: ${formatDateTime(nextBooking.scheduledAt)} with ${nextBooking.student.name}.` : ""}
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {todayBookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3.5">
                    <span className="w-14 shrink-0 text-sm font-semibold tabular-nums">
                      {new Date(b.scheduledAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <UserAvatar name={b.student.name} color={b.student.avatarColor} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.student.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.lesson.titleDe}</p>
                    </div>
                    <Badge variant={b.mode === "INSTANT" ? "accent" : "secondary"}>{b.mode.toLowerCase()}</Badge>
                    <Button size="sm" asChild><Link href={`/teacher/classroom/${b.id}`}><Video aria-hidden /> Start</Link></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Homework queue preview */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Homework to review</CardTitle></CardHeader>
          <CardContent>
            {pendingSubs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting — great!</p>
            ) : (
              <ul className="space-y-2.5">
                {pendingSubs.map((sub) => (
                  <li key={sub.id}>
                    <Link href={`/teacher/review/${sub.id}`} className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <p className="truncate text-sm font-medium">{sub.student.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{sub.homework.lesson.titleDe}</p>
                    </Link>
                  </li>
                ))}
                <li><Button variant="ghost" size="sm" asChild className="w-full"><Link href="/teacher/review">Open review queue</Link></Button></li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden /> {label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
