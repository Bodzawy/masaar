// ─────────────────────────────────────────────────────────────────────────────
import type { RoleType } from "@prisma/client";

// Domain configuration — the single source of truth for business rules.
// UI and server logic must read from here; never hard-code thresholds.
// ─────────────────────────────────────────────────────────────────────────────

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrCode = (typeof CEFR_LEVELS)[number];

export const LEVEL_TITLES: Record<CefrCode, string> = {
  A1: "Beginner Foundations",
  A2: "Elementary Communication",
  B1: "Independent Everyday Life",
  B2: "Upper-Intermediate Fluency",
  C1: "Advanced Academic & Professional",
  C2: "Mastery & Near-Native Nuance",
};

// ── Progression engine ───────────────────────────────────────────────────────
export const PROGRESSION = {
  /** Minimum quiz percentage for a lesson quiz to count as passed. */
  lessonQuizPassPercent: 70,
  /** Minimum chapter-exam percentage to unlock the next chapter. */
  examPassPercent: 70,
  /** XP awarded on lesson completion. */
  xpPerLesson: 50,
  /** XP awarded per passed exam. */
  xpPerExam: 150,
  /** Lessons required before a level final exam unlocks (all chapters + exams). */
  finalExamRequiresAllChapters: true,
  /** A completed live lesson must be at least this many minutes to count as attendance. */
  minAttendanceMinutes: 10, // demo: shortened
} as const;

/** Explanation templates shown when content is locked (never a bare "locked"). */
export const LOCK_REASONS = {
  LESSON_SEQUENCE:
    "This lesson unlocks after you complete the previous lesson: attend the live session, pass its quiz with at least {score}%, and submit the homework.",
  CHAPTER_EXAM:
    "The chapter exam unlocks when every lesson in this chapter is completed.",
  NEXT_CHAPTER:
    "This chapter opens once you pass the previous chapter exam with at least {score}%.",
  LEVEL_EXAM:
    "The final level exam unlocks after you pass every chapter exam in this level.",
  NOT_ENROLLED: "Enroll in this level to unlock its learning path.",
} as const;

// ── Teacher ranks & qualification ceilings ───────────────────────────────────
export const TEACHER_RANKS = {
  JUNIOR:       { label: "Junior",       maxLevel: "A2" as CefrCode, order: 1 },
  INTERMEDIATE: { label: "Intermediate", maxLevel: "B1" as CefrCode, order: 2 },
  ADVANCED:     { label: "Advanced",     maxLevel: "B2" as CefrCode, order: 3 },
  SENIOR:       { label: "Senior",       maxLevel: "C1" as CefrCode, order: 4 },
  EXPERT:       { label: "Expert",       maxLevel: "C2" as CefrCode, order: 5 },
} as const;

export type TeacherRankKey = keyof typeof TEACHER_RANKS;

// ── Teacher quality score (documented weighted demo calculation) ────────────
// qualityScore = Σ weight_i · componentScore_i, all components normalised 0–100.
export const QUALITY_WEIGHTS = {
  avgRating: 0.30,          // mean overall rating mapped from 1–5 → 0–100
  completionRate: 0.15,     // completed / scheduled bookings
  studentQuizPerformance: 0.10, // avg quiz pass rate of the teacher's students
  lowRetakeRate: 0.10,      // 100 − retake requests per completed lesson (capped)
  lowComplaintRate: 0.10,   // 100 − open+decided reports per 20 lessons (capped)
  attendanceReliability: 0.10, // share of sessions not missed/no-show
  lowCancellationRate: 0.05,    // 100 − cancellation rate
  fastResponseTime: 0.05,   // response time mapped: ≤15min=100 … ≥240min=0
  auditOutcome: 0.05,       // moderator audit score (default 85)
} as const;
// Sum of weights === 1 — asserted by tests.

export const QUALITY_STATES = [
  { key: "GOOD_STANDING", label: "Good Standing", min: 80, tone: "success" },
  { key: "WARNING", label: "Warning", min: 70, tone: "warning" },
  { key: "UNDER_REVIEW", label: "Under Review", min: 60, tone: "accent" },
  { key: "SUSPENDED", label: "Suspended", min: 0, tone: "destructive" },
] as const;

export type QualityStateKey = (typeof QUALITY_STATES)[number]["key"];

export function qualityStateFor(score: number): QualityStateKey {
  if (score >= 80) return "GOOD_STANDING";
  if (score >= 70) return "WARNING";
  if (score >= 60) return "UNDER_REVIEW";
  return "SUSPENDED";
}

