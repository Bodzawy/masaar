"use server";
// Quiz engine: start/autosave/submit with server-side scoring + progression.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { assertLessonAccess, assertChapterExamAccess, assertLevelExamAccess, recomputeAndAdvance, updateLevelCompletionPercent } from "@/domain/progression";
import { computeQuizScore } from "@/domain/rules";

export async function getOrCreateAttempt(quizId: string) {
  const session = await requireRole("STUDENT");
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      lesson: { include: { chapter: true } },
      chapterExamRef: { include: { chapter: true } },
      levelExamRef: true,
    },
  });
  if (!quiz) throw new Error("Quiz not found");

  if (quiz.lessonId && quiz.lesson) {
    const access = await assertLessonAccess(session.userId, quiz.lesson.id);
    if (!access.ok) throw new Error("LESSON_LOCKED");
  } else if (quiz.chapterExamRef) {
    const access = await assertChapterExamAccess(session.userId, quiz.chapterExamRef.chapterId);
    if (!access.ok) throw new Error("EXAM_LOCKED");
  } else if (quiz.levelExamRef) {
    const access = await assertLevelExamAccess(session.userId, quiz.levelExamRef.levelId);
    if (!access.ok) throw new Error("EXAM_LOCKED");
  }

  // Reuse open attempt or create one
  let attempt = await db.quizAttempt.findFirst({
    where: { quizId, studentId: session.userId, status: "IN_PROGRESS" },
    include: { answers: true },
  });
  if (!attempt) {
    attempt = await db.quizAttempt.create({
      data: { quizId, studentId: session.userId },
      include: { answers: true },
    });
  }
  return attempt;
}

export async function autosaveAnswer(attemptId: string, questionId: string, optionId: string | null) {
  const session = await requireRole("STUDENT");
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== session.userId) throw new Error("FORBIDDEN");
  if (attempt.status !== "IN_PROGRESS") return;
  // Verify the question belongs to the attempt's quiz
  const q = await db.question.findFirst({ where: { id: questionId, quizId: attempt.quizId } });
  if (!q) throw new Error("Invalid question");
  if (optionId) {
    const opt = await db.questionOption.findFirst({ where: { id: optionId, questionId } });
    if (!opt) throw new Error("Invalid option");
  }
  await db.quizAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    create: { attemptId, questionId, optionId },
    update: { optionId, savedAt: new Date() },
  });
  await db.quizAttempt.update({ where: { id: attemptId }, data: { autoSavedAt: new Date() } });
}

