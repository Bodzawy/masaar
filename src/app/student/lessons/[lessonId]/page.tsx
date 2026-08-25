import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { assertLessonAccess } from "@/domain/progression";
import { PROGRESSION, LOCK_REASONS } from "@/config/domain";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Target, FileText, BookOpenCheck, ListChecks as QuizIcon, PenLine, CheckCircle2,
  Lock, ArrowRight, Users2, Clock,
} from "lucide-react";

export const metadata = { title: "Lesson" };

const materialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  worksheet: FileText, audio: BookOpenCheck, reading: FileText, slides: FileText, vocabulary: BookOpenCheck,
};

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await requireRole("STUDENT");
  const { lessonId } = await params;

  const access = await assertLessonAccess(session.userId, lessonId);
  if (!access.ok) {
    if (access.reason === "NOT_FOUND") notFound();
    if (access.reason === "NOT_ENROLLED") redirect("/student/learning-path");
    return <LockedState reason={access.reason} passScore={PROGRESSION.lessonQuizPassPercent} />;
  }

  const lesson = access.lesson;
  const progress = access.progress;

  // Next booking for this lesson
  const upcomingBooking = await db.booking.findFirst({
    where: { studentId: session.userId, lessonId, status: "SCHEDULED" },
    orderBy: { scheduledAt: "asc" },
    include: { teacher: true },
  });

  const tasks = [
    {
      key: "attendance",
      icon: BookOpenCheck,
      title: "Attend the live lesson",
      desc: "Your attendance is marked automatically after the session ends.",
      done: progress.attendanceComplete,
      cta: upcomingBooking
        ? { label: "Go to classroom", href: `/student/classroom/${upcomingBooking.id}` }
        : { label: "Book a teacher for this lesson", href: `/student/teachers?lesson=${lesson.id}` },
    },
    {
      key: "quiz",
      icon: QuizIcon,
      title: `Pass the quiz (${PROGRESSION.lessonQuizPassPercent}%+)`,
      desc: progress.quizBestScore != null ? `Best score so far: ${progress.quizBestScore}%` : "20 questions · grammar, vocabulary, reading and listening.",
      done: progress.quizPassed,
      cta: { label: progress.quizBestScore != null && !progress.quizPassed ? "Retry quiz" : "Start quiz", href: `/student/lessons/${lesson.id}/quiz` },
      disabled: !progress.attendanceComplete,
    },
    ...(lesson.requiresHomework
      ? [{
          key: "homework",
          icon: PenLine,
          title: "Submit homework",
          desc: "Writing task + exercises. Drafts are saved automatically.",
          done: progress.homeworkSubmitted,
          cta: { label: "Open homework", href: `/student/homework/${lesson.id}` },
          disabled: !progress.attendanceComplete,
        }]
      : []),
  ];

  const completedTasks = tasks.filter((t) => t.done).length;

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/student/learning-path" className="hover:text-foreground">Learning path</Link>
        <span className="mx-1.5">·</span>
        <span>{lesson.chapter.titleDe}</span>
      </nav>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={progress.status === "COMPLETED" ? "success" : "default"}>
            Lesson {lesson.orderIndex} of {lesson.chapter.title}
          </Badge>
          <Badge variant="muted" className="gap-1"><Clock className="h-3 w-3" />{lesson.durationMinutes} min live session</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.titleDe}</h1>
        <p className="max-w-2xl text-muted-foreground">{lesson.summary}</p>
        {progress.status === "COMPLETED" && (
          <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-3">
          {/* Objectives */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" aria-hidden /> Lesson objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {lesson.objectives.map((o) => (
                  <li key={o.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary" aria-hidden>{o.orderIndex}</span>
                    {o.text}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" aria-hidden /> Materials</CardTitle>
              <CardDescription>Review before or during your live session.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {lesson.materials.length === 0 && <p className="text-sm text-muted-foreground">No materials yet.</p>}
              {lesson.materials.map((m) => {
                const Icon = materialIcons[m.type] ?? FileText;
                return (
                  <details key={m.id} className="group rounded-lg border border-border bg-background p-4 open:bg-card">
                    <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="flex-1">{m.title}</span>
                      <ArrowRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground transition-transform group-open:-rotate-90 rtl:-rotate-90 rtl:group-open:rotate-90" aria-hidden />
                    </summary>
                    {m.body && <p className="mt-3 whitespace-pre-line border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">{m.body}</p>}
                  </details>
                );
              })}
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                To complete this lesson
                <span className="text-sm font-normal text-muted-foreground">{completedTasks}/{tasks.length}</span>
              </CardTitle>
              <Progress value={(completedTasks / tasks.length) * 100} />
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.map((task) => (
                <div key={task.key} className={`flex flex-wrap items-center gap-3 rounded-lg border p-4 ${task.done ? "border-success/40 bg-success/5" : task.disabled ? "border-border opacity-70" : "border-border"}`}>
                  <task.icon className={`h-5 w-5 shrink-0 ${task.done ? "text-success" : "text-primary"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{task.desc}</p>
                  </div>
                  {task.done ? (
                    <CheckCircle2 className="h-5 w-5 text-success" aria-label="Completed" />
                  ) : task.disabled ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" aria-hidden /> Attend first</span>
                  ) : (
                    <Button size="sm" variant={task.key === "attendance" ? "default" : "outline"} asChild>
                      <Link href={task.cta.href}>{task.cta.label}</Link>
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users2 className="h-4 w-4 text-primary" aria-hidden /> Live session</CardTitle></CardHeader>
            <CardContent>
              {upcomingBooking ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">{upcomingBooking.teacher.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(upcomingBooking.scheduledAt).toLocaleString(locale())}</p>
                  <Button size="sm" className="w-full" asChild>
                    <Link href={`/student/classroom/${upcomingBooking.id}`}>Enter classroom</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">No session booked for this lesson yet.</p>
                  <Button size="sm" variant="accent" className="w-full" asChild>
                    <Link href={`/student/teachers?lesson=${lesson.id}`}>Find a teacher now</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">How unlocking works.</strong> A lesson completes when you (1) attend the live
              session, (2) score at least {PROGRESSION.lessonQuizPassPercent}% on the quiz, and{" "}
              {lesson.requiresHomework ? "(3) submit homework." : "complete the quiz."} The next lesson then opens
              automatically — there is no manual skipping.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function locale() {
  return "en-GB";
}

function LockedState({ reason, passScore }: { reason: string; passScore: number }) {
  const messages: Record<string, string> = {
    PREVIOUS_LESSON: LOCK_REASONS.LESSON_SEQUENCE.replaceAll("{score}", String(passScore)),
    PREVIOUS_CHAPTER_EXAM: LOCK_REASONS.NEXT_CHAPTER.replaceAll("{score}", String(PROGRESSION.examPassPercent)),
  };
  return (
    <div className="container max-w-lg py-24 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">This lesson is locked</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{messages[reason] ?? "Complete previous steps to unlock."}</p>
      <Button className="mt-6" asChild><Link href="/student/learning-path">Back to my path</Link></Button>
    </div>
  );
}
