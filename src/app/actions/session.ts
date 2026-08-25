"use server";
// Live-session actions: start/end demo lessons, attendance, completion handoff.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getLiveProvider } from "@/lib/live/provider";

export async function startSession(bookingId: string) {
  const session = await requireRole("STUDENT", "TEACHER");
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { liveSession: true } });
  if (!booking || (booking.studentId !== session.userId && booking.teacherId !== session.userId)) {
    throw new Error("FORBIDDEN");
  }
  if (booking.status === "COMPLETED") return;

  const provider = getLiveProvider();
  if (!booking.liveSession) {
    const room = await provider.createRoom(bookingId);
    await db.liveSession.create({
      data: {
        bookingId,
        provider: room.provider,
        roomUrl: room.joinUrlStudent,
        demoMode: room.demoMode,
        startedAt: new Date(),
      },
    });
  }
  await db.booking.update({ where: { id: bookingId }, data: { status: "IN_PROGRESS" } });
}

export async function endLesson(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("STUDENT", "TEACHER");
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { liveSession: true, lesson: true },
  });
  if (!booking || (booking.studentId !== session.userId && booking.teacherId !== session.userId)) {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (!booking.liveSession) {
    // Ensure a session exists even for direct navigation
    await startSession(bookingId);
  }

  await db.$transaction(async (tx) => {
    const nowDate = new Date();
    await tx.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED" } });
    const ls = await tx.liveSession.findUnique({ where: { bookingId }, include: { attendanceEvents: true } });
    if (ls) {
      await tx.liveSession.update({ where: { id: ls.id }, data: { endedAt: nowDate } });
      for (const actor of [booking.studentId, booking.teacherId]) {
        const joined = ls.attendanceEvents.some((e) => e.actorId === actor && e.type !== "NO_SHOW");
        if (!joined) {
          await tx.attendanceEvent.create({ data: { sessionId: ls.id, actorId: actor, type: "MARKED_PRESENT" } });
        }
        await tx.attendanceEvent.create({ data: { sessionId: ls.id, actorId: actor, type: "COMPLETED" } });
      }
    }
    // Mark attendance complete on the student's lesson progress
    await tx.lessonProgress.updateMany({
      where: { studentId: booking.studentId, lessonId: booking.lessonId },
      data: { attendanceComplete: true },
    });
    await tx.notification.create({
      data: { userId: booking.studentId, type: "system", titleKey: "How was your lesson? Rate your teacher", link: `/student/post-lesson/${bookingId}` },
    });
    await tx.notification.create({
      data: { userId: booking.teacherId, type: "system", titleKey: "Lesson completed — add an internal note", link: `/teacher/students/${booking.studentId}` },
    });
  });

  revalidatePath("/student");
  revalidatePath("/teacher");
  return { ok: true };
}
