"use server";
// Post-lesson flow: ratings, reports (case lifecycle), retake requests.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { generateCaseId } from "@/domain/certificates";

const ratingSchema = z.object({
  bookingId: z.string().min(1),
  overall: z.number().int().min(1).max(5),
  explanation: z.number().int().min(1).max(5),
  languageClarity: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5),
  interaction: z.number().int().min(1).max(5),
  patience: z.number().int().min(1).max(5),
  technicalQuality: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function submitRating(input: unknown) {
  const session = await requireRole("STUDENT");
  const parsed = ratingSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid rating data" };
  const data = parsed.data;

  const booking = await db.booking.findUnique({ where: { id: data.bookingId }, include: { rating: true } });
  if (!booking || booking.studentId !== session.userId) return { ok: false as const, error: "Booking not found" };
  if (booking.status !== "COMPLETED") return { ok: false as const, error: "You can rate after the lesson is completed." };
  if (booking.rating) return { ok: false as const, error: "This lesson was already rated." };
  if (data.overall <= 2 && (!data.comment || data.comment.trim().length < 10)) {
    return { ok: false as const, error: "Please describe what happened (at least 10 characters)." };
  }

  await db.teacherRating.create({
    data: {
      bookingId: booking.id, studentId: session.userId, teacherId: booking.teacherId,
      overall: data.overall, explanation: data.explanation, languageClarity: data.languageClarity,
      punctuality: data.punctuality, interaction: data.interaction, patience: data.patience,
      technicalQuality: data.technicalQuality, comment: data.comment ?? null,
    },
  });
  revalidatePath(`/student/post-lesson/${data.bookingId}`);
  return { ok: true as const };
}

export async function reportTeacher(input: { bookingId: string; reason: string; description: string }) {
  const session = await requireRole("STUDENT");
  const schema = z.object({
    bookingId: z.string(),
    reason: z.enum(["INAPPROPRIATE_CONDUCT", "MISSED_OR_SHORTENED_LESSON", "UNPREPARED_TEACHER", "PAYMENT_DISPUTE", "TECHNICAL_ABUSE", "OTHER"]),
    description: z.string().min(20, "Please describe the issue in at least 20 characters").max(2000),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking || booking.studentId !== session.userId) return { ok: false as const, error: "Booking not found" };

  const caseId = generateCaseId("RPT");
  await db.$transaction(async (tx) => {
    await tx.reportCase.create({
      data: {
        caseId,
        openedByStudentId: session.userId,
        teacherId: booking.teacherId,
        bookingId: booking.id,
        reason: parsed.data.reason,
        description: parsed.data.description,
        status: "OPEN",
        evidence: { create: { kind: "ATTENDANCE_RECORD", content: `Auto-attached attendance events for booking ${booking.id}`, meta: {} } },
        actions: { create: { actorId: session.userId, action: "CASE_OPENED", note: "Report created by student" } },
      },
    });
    // Notify moderators (all MODERATOR + SUPER_ADMIN)
    const mods = await tx.user.findMany({ where: { roleType: { in: ["MODERATOR", "SUPER_ADMIN"] } }, select: { id: true } });
    for (const m of mods) {
      await tx.notification.create({ data: { userId: m.id, type: "report_update", titleKey: `New case ${caseId} needs triage`, link: `/admin/reports` } });
    }
  });
  revalidatePath("/student/schedule");
  return { ok: true as const, caseId };
}

export async function requestRetake(input: { bookingId: string; lessonId: string; reason: string }) {
  const session = await requireRole("STUDENT");
  if (input.reason.trim().length < 20) return { ok: false as const, error: "Please explain the request in at least 20 characters." };

  const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking || booking.studentId !== session.userId) return { ok: false as const, error: "Booking not found" };
  if (input.lessonId !== booking.lessonId) return { ok: false as const, error: "Lesson mismatch." };

  const requestId = `RTK-${Math.floor(10000 + Math.random() * 89999)}`;
  await db.retakeRequest.create({
    data: {
      requestId,
      studentId: session.userId,
      teacherId: booking.teacherId,
      bookingId: booking.id,
      lessonId: input.lessonId,
      reason: input.reason.trim(),
      status: "PENDING",
      // creditReturned stays false — approval decision happens in moderation.
    },
  });
  const mgrs = await db.user.findMany({ where: { roleType: { in: ["TEACHER_MANAGER", "ACADEMIC_ADMIN"] } }, select: { id: true } });
  for (const m of mgrs) {
    await db.notification.create({ data: { userId: m.id, type: "system", titleKey: `Retake request ${requestId} pending review`, link: "/admin/retakes" } });
  }
  revalidatePath("/student/schedule");
  return { ok: true as const, requestId };
}
