import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Verfügbarkeit" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default async function AvailabilityPage() {
  const session = await requireRole("TEACHER");
  const profile = await db.teacherProfile.findUnique({ where: { userId: session.userId }, include: { availability: { orderBy: { weekday: "asc" } } } });
  if (!profile) return null;

  return (
    <div className="container max-w-3xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Verfügbarkeit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Deine wöchentlichen Zeitfenster für Sofort- und Geplant-Stunden.</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Wöchentliche Zeitfenster</CardTitle>
          <CardDescription>Die Bearbeitung folgt in einer nächsten Iteration; die Fenster stammen aus dem Onboarding.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {DAYS.map((day, i) => {
              const window = profile.availability.find((a) => a.weekday === i);
              return (
                <li key={day} className="flex items-center justify-between rounded-md border border-border px-4 py-2.5 text-sm">
                  <span className="font-medium">{day}</span>
                  {window ? (
                    <span className="tabular-nums text-success">{minutesToTime(window.startMinute)} – {minutesToTime(window.endMinute)}</span>
                  ) : (
                    <span className="text-muted-foreground">Nicht verfügbar</span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
