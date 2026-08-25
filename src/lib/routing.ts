// Route-protection rules shared by middleware (edge) and tests.
export const ROLE_PREFIX: Record<string, string[]> = {
  "/student": ["STUDENT"],
  "/teacher": ["TEACHER"],
  "/admin": [
    "ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPPORT_ADMIN",
    "MODERATOR", "FINANCE_ADMIN", "SUPER_ADMIN",
  ],
};

export function homeForRole(role?: string): string {
  switch (role) {
    case "TEACHER": return "/teacher";
    case "STUDENT": return "/student";
    default: return role && role !== "STUDENT" ? "/admin" : "/";
  }
}

/** Resolve access for a guarded pathname + role. */
export function routeAccess(pathname: string, role?: string): { kind: "public" | "redirect"; to?: string } {
  const guarded = Object.keys(ROLE_PREFIX).find((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!guarded) return { kind: "public" };
  if (!role) return { kind: "redirect", to: "/signin" };
  if (!ROLE_PREFIX[guarded]!.includes(role)) return { kind: "redirect", to: homeForRole(role) };
  return { kind: "public" };
}
