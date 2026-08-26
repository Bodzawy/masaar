import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { assertChapterExamAccess } from "@/domain/progression";
import { db } from "@/lib/db";
import { getOrCreateAttempt } from "@/app/actions/quiz";
import { QuizRunner } from "@/components/student/quiz-runner";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";

export const metadata = { title: "Chapter exam" };

export default async function ChapterExamPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const session = await requireRole("STUDENT");
  const { chapterId } = await params;

  const access = await assertChapterExamAccess(session.userId, chapterId);
  if (!access.ok) {
    return (
      <div className="container max-w-lg py-24 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Lock className="h-6 w-6 text-muted-foreground" aria-hidden /></span>
        <h1 className="mt-4 text-xl font-semibold">Kapitelprüfung gesperrt</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {access.reason === "NOT_ENROLLED"
            ? "Enroll in this level first."
            : access.reason === "PREVIOUS_CHAPTER_EXAM"
              ? "Pass the previous chapter exam to open this one."
              : "Complete every lesson in this chapter to unlock its exam."}
        </p>
        <Button className="mt-6" asChild><Link href="/student/learning-path">Zurück zum Lernweg</Link></Button>
      </div>
    );
  }

  const chapterExam = await db.chapterExam.findUnique({
    where: { chapterId },
    include: {
      quiz: { include: { questions: { orderBy: { orderIndex: "asc" }, include: { options: { orderBy: { orderIndex: "asc" } } } } } },
      chapter: true,
    },
  });
  if (!chapterExam) notFound();

  const attempt = await getOrCreateAttempt(chapterExam.quiz.id);
  const initialAnswers: Record<string, string> = {};
  for (const a of attempt.answers) if (a.optionId) initialAnswers[a.questionId] = a.optionId;

  return (
    <div className="container py-6 animate-fade-in">
      <nav className="mx-auto mb-4 max-w-3xl text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/student/learning-path" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden /> {chapterExam.chapter.titleDe} – Kapitelprüfung
        </Link>
      </nav>
      <QuizRunner
        attemptId={attempt.id}
        passScore={chapterExam.passScore}
        questions={chapterExam.quiz.questions.map((q) => ({
          id: q.id, skill: q.skill, prompt: q.prompt, context: q.context,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        }))}
        initialAnswers={initialAnswers}
      />
    </div>
  );
}
