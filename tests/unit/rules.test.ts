import { describe, expect, it } from "vitest";
import { lessonIsComplete, isChapterExamUnlocked, isFinalExamEligible, computeQuizScore, placementSuggestedLevel, vocabNextIntervalDays } from "@/domain/rules";

const base = { attendanceComplete: true, quizPassed: true, quizBestScore: 80, homeworkSubmitted: true, requiresHomework: true };

describe("lesson unlock conditions", () => {
  it("completes only when every requirement is met", () => {
    expect(lessonIsComplete(base)).toBe(true);
    expect(lessonIsComplete({ ...base, attendanceComplete: false })).toBe(false);
    expect(lessonIsComplete({ ...base, quizPassed: false })).toBe(false);
    expect(lessonIsComplete({ ...base, quizBestScore: 69 })).toBe(false);
    expect(lessonIsComplete({ ...base, homeworkSubmitted: false })).toBe(false);
  });

  it("does not require homework when lesson declares none", () => {
    expect(lessonIsComplete({ ...base, requiresHomework: false, homeworkSubmitted: false })).toBe(true);
  });
});

describe("chapter exam gating", () => {
  const done = { state: "COMPLETED" as const };
  const locked = { state: "LOCKED" as const };

  it("unlocks only when ALL lessons are completed", () => {
    expect(isChapterExamUnlocked([done, done, done])).toBe(true);
    expect(isChapterExamUnlocked([done, locked, done])).toBe(false);
  });

  it("never unlocks an empty chapter", () => {
    expect(isChapterExamUnlocked([])).toBe(false);
  });

  it("final exam requires enrollment and all chapter exams passed", () => {
    const chapters = ["c1", "c2"];
    expect(isFinalExamEligible(chapters, new Set(["c1"]), true)).toBe(false);
    expect(isFinalExamEligible(chapters, new Set(["c1", "c2"]), true)).toBe(true);
    expect(isFinalExamEligible(chapters, new Set(["c1", "c2"]), false)).toBe(false);
  });
});

describe("quiz scoring (server-authoritative)", () => {
  const mk = (id: string) => ({
    id,
    points: 1,
    options: [
      { id: `${id}-a`, isCorrect: false },
      { id: `${id}-b`, isCorrect: true },
    ],
  });
  const questions = [mk("q1"), mk("q2"), mk("q3"), mk("q4"), mk("q5")];
  const allCorrect = Object.fromEntries(questions.map((q) => [q.id, `${q.id}-b`]));

  it("70% is a pass on a 20-question bank boundary", () => {
    // 14/20 correct = exactly 70%
    const answers14 = Object.fromEntries(
      questions.slice(0, 5).map((q) => [q.id, `${q.id}-b`])
    );
    void answers14;
    const twenty = Array.from({ length: 20 }, (_, i) => mk(`p${i}`));
    const answers = Object.fromEntries(twenty.map((q, i) => [q.id, i < 14 ? `${q.id}-b` : `${q.id}-a`]));
    const res = computeQuizScore(twenty, answers);
    expect(res.score).toBe(70);
    expect(res.passed).toBe(true);

    const thirteen = Object.fromEntries(twenty.map((q, i) => [q.id, i < 13 ? `${q.id}-b` : `${q.id}-a`]));
    expect(computeQuizScore(twenty, thirteen).passed).toBe(false);
  });

  it("fails when below pass mark; un-answered counts as wrong", () => {
    const partial = Object.fromEntries(questions.slice(0, 3).map((q) => [q.id, `${q.id}-b`]));
    const res = computeQuizScore(questions, partial, 70);
    expect(res.passed).toBe(false);
    expect(res.correctCount).toBe(3);
    expect(allCorrect && res.total).toBe(5);
  });

  it("respects custom pass scores for exams", () => {
    const twoOfFive = Object.fromEntries(questions.slice(0, 2).map((q) => [q.id, `${q.id}-b`]));
    expect(computeQuizScore(questions, twoOfFive, 40).passed).toBe(true);
  });
});

describe("placement test demo scoring", () => {
  it("maps transparent thresholds", () => {
    expect(placementSuggestedLevel(0)).toBe("A1");
    expect(placementSuggestedLevel(3)).toBe("A1");
    expect(placementSuggestedLevel(4)).toBe("A2");
    expect(placementSuggestedLevel(7)).toBe("A2");
    expect(placementSuggestedLevel(8)).toBe("B1");
    expect(placementSuggestedLevel(12)).toBe("B2");
    expect(placementSuggestedLevel(15)).toBe("B2"); // needs 16 for C1
    expect(placementSuggestedLevel(16)).toBe("C1");
  });
});

describe("vocabulary spaced repetition", () => {
  it("advances boxes and resets failures", () => {
    expect(vocabNextIntervalDays(1, "good")).toBe(2);
    expect(vocabNextIntervalDays(3, "easy")).toBe(16); // jumps two boxes to 5
    expect(vocabNextIntervalDays(5, "easy")).toBe(16); // capped at box 5
    expect(vocabNextIntervalDays(4, "again")).toBe(1); // back to box 1
  });
});
