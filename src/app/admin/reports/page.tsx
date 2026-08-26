import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Meldungen & Untersuchungen" };

const STATUS_VARIANT: Record<string, "destructive" | "warning" | "accent" | "default" | "muted"> = {
  OPEN: "destructive",
  UNDER_REVIEW: "warning",
  TEACHER_RESPONSE: "accent",
  DECIDED: "default",
  CLOSED: "muted",
};

export default async function ReportsPage() {
  await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "MODERATOR", "SUPER_ADMIN");
  const cases = await db.reportCase.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      opener: { select: { name: true } },
      teacher: { select: { name: true } },
    },
  });

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Reports & Investigations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ablauf: Offen → In Prüfung → Antwort der Lehrkraft → Entscheidung → Geschlossen.
        </p>
      </header>

      {cases.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center p-10 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">Keine Fälle</p>
        </CardContent></Card>
      ) : (
        <ul className="space-y-2.5">
          {cases.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/reports/${c.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="font-mono text-sm font-semibold">{c.caseId}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{c.reason.replaceAll("_", " ").toLowerCase()} – {c.opener.name} gegen {c.teacher.name}</span>
                <time className="hidden text-xs text-muted-foreground sm:block">{formatDate(c.createdAt)}</time>
                <Badge variant={STATUS_VARIANT[c.status]}>{c.status.replaceAll("_", " ").toLowerCase()}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
