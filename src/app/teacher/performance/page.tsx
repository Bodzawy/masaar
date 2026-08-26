import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { QUALITY_WEIGHTS } from "@/config/domain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Leistung & Feedback" };

const WEIGHT_LABELS: Record<keyof typeof QUALITY_WEIGHTS, string> = {
  avgRating: "Average rating",
  completionRate: "Lesson completion",
  studentQuizPerformance: "Student quiz performance",
  lowRetakeRate: "Low retake rate",
  lowComplaintRate: "Low complaint rate",
  attendanceReliability: "Attendance reliability",
  lowCancellationRate: "Cancellation rate (low is good)",
  fastResponseTime: "Response time",
  auditOutcome: "Audit outcomes",
};

export default async function PerformancePage() {
  const session = await requireRole("TEACHER");
  const profile = await db.teacherProfile.findUnique({ where: { userId: session.userId } });
  if (!profile) return null;
  const ratings = await db.teacherRating.findMany({
    where: { teacherId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { student: { select: { name: true } } },
  });

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Leistung & Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">So setzt sich deine Qualitätspunktzahl zusammen – und was Lernende sagen.</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            Qualitätspunktzahl
            <span className="text-xl font-bold tabular-nums">{profile.qualityScore}/100</span>
          </CardTitle>
          <CardDescription>Gewichtete Berechnung – dokumentiert im Qualitätssystem.</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={profile.qualityScore} indicatorClassName={profile.qualityScore >= 80 ? "bg-success" : profile.qualityScore >= 70 ? "bg-warning" : "bg-destructive"} />
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {(Object.entries(QUALITY_WEIGHTS) as Array<[keyof typeof QUALITY_WEIGHTS, number]>).map(([key, weight]) => (
              <li key={key} className="flex items-center justify-between rounded-md px-2 py-1 odd:bg-muted/60 text-sm">
                <span>{WEIGHT_LABELS[key]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{Math.round(weight * 100)}%</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Feedback der Lernenden</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          {ratings.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Star className="h-4 w-4 fill-accent text-accent" aria-hidden />
                <span className="font-semibold">{r.overall}.0</span>
                <span className="text-xs text-muted-foreground">· {r.student.name} · {formatDate(r.createdAt)}</span>
                <Badge variant="muted" className="ms-auto">{r.explanation}/5 Erklärung · {r.punctuality}/5 pünktlich</Badge>
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">“{r.comment}”</p>}
            </div>
          ))}
          {ratings.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Bewertungen.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
