import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { assertLessonAccess } from "@/domain/progression";
import { db } from "@/lib/db";
import { getOrCreateAttempt } from "@/app/actions/quiz";
import { QuizRunner } from "@/components/student/quiz-runner";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";

export const metadata = { title: "Lektions-Quiz" };

export default async function LessonQuizPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await requireRole("STUDENT");
  const { lessonId } = await params;

  const access = await assertLessonAccess(session.userId, lessonId);
  if (!access.ok) {
    if (access.reason === "NOT_FOUND") notFound();
    return (
      <div className="container max-w-lg py-24 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Lock className="h-6 w-6 text-muted-foreground" aria-hidden /></span>
        <h1 className="mt-4 text-xl font-semibold">Quiz gesperrt</h1>
        <p className="mt-2 text-sm text-muted-foreground">Vervollständige zuerst die vorherigen Schritte dieser Lektion.</p>
        <Button className="mt-6" asChild><Link href={`/student/lessons/${lessonId}`}>Zurück zur Lektion</Link></Button>
      </div>
    );
  }

  const quiz = await db.quiz.findUnique({
    where: { lessonId },
    include: {
      questions: { orderBy: { orderIndex: "asc" }, include: { options: { orderBy: { orderIndex: "asc" } } } },
    },
  });
  if (!quiz) notFound();

  // Neuer Versuch bzw. Fortsetzung eines offenen Versuchs (Antworten werden serverseitig gespeichert)
  const attempt = await getOrCreateAttempt(quiz.id);
  const initialAnswers: Record<string, string> = {};
  for (const a of attempt.answers) if (a.optionId) initialAnswers[a.questionId] = a.optionId;

  return (
    <div className="container py-6 animate-fade-in">
      <nav className="mx-auto mb-4 max-w-3xl text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/student/lessons/${lessonId}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden /> Zurück zur Lektion
        </Link>
      </nav>
      <QuizRunner
        attemptId={attempt.id}
        passScore={quiz.passScore}
        questions={quiz.questions.map((q) => ({
          id: q.id, skill: q.skill, prompt: q.prompt, context: q.context,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        }))}
        initialAnswers={initialAnswers}
      />
    </div>
  );
}
