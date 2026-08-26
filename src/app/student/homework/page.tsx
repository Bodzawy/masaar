import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotebookPen, ArrowRight } from "lucide-react";

export const metadata = { title: "Hausaufgaben" };

const STATUS_VARIANT = { DRAFT: "muted", SUBMITTED: "warning", GRADED: "success", RETURNED: "accent" } as const;

export default async function HomeworkListPage() {
  const session = await requireRole("STUDENT");

  const activeLevel = await db.enrollment.findFirst({
    where: { studentId: session.userId, status: "ACTIVE" },
    include: { level: { include: { chapters: { orderBy: { orderIndex: "asc" }, include: { lessons: { include: { homework: true } } } } } } },
  });

  const submissions = await db.homeworkSubmission.findMany({
    where: { studentId: session.userId },
    include: { feedback: true, homework: { include: { lesson: true } } },
  });
  const subByLesson = new Map(submissions.map((s) => [s.homework.lessonId, s]));

  const rows = (activeLevel?.level.chapters ?? []).flatMap((c) =>
    c.lessons
      .filter((l) => l.homework)
      .map((l) => ({ lesson: l, chapter: c, sub: subByLesson.get(l.id) }))
  );

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Hausaufgaben</h1>
        <p className="mt-1 text-sm text-muted-foreground">Schreibaufgaben und Übungen deines aktuellen Niveaus.</p>
      </header>

      {rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Noch keine Hausaufgaben – sie erscheinen mit den Schreibaufgaben deines Niveaus.</CardContent></Card>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ lesson, chapter, sub }) => {
            const locked = !sub && true; // lock state resolved on detail page; list shows status only
            void locked;
            const status = (sub?.status ?? "DRAFT") as keyof typeof STATUS_VARIANT;
            return (
              <li key={lesson.id}>
                <Link href={`/student/homework/${lesson.id}`} className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex flex-wrap items-center gap-3">
                    <NotebookPen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{lesson.homework!.title}</p>
                      <p className="text-xs text-muted-foreground">{chapter.titleDe} · {lesson.titleDe}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[status]}>{sub?.feedback ? `Korrigiert: ${sub.feedback.score}%` : status === "SUBMITTED" ? "Wartet auf Korrektur" : status === "RETURNED" ? "Zurückgegeben" : "Entwurf"}</Badge>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
