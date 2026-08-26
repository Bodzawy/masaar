import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { decideRetake } from "@/app/actions/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Wiederholungsanfragen" };

export default async function RetakesPage() {
  await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPER_ADMIN");
  const retakes = await db.retakeRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { name: true } },
      teacher: { select: { name: true } },
      lesson: { select: { titleDe: true } },
      reviewer: { select: { name: true } },
    },
  });

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Retake Requests</h1>
        <CardDescription>
          Bei Genehmigung wird genau ein Unterrichtsguthaben zurückgegeben; die Lektion kann mit einer anderen Lehrkraft wiederholt werden.
          Rückerstattungen erfolgen nie automatisch – jede Entscheidung wird auditert.
        </CardDescription>
      </header>

      <ul className="space-y-3">
        {retakes.map((r) => (
          <li key={r.id}>
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <RefreshCcw className="h-4 w-4 text-primary" aria-hidden />
                  <span className="font-mono font-semibold">{r.requestId}</span>
                  <Badge variant={r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "destructive" : "muted"}>
                    {r.status === "PENDING" ? "offen" : r.status === "APPROVED" ? "genehmigt" : r.status === "REJECTED" ? "abgelehnt" : r.status.toLowerCase()}
                  </Badge>
                  <time className="ms-auto text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</time>
                </div>
                <p className="mt-3 leading-relaxed">{r.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.student.name} · teacher {r.teacher.name} · lesson &bdquo;{r.lesson.titleDe}&ldquo;
                  {r.creditReturned && <> · <strong className="text-success">1 Guthaben zurückgegeben</strong></>}
                </p>

                {r.status === "PENDING" ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    <form
                      action={async () => {
                        "use server";
                        await decideRetake(r.id, true, "Approved after review");
                      }}
                    >
                      <Button type="submit" size="sm" variant="success">Genehmigen & Guthaben zurückgeben</Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await decideRetake(r.id, false, "Rejected after review");
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline" className="text-destructive hover:text-destructive">Ablehnen</Button>
                    </form>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Geprüft von {r.reviewer?.name ?? "—"}{r.decidedAt ? ` · ${formatDateTime(r.decidedAt)}` : ""}
                    {r.reviewNote ? ` — ${r.reviewNote}` : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
        {retakes.length === 0 && (
          <li><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Keine Wiederholungsanfragen.</CardContent></Card></li>
        )}
      </ul>
    </div>
  );
}
