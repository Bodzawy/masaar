import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Availability" };

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
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your weekly windows for instant and scheduled lessons.</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weekly windows</CardTitle>
          <CardDescription>Editing availability is part of the next iteration; windows were set during onboarding.</CardDescription>
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
                    <span className="text-muted-foreground">Unavailable</span>
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