// ── Booking & credits ────────────────────────────────────────────────────────
export const BOOKING_RULES = {
  defaultLessonPriceCents: 2900,
  currency: "EUR",
  freeCancellationHoursBefore: 24,
  instantLessonDurationMinutes: 50,
  signupBonusCredits: 3,
  /** Credits refunded automatically when a teacher cancels. */
  autoRefundOnTeacherCancel: true,
  /** Student cancellations < N hours before start are charged one credit. */
  lateCancelChargeThresholdHours: 24,
} as const;

// ── Certificates ─────────────────────────────────────────────────────────────
export const CERTIFICATE_RULES = {
  /** Platform-issued CEFR level-completion certificate wording. */
  issuerLine: "Platform-issued level completion certificate",
  disclaimer:
    "This certificate documents course completion on the platform. It is not an externally accredited examination (e.g. Goethe-Institut or telc).",
  validityYears: 3,
} as const;

// ── Reports & moderation ─────────────────────────────────────────────────────
export const REPORT_LIFECYCLE = ["OPEN", "UNDER_REVIEW", "TEACHER_RESPONSE", "DECIDED", "CLOSED"] as const;
export type ReportStage = (typeof REPORT_LIFECYCLE)[number];

// Retakes: approval returns exactly one lesson credit; never automatic refunds.
export const RETAKE_RULES = {
  creditRefundedOnApproval: 1,
  autoApprove: false,
} as const;

// ── Placement test demo scoring ──────────────────────────────────────────────
// Transparent rule: suggested level = highest threshold reached by correct count.
export const PLACEMENT_THRESHOLDS: Array<{ minCorrect: number; level: CefrCode }> = [
  { minCorrect: 0, level: "A1" },
  { minCorrect: 4, level: "A2" },
  { minCorrect: 8, level: "B1" },
  { minCorrect: 12, level: "B2" },
  { minCorrect: 16, level: "C1" },
];

// ── Vocabulary spaced repetition (Leitner) ──────────────────────────────────
export const VOCAB_BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16] as const;

// ── RBAC permission matrix ───────────────────────────────────────────────────
export const PERMISSIONS = {
  curriculum_edit: "Edit levels, chapters, lessons and quizzes",
  students_view: "View students",
  students_manage: "Suspend/adjust students",
  teachers_view: "View teachers and pipeline",
  teachers_manage: "Advance onboarding, suspend teachers",
  reports_view: "View report cases and evidence",
  reports_decide: "Decide and close report cases",
  retakes_review: "Approve/reject retake requests",
  certificates_issue: "Issue certificates",
  certificates_revoke: "Revoke certificates",
  payments_view: "View payments and payouts",
  payments_manage: "Trigger refunds and payouts",
  analytics_view: "View analytics dashboards",
  roles_manage: "Manage roles and permissions",
  settings_manage: "Change platform settings",
  moderation_evidence: "Access confidential case evidence",
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as PermissionKey[];

export const ROLE_PERMISSIONS: Record<RoleType, PermissionKey[]> = {
  STUDENT: [],
  TEACHER: [],
  SUPPORT_ADMIN: ["students_view"],
  MODERATOR: ["reports_view", "reports_decide", "moderation_evidence", "students_view", "teachers_view"],
  FINANCE_ADMIN: ["payments_view", "payments_manage", "analytics_view"],
  TEACHER_MANAGER: ["teachers_view", "teachers_manage", "reports_view", "retakes_review", "students_view"],
  ACADEMIC_ADMIN: [
    "curriculum_edit", "students_view", "teachers_view", "teachers_manage",
    "retakes_review", "certificates_issue", "certificates_revoke",
    "reports_view", "analytics_view",
  ],
  SUPER_ADMIN: ALL,
};
export type RoleTypeKey = keyof typeof ROLE_PERMISSIONS;

export function roleHas(role: RoleTypeKey | RoleType, permission: PermissionKey): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export const ADMIN_ROUTES_BY_ROLE: Record<Exclude<RoleTypeKey, "STUDENT" | "TEACHER">, string> = {
  ACADEMIC_ADMIN: "/admin",
  TEACHER_MANAGER: "/admin/teachers",
  SUPPORT_ADMIN: "/admin/students",
  MODERATOR: "/admin/reports",
  FINANCE_ADMIN: "/admin/payments",
  SUPER_ADMIN: "/admin",
};

// ── Onboarding pipeline stages ───────────────────────────────────────────────
export const ONBOARDING_STAGES = [
  "APPLICATION",
  "DOCUMENT_VERIFICATION",
  "LANGUAGE_ASSESSMENT",
  "TEACHING_DEMO",
  "INTERVIEW",
  "PLATFORM_TRAINING",
  "APPROVED",
] as const;

// ── Skills ───────────────────────────────────────────────────────────────────
export const SKILLS = ["READING", "LISTENING", "WRITING", "SPEAKING", "GRAMMAR", "VOCABULARY"] as const;
