import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminCharts } from "@/components/admin/charts";
import {
  Users2, GraduationCap, CalendarCheck, ShieldAlert, RefreshCcw,
  CheckCircle2, XCircle, Activity, BookOpenCheck,
} from "lucide-react";

export const metadata = { title: "Admin Overview" };

export default async function AdminOverviewPage() {
  await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPPORT_ADMIN", "MODERATOR", "FINANCE_ADMIN", "SUPER_ADMIN");

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [
    totalStudents, newStudents, onlineTeachers, suspendedTeachers,
    todaysLessons, completedLessons, cancellations, openReports, underReviewReports, pendingRetakes,
    bookingsByDay, levelCompletionRows, passRateRows,
  ] = await Promise.all([
    db.user.count({ where: { roleType: "STUDENT" } }),
    db.user.count({ where: { roleType: "STUDENT", createdAt: { gte: monthStart } } }),
    db.teacherProfile.count({ where: { isOnline: true } }),
    db.teacherProfile.count({ where: { qualityState: "SUSPENDED" } }),
    db.booking.count({ where: { scheduledAt: { gte: todayStart }, status: { in: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] } } }),
    db.booking.count({ where: { status: "COMPLETED" } }),
    db.booking.count({ where: { status: { in: ["CANCELLED_BY_STUDENT", "CANCELLED_BY_TEACHER", "NO_SHOW"] } } }),
    db.reportCase.count({ where: { status: "OPEN" } }),
    db.reportCase.count({ where: { status: "UNDER_REVIEW" } }),
    db.retakeRequest.count({ where: { status: "PENDING" } }),
    db.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "scheduledAt") AS day, COUNT(*) AS count
      FROM "Booking"
      WHERE "scheduledAt" > now() - interval '14 days'
      GROUP BY 1 ORDER BY 1`,
    db.lessonProgress.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.examAttempt.groupBy({ by: ["kind", "passed"], _count: { _all: true } }),
  ]);

  // Derived (not hard-coded) metrics
  const lessonTotals = levelCompletionRows.reduce((n, r) => n + r._count._all, 0);
  const completedCount = levelCompletionRows.find((r) => r.status === "COMPLETED")?._count._all ?? 0;
  const completionPercent = lessonTotals ? Math.round((completedCount / lessonTotals) * 100) : 0;

  const chapterAttempts = passRateRows.filter((r) => r.kind === "CHAPTER");
  const chapterPassed = chapterAttempts.find((r) => r.passed)?._count._all ?? 0;
  const chapterTotal = chapterAttempts.reduce((n, r) => n + r._count._all, 0);
  const chapterPassRate = chapterTotal ? Math.round((chapterPassed / chapterTotal) * 100) : null;

  return (
    <div className="container max-w-7xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational metrics derived from live data.</p>
      </header>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Users2} label="Students" value={totalStudents} sub={`+${newStudents} this month`} />
        <Kpi icon={Activity} label="Teachers online" value={onlineTeachers} sub={`${suspendedTeachers} suspended`} />
        <Kpi icon={CalendarCheck} label="Today's lessons" value={todaysLessons} sub={`${completedLessons} completed all-time`} />
        <Kpi icon={XCircle} label="Cancellations" value={cancellations} sub="all-time incl. no-shows" />
        <Kpi icon={ShieldAlert} label="Open reports" value={openReports} sub={`${underReviewReports} under review`} />
        <Kpi icon={RefreshCcw} label="Pending retakes" value={pendingRetakes} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Lessons per day */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookings — last 14 days</CardTitle>
            <CardDescription>Daily volume across instant and scheduled lessons.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminCharts
              bookingsPerDay={bookingsByDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) }))}
            />
          </CardContent>
        </Card>

        {/* Completion + pass rates */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><BookOpenCheck className="h-4 w-4 text-primary" aria-hidden /> Lesson completion</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{completionPercent}%</p>
              <p className="text-xs text-muted-foreground">{completedCount} of {lessonTotals} unlocked lessons completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Exam pass rate</CardTitle></CardHeader>
            <CardContent>
              {chapterPassRate != null ? (
                <>
                  <p className="text-3xl font-semibold tabular-nums">{chapterPassRate}%</p>
                  <p className="text-xs text-muted-foreground">{chapterPassed}/{chapterTotal} chapter exam attempts passed</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No attempts yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick links to operational queues */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QueueLink href="/admin/reports" icon={ShieldAlert} title="Reports & Investigations" desc={`${openReports + underReviewReports} active cases`} tone={openReports > 0 ? "warning" : undefined} />
        <QueueLink href="/admin/retakes" icon={RefreshCcw} title="Retake Requests" desc={`${pendingRetakes} awaiting review`} tone={pendingRetakes > 0 ? "accent" : undefined} />
        <QueueLink href="/admin/teachers" icon={GraduationCap} title="Teacher Pipeline" desc="Onboarding & quality control" />
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden />{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function QueueLink({ href, icon: Icon, title, desc, tone }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; tone?: "warning" | "accent" }) {
  return (
    <Link href={href} className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Icon className={`h-5 w-5 ${tone === "warning" ? "text-warning" : tone === "accent" ? "text-accent" : "text-primary"}`} aria-hidden />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
