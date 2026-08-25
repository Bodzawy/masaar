// Pure domain rules — shared by server logic and unit tests (no server-only deps).
import { PROGRESSION, PLACEMENT_THRESHOLDS, VOCAB_BOX_INTERVAL_DAYS, type CefrCode } from "@/config/domain";

// ── Lesson completion ────────────────────────────────────────────────────────
export interface CompletionCheck {
  attendanceComplete: boolean;
  quizPassed: boolean;
  quizBestScore: number | null;
  homeworkSubmitted: boolean;
  requiresHomework: boolean;
}

/** A lesson completes ONLY when attendance + quiz ≥ pass mark (+ homework if required). */
export function lessonIsComplete(c: CompletionCheck): boolean {
  return (
    c.attendanceComplete &&
    c.quizPassed &&
    (c.quizBestScore ?? 0) >= PROGRESSION.lessonQuizPassPercent &&
    (!c.requiresHomework || c.homeworkSubmitted)
  );
}

// ── Chapter / exam gating ────────────────────────────────────────────────────
export type LessonState = "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";

/** A chapter exam unlocks when every lesson of the chapter is COMPLETED. */
export function isChapterExamUnlocked(lessons: Array<{ state: LessonState }>): boolean {
  return lessons.length > 0 && lessons.every((l) => l.state === "COMPLETED");
}

/** All chapters' exams passed ⇒ final exam eligible (given enrollment). */
export function isFinalExamEligible(chapterIds: string[], passedChapterIds: Set<string>, enrolled: boolean): boolean {
  return enrolled && chapterIds.length > 0 && chapterIds.every((id) => passedChapterIds.has(id));
}

// ── Quiz scoring (server-authoritative) ──────────────────────────────────────
export interface ScoreableQuestion {
  id: string;
  points: number;
  options: Array<{ id: string; isCorrect: boolean }>;
}

/**
 * Compute percent score + pass flag. Correctness evaluated on the server only.
 */
export function computeQuizScore(
  questions: ScoreableQuestion[],
  answers: Record<string, string | null | undefined>,
  passScorePercent: number = PROGRESSION.lessonQuizPassPercent
): { score: number; passed: boolean; correctCount: number; total: number } {
  let total = 0;
  let correctCount = 0;
  for (const q of questions) {
    total += q.points;
    const chosen = answers[q.id];
    if (chosen && q.options.find((o) => o.id === chosen)?.isCorrect) correctCount += q.points;
  }
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  return { score, passed: score >= passScorePercent, correctCount, total };
}

// ── Placement demo scoring ───────────────────────────────────────────────────
export function placementSuggestedLevel(correctCount: number): CefrCode {
  let level: CefrCode = "A1";
  for (const t of PLACEMENT_THRESHOLDS) {
    if (correctCount >= t.minCorrect) level = t.level;
  }
  return level;
}

// ── Vocabulary Leitner intervals ─────────────────────────────────────────────
export function vocabNextIntervalDays(box: number, grade: "again" | "good" | "easy"): number {
  const nextBox =
    grade === "again" ? 1 : grade === "easy" ? Math.min(5, box + 2) : Math.min(5, box + 1);
  return VOCAB_BOX_INTERVAL_DAYS[nextBox] ?? 1;
}
