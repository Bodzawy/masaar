import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getPathForStudent } from "@/domain/progression";
import { CEFR_LEVELS, LEVEL_TITLES, PROGRESSION } from "@/config/domain";
import type { CefrCode } from "@/config/domain";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, CircleDot, Lock, BookOpenCheck, ClipboardCheck,
  Award, ArrowRight, Play,
} from "lucide-react";

export const metadata = { title: "My Learning Path" };

const stateStyles: Record<string, string> = {
  COMPLETED: "border-success/40 bg-success/5",
  IN_PROGRESS: "border-primary/50 bg-primary/5",
  AVAILABLE: "border-border bg-card hover:border-primary/40",
  LOCKED: "border-border bg-muted/40 opacity-75",
};

export default async function LearningPathPage() {
  const session = await requireRole("STUDENT");

  const activeEnrollment = await db.enrollment.findFirst({
    where: { studentId: session.userId, status: "ACTIVE" },
    include: { level: true },
  });
  const currentCode = activeEnrollment?.level.code ?? "A1";
  const path = await getPathForStudent(session.userId, currentCode);

  // Enrollment map for all levels
  const enrollments = await db.enrollment.findMany({
    where: { studentId: session.userId },
    include: { level: true },
  });
  const enrolledByCode = new Map(enrollments.map((e) => [e.level.code as string, e]));

  return (
    <div className="container max-w-4xl space-y-8 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mein Lernweg</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deine strukturierte Reise von A1 bis C2. Jeder Schritt schaltet den nächsten frei.
        </p>
      </header>

      <div className="space-y-6">
        {CEFR_LEVELS.map((code) => {
          const isCurrent = code === currentCode;
          const enrollment = enrolledByCode.get(code);
          const completed = enrollment?.status === "COMPLETED";

          if (!isCurrent) {
            return (
              <LevelRow
                key={code}
                code={code}
                state={completed ? "COMPLETED" : enrollment ? "IN_PROGRESS" : isFutureLevel(code, currentCode) ? "LOCKED" : "LOCKED"}
              />
            );
          }

          // Expanded current level
          return (
            <Card key={code} className="overflow-hidden border-primary/30 shadow-card">
              <div className="flex items-center gap-4 border-b border-border bg-primary/5 px-6 py-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-bold text-white">{code}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Current level</p>
                  <h2 className="truncate text-lg font-semibold">{code} · {LEVEL_TITLES[code]}</h2>
                </div>
                {path && (
                  <Badge variant="default" className="shrink-0">
                    {path.chapters.reduce((n, c) => n + c.lessons.filter((l) => l.state === "COMPLETED").length, 0)}
                    /{path.chapters.reduce((n, c) => n + c.lessons.length, 0)} Lektionen
                  </Badge>
                )}
              </div>

              <CardContent className="space-y-6 p-6">
                {!path || !path.enrollment ? (
                  <p className="text-sm text-muted-foreground">You are not enrolled in this level yet.</p>
                ) : (
                  path.chapters.map((chapter, ci) => (
                    <section key={chapter.id}>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${chapter.lessonsOpen ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                          {ci + 1}
                        </span>
                        <h3 className="font-semibold">{chapter.titleDe}</h3>
                        <span className="text-sm text-muted-foreground hidden sm:inline">·</span>
                        <span className="text-sm text-muted-foreground hidden sm:inline">{chapter.title}</span>
                        {!chapter.lessonsOpen && (
                          <Badge variant="muted" className="ms-auto gap-1"><Lock className="h-3 w-3" /> Vorherige Prüfung bestehen</Badge>
                        )}
                      </div>

                      <ol className="relative space-y-2 ps-0">
                        {/* Lessons */}
                        {chapter.lessons.map((lesson, li) => (
                          <li key={lesson.id} className={chapter.lessonsOpen ? "" : "pointer-events-none opacity-60"}>
                            <Link
                              href={`/student/lessons/${lesson.id}`}
                              aria-disabled={!chapter.lessonsOpen || lesson.state === "LOCKED"}
                              className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${stateStyles[lesson.state]} ${lesson.state === "LOCKED" ? "cursor-not-allowed" : ""}`}
                            >
                              <StateIcon state={lesson.state} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{lesson.titleDe}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Lesson {li + 1}
                                  {lesson.state === "COMPLETED" ? " · Abgeschlossen" : lesson.state === "IN_PROGRESS" ? " · Weitermachen" : lesson.state === "AVAILABLE" ? ` · ${lesson.durationMinutes} Min.` : ""}
                                </p>
                              </div>
                              <div className="hidden shrink-0 gap-1 sm:flex">
                                {lesson.quizPassed && <Badge variant="success">Quiz ✓</Badge>}
                                {lesson.homeworkSubmitted && <Badge variant="success">HW ✓</Badge>}
                              </div>
                              {lesson.state === "IN_PROGRESS" && <ArrowRight className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" aria-hidden />}
                            </Link>
                          </li>
                        ))}

                        {/* Chapter exam row */}
                        <li className={chapter.lessonsOpen ? "" : "pointer-events-none opacity-60"}>
                          {chapter.examPassed ? (
                            <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 px-4 py-3">
                              <ClipboardCheck className="h-5 w-5 text-success" aria-hidden />
                              <p className="flex-1 text-sm font-medium">Kapitelprüfung bestanden</p>
                              <Badge variant="success">✓</Badge>
                            </div>
                          ) : chapter.examUnlocked && chapter.lessonsOpen ? (
                            <Link
                              href={`/student/exams/chapter/${chapter.id}`}
                              className="flex items-center gap-3 rounded-lg border border-accent/50 bg-accent/5 px-4 py-3 transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <ClipboardCheck className="h-5 w-5 text-accent" aria-hidden />
                              <p className="flex-1 text-sm font-medium">Kapitelprüfung bereit</p>
                              <Badge variant="accent">Bestehensgrenze {PROGRESSION.examPassPercent}%</Badge>
                              <ArrowRight className="h-4 w-4 text-accent rtl:rotate-180" aria-hidden />
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 opacity-75">
                              <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                              <p className="flex-1 text-sm text-muted-foreground">Die Kapitelprüfung wird frei, wenn alle Lektionen abgeschlossen sind.</p>
                            </div>
                          )}
                        </li>
                      </ol>
                    </section>
                  ))
                )}

                {/* Final exam */}
                {path?.finalExam && (
                  <section className="rounded-lg border border-dashed border-primary/40 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Award className={`h-5 w-5 ${path.finalExam.passed ? "text-success" : path.finalExam.unlocked ? "text-accent" : "text-muted-foreground"}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Abschlussprüfung ({currentCode})</p>
                        <p className="text-xs text-muted-foreground">
                          {path.finalExam.passed
                            ? "Bestanden – Zertifikat ausgestellt."
                            : path.finalExam.unlocked
                              ? "Zugelassen: Alle Kapitelprüfungen bestanden. Mit Prüfungsaufsicht."
                              : "Wird frei, sobald alle Kapitelprüfungen bestanden sind."}
                        </p>
                      </div>
                      {path.finalExam.unlocked && !path.finalExam.passed && (
                        <Button size="sm" asChild><Link href="/student/exams">Prüfung planen</Link></Button>
                      )}
                    </div>
                  </section>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function isFutureLevel(code: string, current: string): boolean {
  return CEFR_LEVELS.indexOf(code as CefrCode) > CEFR_LEVELS.indexOf(current as CefrCode);
}

function StateIcon({ state }: { state: string }) {
  switch (state) {
    case "COMPLETED": return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />;
    case "IN_PROGRESS": return <Play className="h-5 w-5 shrink-0 text-primary" aria-hidden />;
    case "AVAILABLE": return <CircleDot className="h-5 w-5 shrink-0 text-primary/60" aria-hidden />;
    default: return <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
}

function LevelRow({ code, state }: { code: string; state: "COMPLETED" | "IN_PROGRESS" | "LOCKED" }) {
  const titles: Record<string, string> = {
    A1: LEVEL_TITLES.A1, A2: LEVEL_TITLES.A2, B1: LEVEL_TITLES.B1,
    B2: LEVEL_TITLES.B2, C1: LEVEL_TITLES.C1, C2: LEVEL_TITLES.C2,
  };
  return (
    <Card className={`${state === "COMPLETED" ? "border-success/30" : ""}`}>
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${
          state === "COMPLETED" ? "bg-success/15 text-success" : state === "LOCKED" ? "bg-muted text-muted-foreground" : "bg-primary text-white"
        }`}>
          {code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{titles[code]}</p>
          <p className="text-sm text-muted-foreground">
            {state === "COMPLETED" ? "Abgeschlossen – Zertifikat erhalten" : state === "LOCKED" ? "Vorheriges Niveau abschließen, um freizuschalten" : "Laufend"}
          </p>
        </div>
        {state === "COMPLETED" ? (
          <BookOpenCheck className="h-5 w-5 text-success" aria-hidden />
        ) : state === "LOCKED" ? (
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : null}
      </CardContent>
    </Card>
  );
}
