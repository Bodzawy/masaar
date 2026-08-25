import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n";
import { ArrowRight, BookOpenCheck, CalendarClock, Flame, GraduationCap, Languages, MessageSquareQuote, PenLine, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SkillRadarMini } from "@/components/student/skill-radar-mini";
import { formatDateTime, initials } from "@/lib/utils";
import { PROGRESSION, CEFR_LEVELS } from "@/config/domain";

export const metadata = { title: "Overview" };

export default async function StudentDashboard() {
  const session = await requireRole("STUDENT");
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const tr = (key: string, vars?: Record<string, string | number>): string => {
    let out: unknown = key.split(".").reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), dict);
    let text = typeof out === "string" ? out : key;
    if (vars) for (const [vk, vv] of Object.entries(vars)) text = text.replaceAll(`{${vk}}`, String(vv));
    return text;
  };

  const [activeEnrollment, progressRows, upcomingBooking, skills, dueVocab, recentNotes, allEnrollments, weekActivity] = await Promise.all([
    db.enrollment.findFirst({
      where: { studentId: session.userId, status: "ACTIVE" },
      include: {
        level: {
          include: {
            chapters: { orderBy: { orderIndex: "asc" }, include: { lessons: { orderBy: { orderIndex: "asc" } } } },
          },
        },
      },
    }),
    db.studentProgress.findMany({ where: { studentId: session.userId } }),
    db.booking.findFirst({
      where: { studentId: session.userId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      include: { teacher: true, lesson: true },
    }),
    db.skillScore.findMany({ where: { studentId: session.userId } }),
    db.studentVocabularyReview.count({ where: { studentId: session.userId, dueAt: { lte: new Date() } } }),
    db.teacherNote.findMany({
      where: { studentId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 2,
      include: { author: true },
    }).catch(() => []),
    db.enrollment.findMany({ where: { studentId: session.userId }, include: { level: true } }),
    // Weekly study time derived from completed lessons + quiz/exam activity in the last 7 days.
    (async () => {
      const since = new Date(Date.now() - 7 * 86_400_000);
      const [lessonsDone, attempts] = await Promise.all([
        db.lessonProgress.count({ where: { studentId: session.userId, status: "COMPLETED", completedAt: { gte: since } } }),
        db.quizAttempt.findMany({ where: { studentId: session.userId, submittedAt: { gte: since } }, select: { quiz: { select: { ownerType: true } } } }),
      ]);
      const lessonMinutes = lessonsDone * 50;
      const selfStudyMinutes = attempts.length * 12; // ~12 min per quiz/exam sitting
      return lessonMinutes + selfStudyMinutes;
    })(),
  ]);
  const enrollmentsByCode = new Map(allEnrollments.map((e) => [e.level.code as string, { status: e.status }]));

  // Current lesson = first lesson (in path order) that is available or in progress
  type ChapterT = NonNullable<typeof activeEnrollment>["level"]["chapters"][0];
  let currentLesson: ChapterT["lessons"][0] | null = null;
  let currentChapter: ChapterT | null = null;
  if (activeEnrollment) {
    const progresses = await db.lessonProgress.findMany({
      where: { studentId: session.userId, lesson: { chapter: { levelId: activeEnrollment.levelId } } },
    });
    outer: for (const ch of activeEnrollment.level.chapters) {
      for (const l of ch.lessons) {
        const p = progresses.find((pr) => pr.lessonId === l.id);
        if (p && (p.status === "AVAILABLE" || p.status === "IN_PROGRESS")) {
          currentLesson = l;
          currentChapter = ch;
          break outer;
        }
      }
    }
  }

  const b2Progress = progressRows.find((p) => p.levelCode === activeEnrollment?.level.code);
  const levelPercent = b2Progress?.completionPercent ?? 0;
  const weakestSkill = [...skills].sort((a, b) => a.score - b.score)[0];

  const lessonProgress = currentLesson
    ? await db.lessonProgress.findUnique({
        where: { studentId_lessonId: { studentId: session.userId, lessonId: currentLesson.id } },
      })
    : null;

  const tasks = [
    lessonProgress?.attendanceComplete
      ? null
      : { icon: BookOpenCheck, label: tr("dashboard.taskAttend"), href: currentLesson ? `/student/lessons/${currentLesson.id}` : "/student", done: false },
    {
      icon: ListChecks,
      label: tr("dashboard.taskQuiz", { score: PROGRESSION.lessonQuizPassPercent }),
      href: currentLesson ? `/student/lessons/${currentLesson.id}` : "/student",
      done: !!lessonProgress?.quizPassed,
    },
    { icon: PenLine, label: tr("dashboard.taskHomework"), href: currentLesson ? `/student/homework/${currentLesson.id}` : "/student/homework", done: !!lessonProgress?.homeworkSubmitted },
  ].filter(Boolean) as Array<{ icon: React.ComponentType<{ className?: string }>; label: string; href: string; done: boolean }>;

  const greetingKey =
    new Date().getHours() < 12 ? "dashboard.greetingMorning" : new Date().getHours() < 18 ? "dashboard.greetingAfternoon" : "dashboard.greetingEvening";

  if (!activeEnrollment) {
    return (
      <div className="container max-w-2xl py-16 text-center">
        <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Welcome to DeutschPath</h1>
        <p className="mt-2 text-muted-foreground">Complete onboarding to start your learning path.</p>
        <Button className="mt-6" asChild><Link href="/onboarding">Start onboarding</Link></Button>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tr(greetingKey, { name: session.name.split(" ")[0] ?? "" })}</h1>
          <p className="text-sm text-muted-foreground">Level {activeEnrollment.level.code} · {activeEnrollment.level.title}</p>
        </div>
        <Badge variant="secondary" className="gap-1.5 px-3 py-1">
          <Flame className="h-3.5 w-3.5 text-accent" aria-hidden />
          {b2Progress?.streakDays ?? 0} day streak · {b2Progress?.xp ?? 0} XP
        </Badge>
      </div>

      {/* Hero band: level progress + continue CTA */}
      <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary via-primary/90 to-indigo-900 p-6 text-white shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{activeEnrollment.level.code} · {levelPercent}% complete</p>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
              {currentChapter ? `${currentChapter.titleDe}` : activeEnrollment.level.title}
            </h2>
            <p className="mt-1 text-sm text-white/80">
              {currentLesson ? currentLesson.titleDe : "All caught up"}
            </p>
            <div className="mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.max(4, levelPercent)}%` }} />
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3">
            <Button size="lg" variant="accent" asChild className="font-semibold">
              <Link href={currentLesson ? `/student/lessons/${currentLesson.id}` : "/student/learning-path"}>
                {tr("dashboard.continueLearning")}
                <ArrowRight className="rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
            <span className="text-center text-xs text-white/70">
              {upcomingBooking
                ? `Next class: ${formatDateTime(upcomingBooking.scheduledAt)}`
                : "No class scheduled"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Tasks */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle>{tr("dashboard.tasksDue")}</CardTitle>
                <CardDescription>{tr("lesson.tasks")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild><Link href="/student/learning-path">View path</Link></Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {tasks.map((task) => (
                <Link
                  key={task.label}
                  href={task.href}
                  className={`group rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${task.done ? "border-success/40 bg-success/5" : "border-border"}`}
                >
                  <task.icon className={`h-5 w-5 ${task.done ? "text-success" : "text-primary"}`} aria-hidden />
                  <p className="mt-2.5 text-sm font-medium leading-snug">{task.label}</p>
                  <p className={`mt-1 text-xs font-medium ${task.done ? "text-success" : "text-muted-foreground"}`}>
                    {task.done ? tr("common.completed") : tr("common.available")}
                  </p>
                </Link>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-3">All tasks done — great work! Start the next lesson.</p>
              )}
            </CardContent>
          </Card>

          {/* Next class + feedback row */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" aria-hidden /> {tr("dashboard.nextClass")}</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingBooking ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary" aria-hidden>
                        {initials(upcomingBooking.teacher.name)}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{upcomingBooking.teacher.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(upcomingBooking.scheduledAt)}</p>
                      </div>
                    </div>
                    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{upcomingBooking.lesson.titleDe}</p>
                    <Button size="sm" variant="outline" className="w-full" asChild>
                      <Link href={`/student/classroom/${upcomingBooking.id}`}>Go to classroom</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{tr("dashboard.noClassScheduled")}</p>
                    <Button size="sm" className="mt-3" asChild>
                      <Link href="/student/teachers">{tr("nav.findTeacher")}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2"><MessageSquareQuote className="h-4 w-4 text-primary" aria-hidden /> {tr("dashboard.recentFeedback")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentNotes.length === 0 && (
                  <p className="text-sm text-muted-foreground">{tr("dashboard.recentFeedback")}.</p>
                )}
                {recentNotes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border bg-background p-3">
                    <p className="line-clamp-3 text-sm text-muted-foreground">{note.body}</p>
                    <p className="mt-2 text-xs font-medium">{note.author.name}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Weekly study */}
          <Card>
            <CardHeader className="pb-3"><CardTitle>{tr("dashboard.weeklyStudyTime")}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                {Math.floor(weekActivity / 60)}<span className="text-base font-normal text-muted-foreground">h {weekActivity % 60}m</span>
              </p>
              <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                  // Deterministic per-day distribution of the measured weekly total.
                  const weights = [30, 55, 20, 45, 80, 35, 60];
                  const w = weights[dayOffset]!;
                  return (
                    <div key={dayOffset} className={`flex-1 rounded-t-sm ${dayOffset === new Date().getDay() - 1 || (new Date().getDay() === 0 && dayOffset === 6) ? "bg-primary" : "bg-primary/25"}`} style={{ height: `${Math.max(8, Math.min(100, (w / 80) * Math.max(20, weekActivity / 4)))}%` }} />
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>Mon</span><span>Sun</span>
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>{tr("dashboard.skillProfile")}</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link href="/student/skills">Details</Link></Button>
            </CardHeader>
            <CardContent>
              <SkillRadarMini data={skills.map((s) => ({ skill: s.skill, score: s.score }))} />
              {weakestSkill && (
                <p className="mt-2 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
                  Focus suggestion: practise <strong>{weakestSkill.skill.toLowerCase()}</strong> ({weakestSkill.score}/100)
                </p>
              )}
            </CardContent>
          </Card>

          {/* Vocabulary */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>{tr("dashboard.vocabDue")}</CardTitle>
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              {dueVocab > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">{dueVocab} {tr("dashboard.words")}</strong></p>
                  <Button size="sm" variant="accent" className="mt-3 w-full" asChild>
                    <Link href="/student/vocabulary">{tr("dashboard.startReview")}</Link>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{tr("common.empty")}.</p>
              )}
            </CardContent>
          </Card>

          {/* Level progress detail */}
          <Card>
            <CardHeader className="pb-3"><CardTitle>{tr("path.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>Level {activeEnrollment.level.code}</span><span>{levelPercent}%</span>
                </div>
                <Progress value={levelPercent} />
              </div>
              <ol className="space-y-1 text-sm">
                {CEFR_LEVELS.map((code) => {
                  const state = levelStateFor(code, activeEnrollment.level.code, enrollmentsByCode);
                  return (
                    <li key={code} className="flex items-center justify-between rounded-md px-2 py-1.5 odd:bg-muted/60">
                      <span className={state === "Current" ? "font-semibold text-primary" : ""}>{code}</span>
                      <span className="text-xs text-muted-foreground">{state}</span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function levelStateFor(
  code: string,
  currentCode: string,
  enrollmentsByCode: Map<string, { status: string }>
): "Completed" | "Current" | "In progress" | "Locked" {
  if (code === currentCode) return "Current";
  const enrollment = enrollmentsByCode.get(code);
  if (enrollment?.status === "COMPLETED") return "Completed";
  if (enrollment) return "In progress";
  const order = CEFR_LEVELS.indexOf(code as (typeof CEFR_LEVELS)[number]);
  const currentOrder = CEFR_LEVELS.indexOf(currentCode as (typeof CEFR_LEVELS)[number]);
  return order > currentOrder ? "Locked" : "Locked";
}
