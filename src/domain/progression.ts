// Progression engine — server-authoritative lesson/chapter/level unlocking.
// The client can only ever *read* state computed here.
import "server-only";
import { db } from "@/lib/db";
import { PROGRESSION, type CefrCode } from "@/config/domain";
import { lessonIsComplete, isChapterExamUnlocked, type LessonState, type CompletionCheck } from "@/domain/rules";
import type { Prisma, LessonStatus } from "@prisma/client";

export type { CompletionCheck };

export interface LessonUnlockState {
  status: LessonStatus;
  attendanceComplete: boolean;
  quizPassed: boolean;
  quizBestScore: number | null;
  homeworkSubmitted: boolean;
}

export interface LockExplanation {
  locked: true;
  reasonKey: keyof typeof import("@/config/domain").LOCK_REASONS;
  messageVars?: Record<string, string | number>;
}

// ── Read models ──────────────────────────────────────────────────────────────

/** Ordered lessons of a level with the student's progress + lock state. */
export async function getPathForStudent(studentId: string, levelCode: CefrCode) {
  const level = await db.level.findUnique({
    where: { code: levelCode },
    include: {
      chapters: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              progress: { where: { studentId } },
            },
          },
          chapterExam: { include: { quiz: { select: { id: true } } } },
        },
      },
      levelExam: { include: { quiz: { select: { id: true } } } },
    },
  });
  if (!level) return null;

  const enrollment = await db.enrollment.findUnique({
    where: { studentId_levelId: { studentId, levelId: level.id } },
  });

  const chapters = level.chapters.map((chapter, chapterIdx) => {
    const lessons = chapter.lessons.map((lesson) => {
      const p = lesson.progress[0];
      return {
        id: lesson.id,
        title: lesson.title,
        titleDe: lesson.titleDe,
        orderIndex: lesson.orderIndex,
        durationMinutes: lesson.durationMinutes,
        requiresHomework: lesson.requiresHomework,
        state: p?.status ?? ("LOCKED" as LessonStatus),
        quizPassed: p?.quizPassed ?? false,
        homeworkSubmitted: p?.homeworkSubmitted ?? false,
        attendanceComplete: p?.attendanceComplete ?? false,
      };
    });
    return {
      id: chapter.id,
      title: chapter.title,
      titleDe: chapter.titleDe,
      description: chapter.description,
      orderIndex: chapter.orderIndex,
      examUnlocked: isChapterExamUnlocked(lessons),
      examPassed: false as boolean, // filled below
      lessonsOpen: false, // filled below based on passed exams
      lessons,
    };
  });

  // Determine which chapters are actually open based on passed exams.
  const passedExams = await db.examAttempt.findMany({
    where: {
      studentId,
      kind: "CHAPTER",
      passed: true,
      chapterExam: { chapter: { levelId: level.id } },
    },
    select: { chapterExam: { select: { chapterId: true } } },
  });
  const passedChapterIds = new Set(passedExams.map((e) => e.chapterExam!.chapterId));
  for (const c of chapters) c.examPassed = passedChapterIds.has(c.id);
  let gateOpen = true;
  for (const c of chapters) {
    c.lessonsOpen = gateOpen;
    if (!passedChapterIds.has(c.id)) gateOpen = false;
  }

  const allChaptersPassed =
    chapters.length > 0 && chapters.every((c) => passedChapterIds.has(c.id));

  const finalExamPassed = await db.examAttempt.findFirst({
    where: { studentId, kind: "LEVEL_FINAL", passed: true, levelExam: { levelId: level.id } },
    select: { id: true },
  });

  return {
    level: { id: level.id, code: level.code, title: level.title, description: level.description },
    enrollment,
    chapters,
    finalExam: level.levelExam
      ? {
          unlocked: allChaptersPassed && !!enrollment,
          passed: !!finalExamPassed,
          quizId: level.levelExam.quizId,
          proctoringRequired: level.levelExam.proctoringRequired,
        }
      : null,
  };
}

/**
 * Server-side authorization: may this student access this lesson right now?
 * Returns precise explanation when locked — never trust client UI.
 */
