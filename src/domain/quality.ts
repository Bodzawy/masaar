// Teacher quality score — documented weighted demo calculation.
// qualityScore = Σ weightᵢ · componentᵢ with every component normalised 0–100.
import { QUALITY_WEIGHTS } from "@/config/domain";

export interface QualityInputs {
  avgRating1to5: number; // mean of overall ratings (0 when no ratings)
  ratingCount: number;
  completedLessons: number;
  scheduledLessons: number;
  retakeRequests: number;
  complaints: number; // report cases against teacher
  missedSessions: number; // no-shows
  cancellationRatePct: number; // 0–100
  responseTimeMinutes: number;
  auditOutcome: number; // moderator audit score 0–100 (default 85)
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function componentScores(i: QualityInputs) {
  return {
    avgRating: i.ratingCount === 0 ? 85 : clamp(((i.avgRating1to5 - 1) / 4) * 100),
    completionRate:
      i.scheduledLessons === 0 ? 90 : clamp((i.completedLessons / i.scheduledLessons) * 100),
    studentQuizPerformance: 82, // placeholder aggregate in MVP; wired to quiz stats later
    lowRetakeRate: clamp(100 - (i.completedLessons === 0 ? 0 : (i.retakeRequests / Math.max(1, i.completedLessons)) * 400)),
    lowComplaintRate: clamp(100 - (i.completedLessons === 0 ? 0 : (i.complaints / Math.max(1, i.completedLessons)) * 200)),
    attendanceReliability:
      i.scheduledLessons === 0 ? 95 : clamp(((i.scheduledLessons - i.missedSessions) / i.scheduledLessons) * 100),
    lowCancellationRate: clamp(100 - i.cancellationRatePct),
    fastResponseTime: clamp(100 * ((240 - i.responseTimeMinutes) / (240 - 15))),
    auditOutcome: clamp(i.auditOutcome || 85),
  };
}

/** Compute the composite quality score (integer 0–100). */
export function computeQualityScore(inputs: QualityInputs): number {
  const s = componentScores(inputs);
  let total = 0;
  for (const key of Object.keys(QUALITY_WEIGHTS) as Array<keyof typeof QUALITY_WEIGHTS>) {
    total += QUALITY_WEIGHTS[key] * (s as Record<string, number>)[key]!;
  }
  return Math.round(clamp(total));
}
