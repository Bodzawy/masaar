import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS, ROLE_PERMISSIONS, type RoleTypeKey } from "@/config/domain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, CheckCircle2, Minus } from "lucide-react";

export const metadata = { title: "Roles & Permissions" };

const ROLE_ORDER: RoleTypeKey[] = ["SUPER_ADMIN", "ACADEMIC_ADMIN", "TEACHER_MANAGER", "MODERATOR", "SUPPORT_ADMIN", "FINANCE_ADMIN", "TEACHER", "STUDENT"];

export default async function RolesPage() {
  const session = await requireRole("ACADEMIC_ADMIN", "SUPER_ADMIN");
  const rolesInDb = await db.role.findMany({ include: { permissions: { include: { permission: true } } } });
  void rolesInDb;

  const permKeys = Object.keys(PERMISSIONS) as Array<keyof typeof PERMISSIONS>;

  return (
    <div className="container max-w-6xl space-y-6 animate-fade-in">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><KeyRound className="h-5 w-5 text-primary" aria-hidden /> Roles & Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Permission matrix enforced by middleware and server actions. You are signed in as {session.role}.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Matrix</CardTitle><CardDescription>Source of truth: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">src/config/domain.ts</code>.</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Permission</th>
                  {ROLE_ORDER.map((role) => (
                    <th key={role} className="px-1 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{role.replace("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permKeys.map((perm) => (
                  <tr key={perm} className="border-b border-border last:border-0">
                    <td className="px-2 py-2">
                      <code className="text-xs font-medium">{perm}</code>
                      <p className="text-[11px] text-muted-foreground">{PERMISSIONS[perm]}</p>
                    </td>
                    {ROLE_ORDER.map((role) => {
                      const has = ROLE_PERMISSIONS[role].includes(perm);
                      return (
                        <td key={role} className="px-1 py-2 text-center">
                          {has ? <CheckCircle2 className="mx-auto h-4 w-4 text-success" aria-label={`${role} has ${perm}`} /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-hidden />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Roles in database</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {rolesInDb.map((r) => <Badge key={r.id} variant={ROLE_PERMISSIONS[r.key].length > 0 ? "default" : "secondary"}>{r.name}</Badge>)}
        </CardContent>
      </Card>
    </div>
  );
}