export async function assertLessonAccess(studentId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: { include: { level: true, lessons: { orderBy: { orderIndex: "asc" } }, chapterExam: true } },
      progress: { where: { studentId } },
      objectives: { orderBy: { orderIndex: "asc" } },
      materials: { orderBy: { orderIndex: "asc" } },
    },
  });
  if (!lesson) return { ok: false as const, reason: "NOT_FOUND" as const };

  const enrollment = await db.enrollment.findUnique({
    where: { studentId_levelId: { studentId, levelId: lesson.chapter.levelId } },
  });
  if (!enrollment) return { ok: false as const, reason: "NOT_ENROLLED" as const };

  const progress =
    lesson.progress[0] ??
    (await ensureProgressRow(studentId, lessonId));

  if (progress.status === "COMPLETED" || progress.status === "IN_PROGRESS") {
    return { ok: true as const, lesson, progress };
  }

  // Sequential unlock within chapter
  const siblings = lesson.chapter.lessons;
  const idx = siblings.findIndex((l) => l.id === lessonId);
  if (idx < 0) return { ok: false as const, reason: "NOT_FOUND" as const };

  if (idx === 0) {
    // First lesson of chapter: allowed iff previous chapter exam passed (or first chapter)
    const chapterOrder = lesson.chapter.orderIndex;
    if (chapterOrder > 1) {
      const prevPassed = await db.examAttempt.count({
        where: {
          studentId,
          kind: "CHAPTER",
          passed: true,
          chapterExam: { chapter: { levelId: lesson.chapter.levelId, orderIndex: chapterOrder - 1 } },
        },
      });
      if (prevPassed === 0) {
        return { ok: false as const, reason: "PREVIOUS_CHAPTER_EXAM" as const, lesson, progress };
      }
    }
    return { ok: true as const, lesson, progress };
  }

  const prev = siblings[idx - 1]!;
  const prevProgress = await db.lessonProgress.findUnique({
    where: { studentId_lessonId: { studentId, lessonId: prev.id } },
  });
  if (!prevProgress || prevProgress.status !== "COMPLETED") {
    return { ok: false as const, reason: "PREVIOUS_LESSON" as const, lesson, progress };
  }
  return { ok: true as const, lesson, progress };
}

export async function ensureProgressRow(studentId: string, lessonId: string) {
  const existing = await db.lessonProgress.findUnique({
    where: { studentId_lessonId: { studentId, lessonId } },
  });
  if (existing) return existing;
  try {
    return await db.lessonProgress.create({ data: { studentId, lessonId, status: "AVAILABLE", unlockedAt: new Date() } });
  } catch {
    return db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
  }
}

// ── Write model: completion ──────────────────────────────────────────────────

/**
 * Recompute completion for a lesson; if complete, atomically mark COMPLETED and
 * unlock the next lesson in sequence. Runs in a transaction to avoid races.
 */
export async function recomputeAndAdvance(studentId: string, lessonId: string) {
  return db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: { include: { lessons: { orderBy: { orderIndex: "asc" } } } },
        progress: { where: { studentId } },
      },
    });
    if (!lesson) throw new Error("lesson not found");

    let progress = lesson.progress[0];
    if (!progress) {
      progress = await tx.lessonProgress.create({ data: { studentId, lessonId, status: "AVAILABLE" } });
    }

    const check: CompletionCheck = {
      attendanceComplete: progress.attendanceComplete,
      quizPassed: progress.quizPassed,
      quizBestScore: progress.quizBestScore,
      homeworkSubmitted: progress.homeworkSubmitted,
      requiresHomework: lesson.requiresHomework,
    };

    if (progress.status !== "COMPLETED") {
      if (progress.status === "LOCKED") return { completed: false, nextLessonId: null as string | null };

      const complete = lessonIsComplete(check);
      const nextStatus: LessonStatus = complete ? "COMPLETED" : "IN_PROGRESS";

      progress = await tx.lessonProgress.update({
        where: { id: progress.id },
        data: {
          status: nextStatus,
          completedAt: complete ? new Date() : null,
        },
      });

      if (complete) {
        // Unlock next lesson in the same chapter
        const idx = lesson.chapter.lessons.findIndex((l) => l.id === lessonId);
        const next = idx >= 0 ? lesson.chapter.lessons[idx + 1] : undefined;
        if (next) {
          await tx.lessonProgress.upsert({
            where: { studentId_lessonId: { studentId, lessonId: next.id } },
            create: { studentId, lessonId: next.id, status: "AVAILABLE", unlockedAt: new Date() },
            update: { status: "AVAILABLE", unlockedAt: new Date() },
          });
          return { completed: true, nextLessonId: next.id, xpAwarded: PROGRESSION.xpPerLesson };
        }
      }
    }
    return { completed: progress.status === "COMPLETED", nextLessonId: null as string | null, xpAwarded: progress.status === "COMPLETED" ? PROGRESSION.xpPerLesson : 0 };
  });
}

