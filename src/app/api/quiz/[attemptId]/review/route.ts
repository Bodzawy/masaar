import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Correction view for a submitted attempt — only visible to its owner and
// only after submission (never exposes correct options during the quiz).
export async function GET(_req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { attemptId } = await params;

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { include: { questions: { orderBy: { orderIndex: "asc" }, include: { options: true } } } },
      answers: true,
    },
  });
  if (!attempt || attempt.studentId !== session.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (attempt.status === "IN_PROGRESS") return NextResponse.json({ error: "Not submitted yet" }, { status: 409 });

  const review = attempt.quiz.questions.map((q) => {
    const chosenId = attempt.answers.find((a) => a.questionId === q.id)?.optionId ?? null;
    const correctOpt = q.options.find((o) => o.isCorrect)!;
    const chosenOpt = q.options.find((o) => o.id === chosenId) ?? null;
    return {
      questionId: q.id,
      prompt: q.prompt,
      skill: q.skill,
      chosenText: chosenOpt?.text ?? null,
      correctText: correctOpt.text,
      explanation: q.explanation,
      wasCorrect: chosenOpt?.isCorrect ?? false,
    };
  });
  const weakSkills = [...new Set(review.filter((r) => !r.wasCorrect).map((r) => r.skill))];

  let nextHref: string | undefined;
  if (attempt.quiz.lessonId && attempt.passed) {
    const lesson = await db.lesson.findUnique({ where: { id: attempt.quiz.lessonId! }, include: { chapter: { include: { lessons: true } } } });
    if (lesson) {
      nextHref = `/student/homework/${lesson.id}`;
    }
  }

  return NextResponse.json({ score: attempt.score, passed: attempt.passed, weakSkills, review, nextHref });
}
