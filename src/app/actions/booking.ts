"use server";
// Booking actions — teacher discovery, instant/scheduled lessons, favorites.
// All authorization enforced here (server-authoritative).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { applyLedgerEntry, getBalance } from "@/domain/wallet";
import { BOOKING_RULES } from "@/config/domain";
import { isQualifiedForLevel } from "@/domain/matching";
import type { CefrCode } from "@/config/domain";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function bookLesson(input: {
  teacherId: string;
  lessonId: string;
  mode: "INSTANT" | "SCHEDULED";
  scheduledAt?: string;
}): Promise<ActionResult<{ bookingId: string }>> {
  const session = await requireRole("STUDENT");
  try {
    // Load student context
    const progress = await db.studentProgress.findFirst({
      where: { studentId: session.userId },
      orderBy: { updatedAt: "desc" },
    });
    const activeEnrollment = await db.enrollment.findFirst({
      where: { studentId: session.userId, status: "ACTIVE" },
      include: { level: true },
    });
    const levelCode = (progress?.levelCode ?? activeEnrollment?.level.code ?? "A1") as CefrCode;

    const lesson = await db.lesson.findUnique({
      where: { id: input.lessonId },
      include: { chapter: { include: { level: true } }, progress: { where: { studentId: session.userId } } },
    });
    if (!lesson) return { ok: false, error: "Lesson not found" };
    if (lesson.chapter.level.code !== levelCode) return { ok: false, error: "This lesson is not part of your current level." };

    const p = lesson.progress[0];
    if (!p || p.status === "LOCKED") return { ok: false, error: "This lesson is still locked. Complete previous lessons first." };
    if (p.status === "COMPLETED") return { ok: false, error: "This lesson is already completed." };

    const teacher = await db.user.findUnique({ where: { id: input.teacherId }, include: { teacherProfile: { include: { qualifications: true } } } });
    if (!teacher?.teacherProfile) return { ok: false, error: "Teacher not found" };
    if (!isQualifiedForLevel(teacher.teacherProfile.rank, levelCode)) {
      return { ok: false, error: "This teacher is not qualified to teach your current level." };
    }
    if (input.mode === "INSTANT" && !teacher.teacherProfile.isOnline) {
      return { ok: false, error: "Teacher is not online right now. Schedule a lesson instead." };
    }
    if (input.mode === "INSTANT" && teacher.teacherProfile.qualityState === "SUSPENDED") {
      return { ok: false, error: "Teacher is currently unavailable." };
    }

    // Credit check + deduction inside one transaction (idempotent via booking id later)
    const balance = await getBalance(session.userId);
    if (balance < 1) return { ok: false, error: "Not enough lesson credits. Visit Billing to top up." };

    const scheduledAt =
      input.mode === "INSTANT" ? new Date() : input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return { ok: false, error: "Invalid schedule time." };

    const booking = await db.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          studentId: session.userId,
          teacherId: teacher.id,
          lessonId: lesson.id,
          mode: input.mode,
          status: "SCHEDULED",
          scheduledAt,
          durationMinutes: BOOKING_RULES.instantLessonDurationMinutes,
          priceCents: teacher.teacherProfile!.hourlyRateCents,
        },
      });
      await applyLedgerEntry(tx, {
        studentId: session.userId,
        delta: -1,
        reason: "LESSON_BOOKING",
        refType: "booking",
        refId: b.id,
        idempotencyKey: `booking-${b.id}`,
      });
      await tx.notification.create({
        data: { userId: teacher.id, type: "booking", titleKey: `New ${input.mode === "INSTANT" ? "instant" : "scheduled"} lesson request`, link: "/teacher/upcoming" },
      });
      return b;
    });

    revalidatePath("/student");
    revalidatePath("/student/schedule");
    return { ok: true, data: { bookingId: booking.id } };
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") return { ok: false, error: "Not enough lesson credits." };
    console.error("bookLesson failed", e);
    return { ok: false, error: "Booking failed. Please try again." };
  }
}

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  const session = await requireRole("STUDENT");
  try {
    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.studentId !== session.userId) return { ok: false, error: "Booking not found" };
    if (booking.status !== "SCHEDULED") return { ok: false, error: "Only scheduled lessons can be cancelled." };

    const hoursUntilStart = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    const lateCancel = hoursUntilStart < BOOKING_RULES.lateCancelChargeThresholdHours;

    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED_BY_STUDENT", cancelReason: lateCancel ? "Late cancellation (<24h)" : "Cancelled by student" },
      });
      if (!lateCancel) {
        await applyLedgerEntry(tx, {
          studentId: session.userId, delta: +1, reason: "LESSON_REFUND_RETAKE" as never, refType: "booking", refId: bookingId,
          idempotencyKey: `cancel-refund-${bookingId}`,
        });
      }
      await tx.notification.create({
        data: { userId: booking.teacherId, type: "booking", titleKey: "A student cancelled a lesson", link: "/teacher/upcoming" },
      });
    });
    revalidatePath("/student/schedule");
    return lateCancel
      ? { ok: true, error: "CANCELLED_LATE_NO_REFUND" as unknown as undefined }
      : { ok: true };
  } catch {
    return { ok: false, error: "Cancellation failed." };
  }
}

export async function toggleFavorite(teacherId: string): Promise<ActionResult<{ favorite: boolean }>> {
  const session = await requireRole("STUDENT");
  try {
    const existing = await db.favoriteTeacher.findUnique({
      where: { studentId_teacherId: { studentId: session.userId, teacherId } },
    });
    if (existing) {
      await db.favoriteTeacher.delete({ where: { id: existing.id } });
      revalidatePath("/student/favorites");
      revalidatePath("/student/teachers");
      return { ok: true, data: { favorite: false } };
    }
    await db.favoriteTeacher.create({ data: { studentId: session.userId, teacherId } });
    revalidatePath("/student/favorites");
    revalidatePath("/student/teachers");
    return { ok: true, data: { favorite: true } };
  } catch {
    return { ok: false, error: "Could not update favorites." };
  }
}

export async function joinWaitingQueue(teacherId: string): Promise<ActionResult> {
  await requireRole("STUDENT");
  // Demo queue: acknowledge only; a real implementation would persist a queue row.
  return { ok: true };
}