/** Chapter exam eligibility: every lesson in the chapter COMPLETED. */
export async function assertChapterExamAccess(studentId: string, chapterId: string) {
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    include: { level: true, lessons: true },
  });
  if (!chapter) return { ok: false as const, reason: "NOT_FOUND" as const };
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_levelId: { studentId, levelId: chapter.levelId } },
  });
  if (!enrollment) return { ok: false as const, reason: "NOT_ENROLLED" as const };

  if (chapter.orderIndex > 1) {
    const prevPassed = await db.examAttempt.count({
      where: {
        studentId,
        kind: "CHAPTER",
        passed: true,
        chapterExam: { chapter: { levelId: chapter.levelId, orderIndex: chapter.orderIndex - 1 } },
      },
    });
    if (prevPassed === 0) return { ok: false as const, reason: "PREVIOUS_CHAPTER_EXAM" as const };
  }

  const progresses = await db.lessonProgress.findMany({ where: { studentId, lesson: { chapterId: chapterId } } });
  const allDone = chapter.lessons.every((l) =>
    progresses.some((p) => p.lessonId === l.id && p.status === "COMPLETED")
  );
  if (!allDone) return { ok: false as const, reason: "CHAPTER_LESSONS" as const };
  return { ok: true as const, chapter };
}

/** Level final exam eligibility: all chapter exams passed. */
export async function assertLevelExamAccess(studentId: string, levelId: string) {
  const level = await db.level.findUnique({ where: { id: levelId }, include: { levelExam: true, chapters: true } });
  if (!level || !level.levelExam) return { ok: false as const, reason: "NOT_FOUND" as const };
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_levelId: { studentId, levelId } },
  });
  if (!enrollment) return { ok: false as const, reason: "NOT_ENROLLED" as const };

  const passed = await db.examAttempt.count({
    where: { studentId, kind: "CHAPTER", passed: true, chapterExam: { chapter: { levelId } } },
  });
  if (passed < level.chapters.length) return { ok: false as const, reason: "CHAPTER_EXAMS" as const };
  return { ok: true as const, level, levelExam: level.levelExam };
}

/** Update aggregate StudentProgress percent for the level. */
export async function updateLevelCompletionPercent(studentId: string, levelCode: CefrCode) {
  const level = await db.level.findUnique({
    where: { code: levelCode },
    include: { chapters: { include: { lessons: true, chapterExam: true } } },
  });
  if (!level) return;
  // Units = every lesson + every chapter exam + the final exam.
  const totalUnits = level.chapters.reduce((n, c) => n + c.lessons.length + 1, 1);
  const progresses = await db.lessonProgress.findMany({ where: { studentId, lesson: { chapter: { levelId: level.id } }, status: "COMPLETED" } });
  const exams = await db.examAttempt.findMany({ where: { studentId, OR: [{ kind: "CHAPTER", passed: true, chapterExam: { chapter: { levelId: level.id } } }, { kind: "LEVEL_FINAL", passed: true, levelExam: { levelId: level.id } }] } });
  const done = progresses.length + exams.length;
  const percent = totalUnits === 0 ? 0 : Math.min(100, Math.round((done / totalUnits) * 100));
  await db.studentProgress.upsert({
    where: { studentId_levelCode: { studentId, levelCode } },
    create: { studentId, levelCode, completionPercent: percent, lastStudyDate: new Date() },
    update: { completionPercent: percent, lastStudyDate: new Date() },
  });
}
