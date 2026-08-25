import { describe, expect, it } from "vitest";
import { computeQualityScore } from "@/domain/quality";
import { QUALITY_WEIGHTS, qualityStateFor, roleHas } from "@/config/domain";

describe("teacher quality score", () => {
  it("weights sum to exactly 1", () => {
    const sum = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("stays within 0–100 for extreme inputs", () => {
    const worst = computeQualityScore({
      avgRating1to5: 1, ratingCount: 50, completedLessons: 0, scheduledLessons: 100,
      retakeRequests: 40, complaints: 20, missedSessions: 100,
      cancellationRatePct: 100, responseTimeMinutes: 240, auditOutcome: 0,
    });
    const best = computeQualityScore({
      avgRating1to5: 5, ratingCount: 500, completedLessons: 1000, scheduledLessons: 1000,
      retakeRequests: 0, complaints: 0, missedSessions: 0,
      cancellationRatePct: 0, responseTimeMinutes: 15, auditOutcome: 100,
    });
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThan(70);
    expect(best).toBeGreaterThan(80);
    expect(best).toBeLessThanOrEqual(100);
  });

  it("maps scores onto documented states", () => {
    expect(qualityStateFor(93)).toBe("GOOD_STANDING");
    expect(qualityStateFor(80)).toBe("GOOD_STANDING");
    expect(qualityStateFor(79)).toBe("WARNING");
    expect(qualityStateFor(65)).toBe("UNDER_REVIEW");
    expect(qualityStateFor(55)).toBe("SUSPENDED");
  });

  it("does not auto-suspend from a single bad review", () => {
    // One 1-star review among many strong signals must stay ≥ GOOD_STANDING boundary logic
    const score = computeQualityScore({
      avgRating1to5: (5 * 49 + 1) / 50, ratingCount: 50,
      completedLessons: 200, scheduledLessons: 210,
      retakeRequests: 2, complaints: 1, missedSessions: 3,
      cancellationRatePct: 4, responseTimeMinutes: 30, auditOutcome: 90,
    });
    expect(score).toBeGreaterThan(70); // at minimum "Warning", never auto-banned
  });
});

describe("RBAC permission matrix", () => {
  it("grants curriculum editing only to academic/super admins", () => {
    expect(roleHas("ACADEMIC_ADMIN", "curriculum_edit")).toBe(true);
    expect(roleHas("SUPER_ADMIN", "curriculum_edit")).toBe(true);
    expect(roleHas("MODERATOR", "curriculum_edit")).toBe(false);
    expect(roleHas("TEACHER", "curriculum_edit")).toBe(false);
    expect(roleHas("STUDENT", "curriculum_edit")).toBe(false);
  });

  it("restricts case decisions and evidence to moderators (+super)", () => {
    expect(roleHas("MODERATOR", "reports_decide")).toBe(true);
    expect(roleHas("MODERATOR", "moderation_evidence")).toBe(true);
    expect(roleHas("TEACHER_MANAGER", "reports_decide")).toBe(false);
    expect(roleHas("FINANCE_ADMIN", "moderation_evidence")).toBe(false);
  });

  it("gives finance only payment-related powers", () => {
    expect(roleHas("FINANCE_ADMIN", "payments_manage")).toBe(true);
    expect(roleHas("FINANCE_ADMIN", "retakes_review")).toBe(false);
    expect(roleHas("FINANCE_ADMIN", "teachers_manage")).toBe(false);
  });

  it("never grants students or teachers admin permissions", () => {
    const adminPerms = ["students_manage", "certificates_revoke", "roles_manage"] as const;
    for (const perm of adminPerms) {
      expect(roleHas("STUDENT", perm)).toBe(false);
      expect(roleHas("TEACHER", perm)).toBe(false);
    }
  });
});
