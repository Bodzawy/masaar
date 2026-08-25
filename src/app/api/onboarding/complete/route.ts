import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionCookie, getSession, requireRole } from "@/lib/auth";
import { CEFR_LEVELS, BOOKING_RULES } from "@/config/domain";
import type { CefrCode } from "@/config/domain";

const schema = z.object({
  country: z.string().min(1),
  nativeLanguage: z.string().min(1),
  ageRange: z.string().min(1),
  learningGoal: z.string().min(1),
  expectedLevel: z.enum(CEFR_LEVELS),
  preferredStudyTimes: z.string().min(1),
  studyPreference: z.string().min(1),
  suggestedLevel: z.enum(CEFR_LEVELS).nullable(),
});

// Idempotent completion of student onboarding + level enrollment.
export async function POST(req: Request) {
  const session = await requireRole("STUDENT");
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const profile = await db.studentProfile.findUnique({ where: { userId: session.userId } });
  if (profile?.onboardedAt) {
    return NextResponse.json({ ok: true, alreadyDone: true });
  }

  const levelCode = (body.data.suggestedLevel ?? body.data.expectedLevel) as CefrCode;
  await db.$transaction(async (tx) => {
    await tx.studentProfile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        country: body.data.country,
        nativeLanguage: body.data.nativeLanguage,
        ageRange: body.data.ageRange,
        learningGoal: body.data.learningGoal,
        expectedLevel: body.data.expectedLevel,
        preferredStudyTimes: body.data.preferredStudyTimes,
        studyPreference: body.data.studyPreference,
        placementSuggestedLevel: body.data.suggestedLevel,
        placementTakenAt: body.data.suggestedLevel ? new Date() : null,
        onboardedAt: new Date(),
      },
      update: { ...body.data, onboardedAt: new Date() },
    });
    const level = await tx.level.findUnique({ where: { code: levelCode }, include: { chapters: { orderBy: { orderIndex: "asc" }, include: { lessons: { orderBy: { orderIndex: "asc" } } } } } });
    if (level) {
      await tx.enrollment.upsert({
        where: { studentId_levelId: { studentId: session.userId, levelId: level.id } },
        create: { studentId: session.userId, levelId: level.id },
        update: {},
      });
      // First lesson becomes available; everything else stays LOCKED until earned.
      const firstLesson = level.chapters[0]?.lessons[0];
      if (firstLesson) {
        await tx.lessonProgress.upsert({
          where: { studentId_lessonId: { studentId: session.userId, lessonId: firstLesson.id } },
          create: { studentId: session.userId, lessonId: firstLesson.id, status: "AVAILABLE", unlockedAt: new Date() },
          update: {},
        });
      }
    }
    // Welcome credits
    const wallet = await tx.wallet.upsert({ where: { studentId: session.userId }, create: { studentId: session.userId }, update: {} });
    const hasBonus = await tx.creditLedger.findFirst({ where: { walletId: wallet.id, reason: "SIGNUP_BONUS" } });
    if (!hasBonus) {
      await tx.creditLedger.create({
        data: { walletId: wallet.id, delta: BOOKING_RULES.signupBonusCredits, balanceAfter: BOOKING_RULES.signupBonusCredits, reason: "SIGNUP_BONUS", idempotencyKey: `bonus-${session.userId}` },
      });
    }
    await tx.notification.create({
      data: { userId: session.userId, type: "system", titleKey: "Welcome to DeutschPath!", link: "/student/learning-path" },
    });
    for (const skill of ["READING", "LISTENING", "WRITING", "SPEAKING", "GRAMMAR", "VOCABULARY"] as const) {
      await tx.skillScore.upsert({
        where: { studentId_skill: { studentId: session.userId, skill } },
        create: { studentId: session.userId, skill, score: 30 },
        update: {},
      });
    }
  });

  // Refresh the session so middleware sees onboarded=true immediately.
  const fresh = await getSession();
  if (fresh) {
    await createSessionCookie({ ...fresh, onboarded: true });
  }
  return NextResponse.json({ ok: true });
}
