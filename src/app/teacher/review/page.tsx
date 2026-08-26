import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";

export const metadata = { title: "Hausaufgaben korrigieren" };

export default async function ReviewQueuePage() {
  const session = await requireRole("TEACHER");

  // Submissions for homework of lessons this teacher has taught
  const taughtLessons = await db.booking.findMany({
    where: { teacherId: session.userId },
    select: { lessonId: true },
    distinct: ["lessonId"],
  });
  const lessonIds = taughtLessons.map((b) => b.lessonId);

  const submissions = await db.homeworkSubmission.findMany({
    where: { status: { in: ["SUBMITTED", "RETURNED"] }, homework: { lessonId: { in: lessonIds } } },
    orderBy: { submittedAt: "desc" },
    include: { student: true, homework: { include: { lesson: true } } },
  });

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Hausaufgaben korrigieren</h1>
        <p className="mt-1 text-sm text-muted-foreground">Eingereichte Hausaufgaben warten auf deine Korrektur.</p>
      </header>

      {submissions.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center p-10 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">Warteschlange leer</p>
          <p className="mt-1 text-sm text-muted-foreground">Neue Abgaben erscheinen hier automatisch.</p>
        </CardContent></Card>
      ) : (
        <ul className="space-y-2.5">
          {submissions.map((sub) => (
            <li key={sub.id}>
              <Link href={`/teacher/review/${sub.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{sub.student.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{sub.homework.lesson.titleDe} — {sub.homework.title}</p>
                </div>
                <Badge variant={sub.status === "SUBMITTED" ? "warning" : "accent"}>
                  {sub.status === "SUBMITTED" ? "Wartet auf Korrektur" : "Zurückgegeben"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
