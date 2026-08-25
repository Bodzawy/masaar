import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { GradeForm } from "@/components/teacher/grade-form";

export const metadata = { title: "Grade submission" };

export default async function GradePage({ params }: { params: Promise<{ submissionId: string }> }) {
  await requireRole("TEACHER");
  const { submissionId } = await params;

  const submission = await db.homeworkSubmission.findUnique({
    where: { id: submissionId },
    include: {
      student: true,
      homework: { include: { lesson: true } },
      feedback: true,
    },
  });
  if (!submission) notFound();

  return (
    <div className="container max-w-6xl space-y-4 py-2 animate-fade-in">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/teacher/review" className="hover:text-foreground">← Review queue</Link>
      </nav>
      <GradeForm
        submissionId={submission.id}
        studentName={submission.student.name}
        lessonTitle={submission.homework.lesson.titleDe}
        writingText={submission.writingText}
        answers={(submission.answers as Record<string, string> | null) ?? {}}
        recordingMeta={submission.recordingMeta as { fileName?: string } | null}
        maxScore={submission.homework.maxScore}
      />
    </div>
  );
}
