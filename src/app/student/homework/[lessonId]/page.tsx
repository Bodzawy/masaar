import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { assertLessonAccess } from "@/domain/progression";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { HomeworkForm, type SubmissionView } from "@/components/student/homework-form";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Homework task" };

type Exercises = Array<{ id: string; prompt: string; sampleAnswer?: string }>;

export default async function HomeworkPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await requireRole("STUDENT");
  const { lessonId } = await params;

  const access = await assertLessonAccess(session.userId, lessonId);
  if (!access.ok) {
    return (
      <div className="container max-w-lg py-24 text-center">
        <h1 className="text-xl font-semibold">Homework locked</h1>
        <p className="mt-2 text-sm text-muted-foreground">This homework belongs to a lesson you have not unlocked yet.</p>
        <Button className="mt-4" asChild><Link href="/student/learning-path">Back to my path</Link></Button>
      </div>
    );
  }
  const lesson = access.lesson;

  const homework = await db.homework.findUnique({ where: { lessonId } });
  if (!homework) notFound();

  const submission = await db.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId: homework.id, studentId: session.userId } },
    include: { feedback: true },
  });

  const initial: SubmissionView = submission
    ? {
        status: submission.status as SubmissionView["status"],
        writingText: submission.writingText,
        answers: (submission.answers as Record<string, string> | null) ?? {},
        recordingMeta: submission.recordingMeta as SubmissionView["recordingMeta"],
        feedback: submission.feedback
          ? {
              score: submission.feedback.score,
              feedbackText: submission.feedback.feedbackText,
              corrections: (submission.feedback.corrections as Array<{ excerpt: string; comment: string }> | null) ?? [],
              recommendedPractice: submission.feedback.recommendedPractice,
              gradedAt: submission.feedback.gradedAt.toISOString(),
            }
          : null,
      }
    : { status: "DRAFT", writingText: null, answers: {}, recordingMeta: null };

  return (
    <div className="container max-w-6xl space-y-6 py-2 animate-fade-in">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href={`/student/lessons/${lesson.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden /> {lesson.titleDe}
        </Link>
      </nav>
      <HomeworkForm
        homework={{
          id: homework.id,
          title: homework.title,
          instructions: homework.instructions,
          writingPrompt: homework.writingPrompt,
          exercises: (homework.exercises as Exercises | null) ?? [],
          maxScore: homework.maxScore,
        }}
        lessonTitle={lesson.title}
        initial={initial}
      />
    </div>
  );
}
