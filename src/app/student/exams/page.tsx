import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPathForStudent } from "@/domain/progression";
import type { CefrCode } from "@/config/domain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, ShieldCheck, Lock, CheckCircle2, CircleDashed } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { CERTIFICATE_RULES } from "@/config/domain";

export const metadata = { title: "Prüfungen & Zertifikate" };

export default async function ExamsPage() {
  const session = await requireRole("STUDENT");
  const enrollment = await db.enrollment.findFirst({
    where: { studentId: session.userId, status: "ACTIVE" },
    include: { level: true },
  });
  const code = (enrollment?.level.code ?? "A1") as CefrCode;
  const path = await getPathForStudent(session.userId, code);

  const [certificates, examAttempts] = await Promise.all([
    db.certificate.findMany({ where: { studentId: session.userId }, include: { level: true }, orderBy: { issuedAt: "desc" } }),
    db.examAttempt.findMany({ where: { studentId: session.userId }, orderBy: { createdAt: "desc" }, take: 10, include: { chapterExam: { include: { chapter: true } }, levelExam: { include: { level: true } } } }),
  ]);

  const proctoringItems = [
    { label: "Identity verification", connected: false },
    { label: "Webcam monitoring", connected: false },
    { label: "Microphone monitoring", connected: false },
    { label: "Screen monitoring", connected: false },
    { label: "Full-screen mode", connected: true },
    { label: "Browser restrictions", connected: false },
    { label: "Live proctor", connected: false },
    { label: "Session recording", connected: false },
  ];

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Prüfungen & Zertifikate</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kapitelprüfungen, die Abschlussprüfung und deine Zertifikate.</p>
      </header>

      {/* Final level exam status */}
      {path?.finalExam && (
        <Card className={path.finalExam.unlocked && !path.finalExam.passed ? "border-accent/50" : ""}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Award className={`h-5 w-5 ${path.finalExam.passed ? "text-success" : path.finalExam.unlocked ? "text-accent" : "text-muted-foreground"}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">Abschlussprüfung – {code}</CardTitle>
                <CardDescription>
                  {path.finalExam.passed
                    ? "Passed! Your certificate is listed below."
                    : path.finalExam.unlocked
                      ? "You passed all chapter exams. Schedule your proctored final exam."
                      : `Pass all chapter exams to unlock (${path.chapters.filter((c) => c.examPassed).length}/${path.chapters.length} done).`}
                </CardDescription>
              </div>
              {path.finalExam.unlocked && !path.finalExam.passed && (
                <Button size="sm" asChild><Link href={`/student/exams/final`}>Anforderungen ansehen</Link></Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Chapter exams */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Kapitelprüfungen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(path?.chapters ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3">
              {c.examPassed ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              ) : c.examUnlocked ? (
                <CircleDashed className="h-4 w-4 text-accent" aria-hidden />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.titleDe}</span>
              {c.examPassed ? (
                <Badge variant="success">Passed</Badge>
              ) : c.examUnlocked ? (
                <Button size="sm" asChild><Link href={`/student/exams/chapter/${c.id}`}>Prüfung starten</Link></Button>
              ) : (
                <Badge variant="muted">Zuerst Lektionen abschließen</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Proctoring boundary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Prüfungsaufsicht (Integrationsgrenze)</CardTitle>
          <CardDescription>
            Integrationsgrenze: Die Punkte zeigen Anbieter-Status. Echte Prüfungsaufsicht benötigt Zugangsdaten und ist hier nicht verbunden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {proctoringItems.map((item) => (
              <li key={item.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                {item.label}
                <Badge variant={item.connected ? "success" : "muted"}>{item.connected ? "Verbunden" : "Demo-Platzhalter"}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Attempts */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Letzte Versuche</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {examAttempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 odd:bg-muted/60">
                <span className="w-24 text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {a.kind === "CHAPTER" ? a.chapterExam?.chapter.titleDe : `Abschlussprüfung ${a.levelExam?.level.code}`}
                </span>
                <span className="tabular-nums text-xs">{a.score}%</span>
                <Badge variant={a.passed ? "success" : "destructive"}>{a.passed ? "Bestanden" : "Nicht bestanden"}</Badge>
              </li>
            ))}
            {examAttempts.length === 0 && <li className="text-xs text-muted-foreground">Noch keine Versuche.</li>}
          </ul>
        </CardContent>
      </Card>

      {/* Certificates */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Zertifikate</CardTitle><CardDescription>{CERTIFICATE_RULES.issuerLine}</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3">
              <Award className="h-5 w-5 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{cert.level.code} · {cert.level.title}</p>
                <p className="text-xs text-muted-foreground">{cert.serial} · Ergebnis {cert.score}% · Ausgestellt {formatDate(cert.issuedAt)}</p>
              </div>
              <Badge variant={cert.status === "VALID" ? "success" : cert.status === "REVOKED" ? "destructive" : "muted"}>{cert.status.toLowerCase()}</Badge>
              <Button size="sm" variant="outline" asChild><Link href={`/verify/${cert.serial}`}>Verifizieren</Link></Button>
            </div>
          ))}
          {certificates.length === 0 && <p className="text-sm text-muted-foreground">Schließe ein Niveau ab, um dein erstes Zertifikat zu erhalten.</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{CERTIFICATE_RULES.disclaimer}</p>
        </CardContent>
      </Card>
    </div>
  );
}
