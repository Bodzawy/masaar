import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CEFR_LEVELS, LEVEL_TITLES } from "@/config/domain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LibraryBig, ChevronRight, Lock } from "lucide-react";

export const metadata = { title: "Curriculum" };

export default async function CurriculumPage() {
  const session = await requireRole("ACADEMIC_ADMIN", "SUPER_ADMIN");
  const levels = await db.level.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      chapters: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              _count: { select: { objectives: true, materials: true } },
              quiz: { include: { _count: { select: { questions: true } } } },
            },
          },
          chapterExam: true,
        },
      },
    },
  });

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Curriculum</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Die plattform-eigene Lernfolge. Bearbeitung nur durch Academic Admins ({session.role}).
        </p>
      </header>

      <div className="space-y-4">
        {CEFR_LEVELS.map((code) => {
          const level = levels.find((l) => l.code === code);
          if (!level) return null;
          const lessonCount = level.chapters.reduce((n, c) => n + c.lessons.length, 0);
          return (
            <Card key={level.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{code}</span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{LEVEL_TITLES[code]}</CardTitle>
                    <CardDescription>{lessonCount} Lektionen · {level.chapters.length} Kapitel</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {level.chapters.map((ch) => (
                    <li key={ch.id} className="rounded-md border border-border px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <LibraryBig className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        <span className="text-sm font-medium">{ch.titleDe}</span>
                        {ch.chapterExam ? <Badge variant="secondary">exam</Badge> : <Badge variant="muted"><Lock className="me-1 h-3 w-3" />keine Prüfung</Badge>}
                      </div>
                      <ul className="mt-1 space-y-0.5 ps-5">
                        {ch.lessons.map((l) => (
                          <li key={l.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                            <span>{l.orderIndex}. {l.titleDe}</span>
                            <span>· {l._count.objectives} objectives</span>
                            {l.quiz ? <Badge variant="outline">{l.quiz._count.questions} questions</Badge> : <Badge variant="muted">no quiz</Badge>}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <Link href="#" className="mt-3 inline-block text-xs font-medium text-primary hover:underline" aria-disabled>
                  Inhalt bearbeiten (Editor folgt in einer nächsten Iteration)
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
