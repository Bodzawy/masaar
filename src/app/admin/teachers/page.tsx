import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceOnboardingStage } from "@/app/actions/admin";
import { ONBOARDING_STAGES, TEACHER_RANKS, type TeacherRankKey } from "@/config/domain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";

export const metadata = { title: "Lehrkräfte & Onboarding" };

const QUALITY_VARIANT = { GOOD_STANDING: "success", WARNING: "warning", UNDER_REVIEW: "accent", SUSPENDED: "destructive" } as const;

export default async function AdminTeachersPage() {
  await requireRole("ACADEMIC_ADMIN", "TEACHER_MANAGER", "SUPER_ADMIN");

  const teachers = await db.teacherProfile.findMany({
    orderBy: [{ onboardingStage: "asc" }, { rank: "desc" }],
    include: { user: true },
  });

  const pipeline = teachers.filter((t) => t.onboardingStage !== "APPROVED");
  const active = teachers.filter((t) => t.onboardingStage === "APPROVED");
  const stageIndex = (s: string) => ONBOARDING_STAGES.indexOf(s as never);

  return (
    <div className="container max-w-6xl space-y-8 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Teachers & Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline: {ONBOARDING_STAGES.map((s) => s.replaceAll("_", " ").toLowerCase()).join(" → ")}
        </p>
      </header>

      {/* Onboarding pipeline */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bewerbungen ({pipeline.length})</h2>
        {pipeline.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Keine laufenden Bewerbungen.</CardContent></Card>
        ) : (
          <ul className="space-y-3">
            {pipeline.map((t) => (
              <li key={t.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4 p-4">
                    <UserAvatar name={t.user.name} color={t.user.avatarColor} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.headline} · {t.certification}</p>
                    </div>
                    <ol className="flex flex-wrap gap-1" aria-label={`Stage ${stageIndex(t.onboardingStage) + 1} of ${ONBOARDING_STAGES.length}`}>
                      {ONBOARDING_STAGES.map((s, i) => (
                        <li
                          key={s}
                          title={s}
                          className={`h-2 w-6 rounded-full ${i <= stageIndex(t.onboardingStage) ? "bg-primary" : "bg-muted"}`}
                        />
                      ))}
                    </ol>
                    <Badge variant="accent">{t.onboardingStage.replaceAll("_", " ").toLowerCase()}</Badge>
                    <form
                      action={async () => {
                        "use server";
                        await advanceOnboardingStage(t.id);
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline">Nächste Phase</Button>
                    </form>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active teachers */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Aktive Lehrkräfte ({active.length})</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {active.map((t) => (
            <li key={t.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-wrap items-start gap-4 p-4">
                  <div className="relative shrink-0">
                    <UserAvatar name={t.user.name} color={t.user.avatarColor} />
                    <span className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card ${t.isOnline ? "bg-success" : "bg-muted-foreground/40"}`} aria-label={t.isOnline ? "Online" : "Offline"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TEACHER_RANKS[t.rank as TeacherRankKey].label} · unterrichtet bis {TEACHER_RANKS[t.rank as TeacherRankKey].maxLevel}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {t.completedLessons.toLocaleString()} Einheiten · Storno {t.cancellationRatePct}% · Antwort ~{t.responseTimeMinutes} Min.
                    </p>
                  </div>
                  <div className="text-end">
                    <Badge variant={QUALITY_VARIANT[t.qualityState]}>{t.qualityScore}/100</Badge>
                    <p className="mt-1 text-[11px] text-muted-foreground">{QUALITY_VARIANT[t.qualityState] === "success" ? "Gute Qualität" : t.qualityState.replaceAll("_", " ").toLowerCase()}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
