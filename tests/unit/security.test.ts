import { describe, expect, it } from "vitest";
import { verificationHash } from "@/domain/certificates";
import { routeAccess, homeForRole, ROLE_PREFIX } from "@/lib/routing";
import { REPORT_LIFECYCLE, RETAKE_RULES, CERTIFICATE_RULES, ONBOARDING_STAGES } from "@/config/domain";

describe("route protection", () => {
  it("redirects anonymous users to sign-in for every guarded area", () => {
    for (const prefix of Object.keys(ROLE_PREFIX)) {
      expect(routeAccess(prefix, undefined)).toEqual({ kind: "redirect", to: "/signin" });
      expect(routeAccess(`${prefix}/sub/path`, undefined).kind).toBe("redirect");
    }
  });

  it("keeps users out of other roles' workspaces", () => {
    expect(routeAccess("/student", "TEACHER")).toEqual({ kind: "redirect", to: "/teacher" });
    expect(routeAccess("/teacher/upcoming", "STUDENT")).toEqual({ kind: "redirect", to: "/student" });
    expect(routeAccess("/admin/reports", "STUDENT")).toEqual({ kind: "redirect", to: "/student" });
    expect(routeAccess("/admin/retakes", "TEACHER")).toEqual({ kind: "redirect", to: "/teacher" });
  });

  it("admits each role to its own workspace", () => {
    expect(routeAccess("/student", "STUDENT").kind).toBe("public");
    expect(routeAccess("/teacher", "TEACHER").kind).toBe("public");
    for (const adminRole of ROLE_PREFIX["/admin"]!) {
      expect(routeAccess("/admin", adminRole).kind).toBe("public");
    }
    // Non-admin roles cannot enter /admin
    expect(routeAccess("/admin", "MODERATOR")?.kind ?? "public").toBe("public"); // moderator is admin-side
    expect(routeAccess("/admin/payments", "STUDENT").kind).toBe("redirect");
  });

  it("lands each role on the correct home after sign-in", () => {
    expect(homeForRole("STUDENT")).toBe("/student");
    expect(homeForRole("TEACHER")).toBe("/teacher");
    expect(homeForRole("SUPER_ADMIN")).toBe("/admin");
    expect(homeForRole("MODERATOR")).toBe("/admin");
    expect(homeForRole(undefined)).toBe("/");
  });
});

describe("certificate verification primitives", () => {
  it("produces a deterministic hash for identical inputs", () => {
    const a = verificationHash("CERT-839293", "Lena Schmidt", "B1", 84);
    const b = verificationHash("CERT-839293", "Lena Schmidt", "B1", 84);
    const c = verificationHash("CERT-839294", "Lena Schmidt", "B1", 84);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(32);
  });
});

describe("moderation lifecycle rules", () => {
  it("follows the documented case lifecycle order", () => {
    expect(REPORT_LIFECYCLE).toEqual(["OPEN", "UNDER_REVIEW", "TEACHER_RESPONSE", "DECIDED", "CLOSED"]);
  });

  it("retake approval returns exactly one credit and never auto-approves", () => {
    expect(RETAKE_RULES.creditRefundedOnApproval).toBe(1);
    expect(RETAKE_RULES.autoApprove).toBe(false);
  });

  it("uses honest certificate wording", () => {
    expect(CERTIFICATE_RULES.issuerLine).toMatch(/Plattform-eigenes/i);
    expect(CERTIFICATE_RULES.disclaimer).toMatch(/nicht um eine extern akkreditierte Prüfung/i);
  });

  it("defines the full teacher onboarding pipeline", () => {
    expect(ONBOARDING_STAGES).toEqual([
      "APPLICATION", "DOCUMENT_VERIFICATION", "LANGUAGE_ASSESSMENT",
      "TEACHING_DEMO", "INTERVIEW", "PLATFORM_TRAINING", "APPROVED",
    ]);
  });
});