/** Server-side scoring. Returns score and updates progression atomically. */
export async function submitQuiz(attemptId: string): Promise<{
  ok: boolean; error?: string; score?: number; passed?: boolean; correctCount?: number; total?: number;
}> {
  const session = await requireRole("STUDENT");
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { include: { questions: { include: { options: true }, orderBy: { orderIndex: "asc" } }, lesson: { include: { chapter: true } }, chapterExamRef: true, levelExamRef: true } },
      answers: true,
    },
  });
  if (!attempt || attempt.studentId !== session.userId) return { ok: false, error: "FORBIDDEN" };
  if (attempt.status !== "IN_PROGRESS") return { ok: false, error: "Already submitted" };

  const answers: Record<string, string | null> = {};
  for (const a of attempt.answers) answers[a.questionId] = a.optionId;
  const { score, passed, correctCount: correct, total } = computeQuizScore(
    attempt.quiz.questions.map((q) => ({ id: q.id, points: q.points, options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })) })),
    answers,
    attempt.quiz.passScore
  );

  // Transaction: finalize attempt + progression effects
  await db.$transaction(async (tx) => {
    await tx.quizAttempt.update({
      where: { id: attempt.id },
      data: { status: passed ? "PASSED" : "FAILED", score, passed, submittedAt: new Date() },
    });

    if (attempt.quiz.lessonId) {
      const best = await tx.lessonProgress.findUnique({
        where: { studentId_lessonId: { studentId: session.userId, lessonId: attempt.quiz.lessonId! } },
      });
      const newBest = Math.max(best?.quizBestScore ?? 0, score);
      await tx.lessonProgress.updateMany({
        where: { studentId: session.userId, lessonId: attempt.quiz.lessonId! },
        data: { quizBestScore: newBest, quizPassed: (best?.quizPassed ?? false) || passed },
      });
    } else if (attempt.quiz.chapterExamRef) {
      await tx.examAttempt.create({
        data: {
          kind: "CHAPTER",
          studentId: session.userId,
          chapterExamId: attempt.quiz.chapterExamRef.id,
          quizAttemptId: attempt.id,
          status: passed ? "PASSED" : "FAILED",
          score,
          passed,
          decidedAt: new Date(),
        },
      });
    } else if (attempt.quiz.levelExamRef) {
      await tx.examAttempt.create({
        data: {
          kind: "LEVEL_FINAL",
          studentId: session.userId,
          levelExamId: attempt.quiz.levelExamRef.id,
          quizAttemptId: attempt.id,
          status: passed ? "PASSED" : "FAILED",
          score,
          passed,
          proctoringChecks: { mode: "demo", identity: "placeholder", recordingStored: false },
          decidedAt: new Date(),
        },
      });
    }
  });

  // Progression side effects outside the scoring tx but still server-authoritative
  if (attempt.quiz.lessonId) {
    await recomputeAndAdvance(session.userId, attempt.quiz.lessonId);
    const levelCode = attempt.quiz.lesson?.chapter?.levelId
      ? (await db.level.findFirst({ where: { chapters: { some: { id: attempt.quiz.lesson!.chapter!.id } } } }))?.code
      : null;
    if (levelCode) await updateLevelCompletionPercent(session.userId, levelCode);
  } else if (attempt.quiz.chapterExamRef) {
    const level = await db.level.findFirst({ where: { chapters: { some: { id: attempt.quiz.chapterExamRef.chapterId } } } });
    if (level) await updateLevelCompletionPercent(session.userId, level.code);
  } else if (attempt.quiz.levelExamRef && passed) {
    // Level completion → enrollment completed + certificate issuance boundary.
    const levelExam = attempt.quiz.levelExamRef;
    const examAttemptRow = await db.examAttempt.findFirst({ where: { quizAttemptId: attempt.id } });
    await issueCertificateIfEligible(session.userId, levelExam.levelId, score, examAttemptRow?.id ?? null);
  }

  revalidatePath("/student");
  revalidatePath("/student/learning-path");
  return { ok: true, score, passed, correctCount: correct, total };
}

async function issueCertificateIfEligible(studentId: string, levelId: string, score: number, examAttemptId: string | null) {
  const existing = await db.certificate.findFirst({ where: { studentId, levelId } });
  if (existing) return;
  const [user, level] = await Promise.all([
    db.user.findUnique({ where: { id: studentId } }),
    db.level.findUnique({ where: { id: levelId } }),
  ]);
  if (!user || !level) return;
  const serialNumber = `CERT-${Math.floor(100000 + Math.random() * 899999)}`;
  const { createHash } = await import("node:crypto");
  const vhash = createHash("sha256").update(`${serialNumber}|${user.name}|${level.code}|${score}`).digest("hex").slice(0, 32);
  const cert = await db.certificate.create({
    data: {
      serial: serialNumber, studentId, levelId, score,
      expiresAt: new Date(Date.now() + 3 * 365 * 86_400_000),
      verificationHash: vhash, examAttemptId,
    },
  });
  if (examAttemptId) {
    await db.examAttempt.update({ where: { id: examAttemptId }, data: { certificateId: cert.id } });
  }
  await db.enrollment.updateMany({ where: { studentId, levelId, status: "ACTIVE" }, data: { status: "COMPLETED", completedAt: new Date() } });
  await db.notification.create({
    data: { userId: studentId, type: "system", titleKey: `Certificate issued: ${level.code} (${serialNumber})`, link: `/verify/${serialNumber}` },
  });
}
