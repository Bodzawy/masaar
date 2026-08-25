"use server";
// Admin & moderation actions — every mutation checks RBAC permissions and
// writes an AuditLog entry. Financially significant actions use transactions.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RoleType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { roleHas, ONBOARDING_STAGES, RETAKE_RULES } from "@/config/domain";
import { applyLedgerEntry } from "@/domain/wallet";

async function audit(actorId: string, action: string, entityType: string, entityId: string, meta?: Record<string, unknown>) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, meta: meta as never } });
}

function can(role: RoleType, permission: Parameters<typeof roleHas>[1]) {
  return roleHas(role as never, permission);
}

// ── Teacher onboarding pipeline ──────────────────────────────────────────────
export async function advanceOnboardingStage(teacherProfileId: string) {
  const session = await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPER_ADMIN");
  if (!can(session.role, "teachers_manage")) return { ok: false as const, error: "Not permitted" };

  const profile = await db.teacherProfile.findUnique({ where: { id: teacherProfileId }, include: { user: true } });
  if (!profile) return { ok: false as const, error: "Not found" };
  const idx = ONBOARDING_STAGES.indexOf(profile.onboardingStage);
  if (idx < 0 || idx >= ONBOARDING_STAGES.length - 1) return { ok: false as const, error: "Already final" };

  const nextStage = ONBOARDING_STAGES[idx + 1]!;
  await db.teacherProfile.update({
    where: { id: profile.id },
    data: { onboardingStage: nextStage, approvedAt: nextStage === "APPROVED" ? new Date() : profile.approvedAt },
  });
  await audit(session.userId, "teacher.stage_advanced", "teacher_profile", profile.id, { from: profile.onboardingStage, to: nextStage });
  revalidatePath("/admin/teachers");
  return { ok: true as const, stage: nextStage };
}

// ── Report case lifecycle ────────────────────────────────────────────────────
const decisionSchema = z.object({
  caseDbId: z.string(),
  action: z.enum(["START_REVIEW", "REQUEST_TEACHER_RESPONSE", "DECIDE", "CLOSE"]),
  note: z.string().max(2000).optional(),
  decision: z.string().max(1000).optional(),
});

export async function actOnCase(input: unknown) {
  const session = await requireRole("MODERATOR", "SUPER_ADMIN");
  if (!can(session.role, "reports_decide")) return { ok: false as const, error: "Not permitted" };

  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const { caseDbId, action, note, decision } = parsed.data;

  const reportCase = await db.reportCase.findUnique({ where: { id: caseDbId } });
  if (!reportCase) return { ok: false as const, error: "Not found" };

  await db.$transaction(async (tx) => {
    const nowDate = new Date();
    let status = reportCase.status;
    switch (action) {
      case "START_REVIEW": status = "UNDER_REVIEW"; break;
      case "REQUEST_TEACHER_RESPONSE": status = "TEACHER_RESPONSE"; break;
      case "DECIDE":
        status = "DECIDED";
        if (!decision || decision.trim().length < 5) throw new Error("Decision text required");
        break;
      case "CLOSE": status = "CLOSED"; break;
    }
    await tx.reportCase.update({
      where: { id: caseDbId },
      data: {
        status,
        moderatorNotes: note ?? reportCase.moderatorNotes,
        decision: action === "DECIDE" ? decision! : reportCase.decision,
        decisionById: action === "DECIDE" ? session.userId : reportCase.decisionById,
        resolvedAt: action === "DECIDE" ? nowDate : reportCase.resolvedAt,
        closedAt: action === "CLOSE" ? nowDate : reportCase.closedAt,
      },
    });
    await tx.caseAction.create({
      data: {
        caseId: caseDbId,
        actorId: session.userId,
        action,
        note: note ?? decision ?? null,
      },
    });
  });

  await audit(session.userId, `case.${action.toLowerCase()}`, "report_case", reportCase.caseId, { note, decision });
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${caseDbId}`);
  return { ok: true as const };
}

// ── Retake decisions ─────────────────────────────────────────────────────────
/** Approval returns exactly one lesson credit (transactional + audited). */
export async function decideRetake(retakeDbId: string, approve: boolean, reviewNote?: string) {
  const session = await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPER_ADMIN");
  if (!can(session.role, "retakes_review")) return { ok: false as const, error: "Not permitted" };

  const retake = await db.retakeRequest.findUnique({ where: { id: retakeDbId } });
  if (!retake) return { ok: false as const, error: "Not found" };
  if (retake.status !== "PENDING") return { ok: false as const, error: "Already decided" };

  try {
    await db.$transaction(async (tx) => {
      if (approve) {
        // Credit refund is part of the same transaction — no partial updates.
        await applyLedgerEntry(tx, {
          studentId: retake.studentId,
          delta: +RETAKE_RULES.creditRefundedOnApproval,
          reason: "LESSON_REFUND_RETAKE",
          refType: "retake_request",
          refId: retake.id,
          idempotencyKey: `retake-refund-${retake.id}`,
        });
        await tx.retakeRequest.update({
          where: { id: retake.id },
          data: {
            status: "APPROVED",
            reviewedById: session.userId,
            reviewNote: reviewNote ?? null,
            creditReturned: true,
            decidedAt: new Date(),
          },
        });
      } else {
        await tx.retakeRequest.update({
          where: { id: retake.id },
          data: {
            status: "REJECTED",
            reviewedById: session.userId,
            reviewNote: reviewNote ?? null,
            creditReturned: false,
            decidedAt: new Date(),
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: retake.studentId,
          type: "system",
          titleKey: approve
            ? `Retake request ${retake.requestId} approved — 1 lesson credit returned`
            : `Retake request ${retake.requestId} was rejected`,
          link: "/student/billing",
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_CREDITS") {
      return { ok: false as const, error: "Wallet state invalid" };
    }
    console.error("decideRetake failed", e);
    return { ok: false as const, error: "Transaction failed" };
  }

  await audit(session.userId, approve ? "retake.approved" : "retake.rejected", "retake_request", retake.requestId, { reviewNote });
  revalidatePath("/admin/retakes");
  return { ok: true as const };
}

// ── Certificates ─────────────────────────────────────────────────────────────
export async function revokeCertificate(certificateDbId: string, reason: string) {
  const session = await requireRole("ACADEMIC_ADMIN", "SUPER_ADMIN");
  if (!can(session.role, "certificates_revoke")) return { ok: false as const, error: "Not permitted" };
  if (reason.trim().length < 10) return { ok: false as const, error: "Provide a reason (min 10 chars)." };

  const cert = await db.certificate.findUnique({ where: { id: certificateDbId } });
  if (!cert) return { ok: false as const, error: "Not found" };
  if (cert.status !== "VALID") return { ok: false as const, error: "Only valid certificates can be revoked." };

  await db.certificate.update({
    where: { id: cert.id },
    data: { status: "REVOKED", revokedReason: reason.trim(), revokedAt: new Date(), revokedById: session.userId },
  });
  await audit(session.userId, "certificate.revoked", "certificate", cert.serial, { reason: reason.trim() });
  revalidatePath("/admin/certificates");
  return { ok: true as const };
}
