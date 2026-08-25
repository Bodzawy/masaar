"use server";
// Vocabulary spaced-repetition review actions (Leitner boxes).
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { VOCAB_BOX_INTERVAL_DAYS } from "@/config/domain";

export async function reviewVocab(reviewId: string, grade: "again" | "good" | "easy") {
  const session = await requireRole("STUDENT");
  const review = await db.studentVocabularyReview.findUnique({ where: { id: reviewId } });
  if (!review || review.studentId !== session.userId) return { ok: false as const };

  let box = review.box;
  if (grade === "again") box = 1;
  else if (grade === "good") box = Math.min(5, box + 1);
  else if (grade === "easy") box = Math.min(5, box + 2);

  const intervalDays = VOCAB_BOX_INTERVAL_DAYS[box] ?? 1;
  const dueAt = new Date(Date.now() + intervalDays * 86_400_000);
  // "Again" comes back the same day.
  const effectiveDue = grade === "again" ? new Date(Date.now() + 10 * 60_000) : dueAt;

  await db.studentVocabularyReview.update({
    where: { id: reviewId },
    data: { box, intervalDays, dueAt: effectiveDue, lastReviewedAt: new Date() },
  });
  revalidatePath("/student/vocabulary");
  return { ok: true as const };
}
