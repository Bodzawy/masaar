import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertLevelExamAccess } from "@/domain/progression";
import { CERTIFICATE_RULES } from "@/config/domain";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, ShieldAlert, CalendarClock } from "lucide-react";

export const metadata = { title: "Final level exam" };

export default async function FinalExamPage() {
  const session = await requireRole("STUDENT");
  const enrollment = await db.enrollment.findFirst({
    where: { studentId: session.userId, status: "ACTIVE" },
    include: { level: true },
  });
  if (!enrollment) {
    return <p className="py-20 text-center text-sm text-muted-foreground">No active enrollment.</p>;
  }
  const access = await assertLevelExamAccess(session.userId, enrollment.levelId);

  return (
    <div className="container max-w-3xl space-y-6 py-2 animate-fade-in">
      <header className="flex items-center gap-3">
        <Award className="h-7 w-7 text-accent" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Final exam — {enrollment.level.code}</h1>
          <p className="text-sm text-muted-foreground">{enrollment.level.title}</p>
        </div>
      </header>

      {!access.ok ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">Not yet eligible</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pass every chapter exam of this level to unlock the final exam.
            </p>
            <Button size="sm" className="mt-4" asChild><Link href="/student/exams">Back to exams</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" aria-hidden /> Schedule your exam</CardTitle>
              <CardDescription>Choose an available slot. The exam takes about 60 minutes.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Scheduling opens once the proctoring partner is connected. In this demo build you can preview all
                requirements below; taking the final exam uses a clearly labeled demo proctoring placeholder.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-destructive" aria-hidden /> Proctoring requirements</CardTitle>
              <CardDescription>{CERTIFICATE_RULES.issuerLine} — identity is verified by our proctoring partner.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {["Identity verification", "Webcam monitoring", "Microphone monitoring", "Screen monitoring", "Full-screen mode", "Browser restrictions", "Live proctor", "Session recording"].map((label) => (
                  <li key={label} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                    {label}
                    <Badge variant="muted">Demo placeholder</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Integration boundary: real secure proctoring requires vendor credentials and contractual setup.
                Nothing on this page simulates being “connected”.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
