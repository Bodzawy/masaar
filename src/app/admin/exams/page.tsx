import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookMarked, ShieldAlert, Percent } from "lucide-react";

export const metadata = { title: "Exams" };

export default async function AdminExamsPage() {
  await requireRole("ACADEMIC_ADMIN", "SUPER_ADMIN");
  const [chapterExams, levelExams, attempts] = await Promise.all([
    db.chapterExam.findMany({ include: { chapter: { include: { level: true } }, quiz: { include: { _count: { select: { questions: true } } } }, _count: { select: { attempts: true } } } }),
    db.levelExam.findMany({ include: { quiz: { include: { _count: { select: { questions: true } } } }, level: true, _count: { select: { attempts: true } } } }),
    db.examAttempt.groupBy({ by: ["kind", "passed"], _count: { _all: true } }),
  ]);
  const rateFor = (kind: string) => {
    const rows = attempts.filter((a) => a.kind === kind);
    const passed = rows.filter((r) => r.passed).reduce((n, r) => n + r._count._all, 0);
    const total = rows.reduce((n, r) => n + r._count._all, 0);
    return total ? Math.round((passed / total) * 100) : null;
  };

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Exams</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assessment configuration and pass-rate monitoring.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="flex items-center justify-between p-5">
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><Percent className="h-4 w-4" aria-hidden /> Chapter pass rate</span>
          <span className="text-2xl font-semibold tabular-nums">{rateFor("CHAPTER") ?? "—"}%</span>
        </CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-5">
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldAlert className="h-4 w-4" aria-hidden /> Final pass rate</span>
          <span className="text-2xl font-semibold tabular-nums">{rateFor("LEVEL_FINAL") ?? "—"}%</span>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BookMarked className="h-4 w-4 text-primary" aria-hidden /> Configured exams</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {chapterExams.map((ce) => (
              <li key={ce.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 odd:bg-muted/60">
                <span className="min-w-0 flex-1 truncate">{ce.chapter.level.code} · {ce.chapter.titleDe} — chapter exam</span>
                <Badge variant="secondary">{ce.quiz._count.questions} questions</Badge>
                <Badge variant="muted">pass {ce.passScore}%</Badge>
                <span className="text-xs text-muted-foreground">{ce._count.attempts} attempts</span>
              </li>
            ))}
            {levelExams.map((le) => (
              <li key={le.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 odd:bg-muted/60">
                <span className="min-w-0 flex-1 truncate">{le.level.code} — final exam</span>
                <Badge variant="secondary">{le.quiz._count.questions} questions</Badge>
                <Badge variant="accent">proctoring required</Badge>
                <span className="text-xs text-muted-foreground">{le._count.attempts} attempts</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
