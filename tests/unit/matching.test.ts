import { describe, expect, it } from "vitest";
import { isQualifiedForLevel } from "@/domain/matching";
import { TEACHER_RANKS } from "@/config/domain";

describe("teacher qualification matching", () => {
  it("rank ceilings match the documented ladder", () => {
    expect(TEACHER_RANKS.JUNIOR.maxLevel).toBe("A2");
    expect(TEACHER_RANKS.INTERMEDIATE.maxLevel).toBe("B1");
    expect(TEACHER_RANKS.ADVANCED.maxLevel).toBe("B2");
    expect(TEACHER_RANKS.SENIOR.maxLevel).toBe("C1");
    expect(TEACHER_RANKS.EXPERT.maxLevel).toBe("C2");
  });

  it("allows teachers to teach at or below their ceiling", () => {
    expect(isQualifiedForLevel("SENIOR", "B2")).toBe(true);
    expect(isQualifiedForLevel("ADVANCED", "B2")).toBe(true);
    expect(isQualifiedForLevel("JUNIOR", "A1")).toBe(true);
  });

  it("never matches teachers above their level ceiling", () => {
    // B2 student cannot be taught by Junior/Intermediate teachers
    expect(isQualifiedForLevel("JUNIOR", "B2")).toBe(false);
    expect(isQualifiedForLevel("INTERMEDIATE", "B2")).toBe(false);
    // C1 requires Senior+
    expect(isQualifiedForLevel("ADVANCED", "C1")).toBe(false);
    expect(isQualifiedForLevel("EXPERT", "C2")).toBe(true);
    expect(isQualifiedForLevel("SENIOR", "C2")).toBe(false);
  });
});
