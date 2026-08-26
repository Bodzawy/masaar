import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Lernende" };

export default async function AdminStudentsPage() {
  await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPPORT_ADMIN", "MODERATOR", "FINANCE_ADMIN", "SUPER_ADMIN");
  const students = await db.user.findMany({
    where: { roleType: "STUDENT" },
    orderBy: { createdAt: "desc" },
    include: {
      studentProfile: true,
      progressRecords: true,
      enrollments: { include: { level: true } },
    },
  });

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">{students.length} registrierte Lernende.</p>
      </header>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Lernende:r</th>
                  <th className="px-4 py-3 font-medium">Land</th>
                  <th className="px-4 py-3 font-medium">Niveau</th>
                  <th className="px-4 py-3 font-medium">Fortschritt</th>
                  <th className="px-4 py-3 font-medium">Beigetreten</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const active = s.enrollments.find((e) => e.status === "ACTIVE")?.level;
                  const progress = s.progressRecords.find((p) => p.levelCode === active?.code);
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/teacher/students/${s.id}`} className="font-medium hover:text-primary">{s.name}</Link>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{s.studentProfile?.country ?? "—"}</td>
                      <td className="px-4 py-3">{active ? <Badge variant="default">{active.code}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 tabular-nums text-xs">{progress ? `${progress.completionPercent}%` : "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3"><Badge variant={s.status === "ACTIVE" ? "success" : "destructive"}>{s.status === "ACTIVE" ? "aktiv" : "gesperrt"}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
