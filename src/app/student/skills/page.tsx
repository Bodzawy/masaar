import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SkillRadarMini } from "@/components/student/skill-radar-mini";

export const metadata = { title: "Fähigkeiten & Fortschritt" };

const SKILL_LABELS: Record<string, string> = {
  READING: "Reading", LISTENING: "Listening", WRITING: "Writing",
  SPEAKING: "Speaking", GRAMMAR: "Grammar", VOCABULARY: "Vocabulary",
};

export default async function SkillsPage() {
  const session = await requireRole("STUDENT");
  const [skills, progressRows] = await Promise.all([
    db.skillScore.findMany({ where: { studentId: session.userId }, orderBy: { skill: "asc" } }),
    db.studentProgress.findMany({ where: { studentId: session.userId }, orderBy: { levelCode: "asc" } }),
  ]);
  const sorted = [...skills].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Fähigkeiten & Fortschritt</h1>
        <p className="mt-1 text-sm text-muted-foreground">Die Punktzahlen aktualisieren sich nach Quiz, Hausaufgaben und Live-Stunden.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Fähigkeitsprofil</CardTitle></CardHeader>
          <CardContent><SkillRadarMini data={skills.map((s) => ({ skill: s.skill, score: s.score }))} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle>Detailansicht</CardTitle></CardHeader>
          <CardContent className="space-y-3.5">
            {skills.map((s) => (
              <div key={s.skill}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className={weakest?.skill === s.skill ? "font-medium text-accent-foreground" : ""}>{SKILL_LABELS[s.skill]}</span>
                  <span className="text-xs text-muted-foreground">{s.score}/100</span>
                </div>
                <Progress
                  value={s.score}
                  indicatorClassName={
                    s.score >= 70 ? "bg-success" : s.score >= 50 ? "bg-primary" : "bg-warning"
                  }
                />
              </div>
            ))}
            {strongest && weakest && (
              <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
                Strongest: <strong>{SKILL_LABELS[strongest.skill]}</strong> · Needs attention:{" "}
                <strong>{SKILL_LABELS[weakest.skill]}</strong> ({weakest.score})
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle>Niveau-Fortschritt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {progressRows.map((p) => (
            <div key={p.levelCode}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{p.levelCode}</span>
                <span className="text-xs text-muted-foreground">{p.completionPercent}% · {p.xp} XP</span>
              </div>
              <Progress value={p.completionPercent} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
