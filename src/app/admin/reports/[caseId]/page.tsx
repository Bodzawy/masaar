import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { actOnCase } from "@/app/actions/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileSearch, Gavel, MessageSquare, Lock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Case detail" };

const LIFECYCLE = ["OPEN", "UNDER_REVIEW", "TEACHER_RESPONSE", "DECIDED", "CLOSED"];

// Evidence is confidential — only moderation roles may view it.
export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const session = await requireRole("MODERATOR", "SUPER_ADMIN");
  const { caseId } = await params;

  const reportCase = await db.reportCase.findUnique({
    where: { id: caseId },
    include: {
      opener: true,
      teacher: true,
      booking: { include: { lesson: true, liveSession: { include: { attendanceEvents: true } } } },
      evidence: true,
      actions: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!reportCase) notFound();

  const canSeeEvidence = session.role === "MODERATOR" || session.role === "SUPER_ADMIN";
  const stage = LIFECYCLE.indexOf(reportCase.status);

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/admin/reports" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden /> Meldungen
        </Link>
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xl font-bold">{reportCase.caseId}</span>
        <Badge variant={reportCase.status === "OPEN" ? "destructive" : reportCase.status === "CLOSED" ? "muted" : "warning"}>
          {reportCase.status.replaceAll("_", " ").toLowerCase()}
        </Badge>
        <time className="ms-auto text-xs text-muted-foreground">Eröffnet {formatDateTime(reportCase.createdAt)}</time>
      </header>

      {/* Lifecycle progress */}
      <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide" aria-label="Case lifecycle">
        {LIFECYCLE.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-1 ${i <= stage ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{({OPEN:"Offen",UNDER_REVIEW:"In Prüfung",TEACHER_RESPONSE:"Antwort der Lehrkraft",DECIDED:"Entschieden",CLOSED:"Geschlossen"} as Record<string,string>)[s] ?? s}</span>
            {i < LIFECYCLE.length - 1 && <span className="text-muted-foreground" aria-hidden>·</span>}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Report */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Meldung</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Grund</p>
              <p className="font-medium">{reportCase.reason.replaceAll("_", " ").toLowerCase()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Beteiligte</p>
              <p>{reportCase.opener.name} (Lernende:r) gegen {reportCase.teacher.name} (Lehrkraft)</p>
              {reportCase.booking && <p className="text-xs text-muted-foreground mt-0.5">Lesson: {reportCase.booking.lesson.titleDe} · {formatDateTime(reportCase.booking.scheduledAt)}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Beschreibung</p>
              <p className="leading-relaxed">{reportCase.description}</p>
            </div>
            {reportCase.teacherResponse && (
              <div>
                <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><MessageSquare className="h-3 w-3" aria-hidden /> Antwort der Lehrkraft</p>
                <p className="leading-relaxed">{reportCase.teacherResponse}</p>
              </div>
            )}
            {reportCase.decision && (
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Entscheidung</p>
                <p className="font-medium leading-relaxed">{reportCase.decision}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evidence + actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileSearch className="h-4 w-4 text-primary" aria-hidden /> Beweismittel</CardTitle></CardHeader>
            <CardContent>
              {!canSeeEvidence ? (
                <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-3 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0" aria-hidden /> Beweismittel ist der Moderation vorbehalten.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {reportCase.evidence.map((ev) => (
                    <li key={ev.id} className="rounded-lg border border-border bg-background p-3">
                      <Badge variant="muted">{ev.kind.replaceAll("_", " ").toLowerCase()}</Badge>
                      <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{ev.content}</p>
                    </li>
                  ))}
                  {reportCase.evidence.length === 0 && <li className="text-xs text-muted-foreground">Kein Beweismittel angehängt.</li>}
                  {reportCase.booking?.liveSession && (
                    <li className="rounded-lg border border-border bg-background p-3">
                      <Badge variant="muted">attendance record</Badge>
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {reportCase.booking.liveSession.attendanceEvents.map((ae) => (
                          <li key={ae.id}>{formatDateTime(ae.at)} — {ae.type.toLowerCase().replaceAll("_", " ")}</li>
                        ))}
                      </ul>
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Moderator actions (server actions) */}
          {reportCase.status !== "CLOSED" && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Gavel className="h-4 w-4 text-accent" aria-hidden /> Moderations-Aktionen</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(["START_REVIEW", "REQUEST_TEACHER_RESPONSE"] as const).map((action) => (
                  <form
                    key={action}
                    action={async (fd: FormData) => {
                      "use server";
                      await actOnCase({ caseDbId: reportCase.id, action, note: String(fd.get("note") ?? "") || undefined });
                    }}
                    className="flex gap-2"
                  >
                    <input type="hidden" name="note" value="" />
                    <Button type="submit" size="sm" variant="outline" disabled={stage >= LIFECYCLE.indexOf(action === "START_REVIEW" ? "UNDER_REVIEW" : "TEACHER_RESPONSE")}>
                      {action === "START_REVIEW" ? "Prüfung beginnen" : "Stellungnahme anfordern"}
                    </Button>
                  </form>
                ))}
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    await actOnCase({
                      caseDbId: reportCase.id,
                      action: "DECIDE",
                      decision: String(fd.get("decision") ?? ""),
                      note: String(fd.get("note") ?? "") || undefined,
                    });
                  }}
                  className="space-y-2 border-t border-border pt-4"
                >
                  <Textarea name="decision" rows={2} required minLength={5} placeholder="Entscheidung (z. B. Verwarnung erteilt…)" aria-label="Entscheidung" />
                  <Textarea name="note" rows={2} placeholder="Notizen der Moderation (optional)" aria-label="Notizen" />
                  <div className="flex justify-end gap-2">
                    <Button type="submit" size="sm">Entscheidung erfassen</Button>
                  </div>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await actOnCase({ caseDbId: reportCase.id, action: "CLOSE" });
                  }}
                  className="border-t border-border pt-3"
                >
                  <Button type="submit" size="sm" variant="ghost" className="w-full" disabled={reportCase.status !== "DECIDED"}>
                    Fall schließen
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Audit trail */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Audit-Protokoll</CardTitle><CardDescription>Jede Aktion zu diesem Fall.</CardDescription></CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {reportCase.actions.map((a) => (
                  <li key={a.id} className="border-s-2 border-primary/30 ps-3">
                    <p className="font-medium">{a.action.replaceAll("_", " ").toLowerCase()} <span className="font-normal text-muted-foreground">— {a.actor.name}</span></p>
                    {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
                    <time className="text-[11px] text-muted-foreground">{formatDateTime(a.createdAt)}</time>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
