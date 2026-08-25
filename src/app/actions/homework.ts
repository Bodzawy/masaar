"use server";
// Homework: student drafts/submissions + teacher grading.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { recomputeAndAdvance, updateLevelCompletionPercent } from "@/domain/progression";

const submitSchema = z.object({
  homeworkId: z.string(),
  writingText: z.string().max(8000).optional(),
  answers: z.record(z.string(), z.string().max(2000)).optional(),
  recordingMeta: z
    .object({
      fileName: z.string().max(120),
      mimeType: z.string().regex(/^(audio\/(webm|mp4|mpeg|wav|ogg))$/, "Only audio files are allowed"),
      sizeBytes: z.number().int().min(0).max(10 * 1024 * 1024), // ≤ 10 MB
      durationSec: z.number().int().min(0).max(600),
    })
    .optional(),
});

export async function saveHomework(input: unknown, submit: boolean) {
  const session = await requireRole("STUDENT");
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const homework = await db.homework.findUnique({ where: { id: d.homeworkId }, include: { lesson: { include: { chapter: true } } } });
  if (!homework) return { ok: false as const, error: "Homework not found" };

  if (submit) {
    if (!d.writingText || d.writingText.trim().length < 20) {
      return { ok: false as const, error: "Please write at least a few sentences before submitting." };
    }
    // Lesson must be unlocked for this student (attendance/sequence enforced elsewhere)
    const progress = await db.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: session.userId, lessonId: homework.lessonId } },
    });
    if (!progress || progress.status === "LOCKED") return { ok: false as const, error: "This homework is locked." };
  }

  const existing = await db.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId: d.homeworkId, studentId: session.userId } },
  });
  if (existing?.status === "GRADED" && !submit) return { ok: false as const, error: "Already graded." };

  const data = {
    status: (submit ? "SUBMITTED" : "DRAFT") as "SUBMITTED" | "DRAFT",
    writingText: d.writingText ?? existing?.writingText ?? null,
    answers: (d.answers ?? (existing?.answers as Record<string, string> | null)) ?? {},
    recordingMeta: d.recordingMeta ?? (existing?.recordingMeta as never) ?? undefined,
    submittedAt: submit ? new Date() : existing?.submittedAt ?? null,
  };

  if (existing) {
    if (existing.status === "SUBMITTED" && !submit) return { ok: false as const, error: "Already submitted — wait for grading." };
    await db.homeworkSubmission.update({ where: { id: existing.id }, data });
  } else {
    await db.homeworkSubmission.create({ data: { homeworkId: d.homeworkId, studentId: session.userId, ...data } });
  }

  if (submit) {
    await db.lessonProgress.updateMany({
      where: { studentId: session.userId, lessonId: homework.lessonId },
      data: { homeworkSubmitted: true },
    });
    // Homework may be the final requirement — recompute completion & unlock next.
    const advancement = await recomputeAndAdvance(session.userId, homework.lessonId);
    const levelCode = (
      await db.level.findFirst({ where: { chapters: { some: { lessons: { some: { id: homework.lessonId } } } } }, select: { code: true } })
    )?.code;
    if (levelCode) await updateLevelCompletionPercent(session.userId, levelCode);
    void advancement;
    // Notify teachers who taught this student
    const pastTeacher = await db.booking.findFirst({
      where: { studentId: session.userId, status: "COMPLETED" },
      orderBy: { scheduledAt: "desc" },
      select: { teacherId: true },
    });
    if (pastTeacher) {
      await db.notification.create({
        data: { userId: pastTeacher.teacherId, type: "homework_feedback", titleKey: `New homework submission in ${homework.lesson.title}`, link: "/teacher/review" },
      });
    }
  }
  revalidatePath("/student/homework");
  return { ok: true as const };
}

export async function gradeHomework(input: {
  submissionId: string;
  score: number;
  feedbackText: string;
  corrections?: Array<{ excerpt: string; comment: string }>;
  recommendedPractice?: string;
}) {
  const session = await requireRole("TEACHER");
  const schema = z.object({
    submissionId: z.string(),
    score: z.number().int().min(0).max(100),
    feedbackText: z.string().min(5),
    corrections: z.array(z.object({ excerpt: z.string().max(300), comment: z.string().max(500) })).max(20).optional(),
    recommendedPractice: z.string().max(1000).optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const submission = await db.homeworkSubmission.findUnique({
    where: { id: input.submissionId },
    include: { homework: { include: { lesson: true } } },
  });
  if (!submission) return { ok: false as const, error: "Submission not found" };

  await db.$transaction(async (tx) => {
    await tx.homeworkFeedback.upsert({
      where: { submissionId: submission.id },
      create: {
        submissionId: submission.id,
        graderId: session.userId,
        score: parsed.data.score,
        feedbackText: parsed.data.feedbackText,
        corrections: parsed.data.corrections ?? [],
        recommendedPractice: parsed.data.recommendedPractice ?? null,
      },
      update: {
        graderId: session.userId,
        score: parsed.data.score,
        feedbackText: parsed.data.feedbackText,
        corrections: parsed.data.corrections ?? [],
        recommendedPractice: parsed.data.recommendedPractice ?? null,
      },
    });
    await tx.homeworkSubmission.update({ where: { id: submission.id }, data: { status: "GRADED" } });
    await tx.notification.create({
      data: { userId: submission.studentId, type: "homework_feedback", titleKey: `Homework graded: ${submission.homework.lesson.title} (${parsed.data.score}%)`, link: "/student/homework" },
    });
  });
  revalidatePath("/teacher/review");
  return { ok: true as const };
}

export async function addTeacherNote(studentId: string, body: string, bookingId?: string) {
  const session = await requireRole("TEACHER");
  if (body.trim().length < 3) return { ok: false as const, error: "Note is too short." };
  await db.teacherNote.create({ data: { authorId: session.userId, studentId, body: body.trim(), bookingId: bookingId ?? null } });
  revalidatePath(`/teacher/students/${studentId}`);
  return { ok: true as const };
}
