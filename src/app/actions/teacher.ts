"use server";
// Teacher workspace actions.
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function setOnlineStatus(online: boolean) {
  const session = await requireRole("TEACHER");
  const profile = await db.teacherProfile.findUnique({ where: { userId: session.userId } });
  if (!profile) return { ok: false as const, error: "Profile missing" };

  // Availability validation: a suspended teacher cannot go online; teachers
  // must have at least one availability window to accept instant lessons.
  if (profile.qualityState === "SUSPENDED") {
    return { ok: false as const, error: "Your account is suspended — you cannot accept lessons." };
  }
  const windows = await db.teacherAvailability.count({ where: { teacherId: profile.id } });
  if (online && windows === 0) {
    return { ok: false as const, error: "Add your weekly availability first." };
  }
  if (!online && profile.onboardingStage !== "APPROVED") {
    return { ok: false as const, error: "Complete onboarding first." };
  }

  await db.teacherProfile.update({
    where: { id: profile.id },
    data: { isOnline: online, onlineSince: online ? new Date() : null },
  });
  revalidatePath("/teacher");
  return { ok: true as const };
}

/** Simulated incoming-request acceptance for the demo classroom. */
export async function respondToInstantRequest(bookingId: string, accept: boolean) {
  const session = await requireRole("TEACHER");
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.teacherId !== session.userId) return { ok: false as const, error: "Not found" };
  if (booking.mode !== "INSTANT" || booking.status !== "SCHEDULED") return { ok: false as const, error: "Invalid state" };

  if (!accept) {
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED_BY_TEACHER", cancelReason: "Declined by teacher" },
    });
    revalidatePath("/teacher");
    return { ok: true as const };
  }
  revalidatePath(`/teacher/classroom/${bookingId}`);
  return { ok: true as const };
}
