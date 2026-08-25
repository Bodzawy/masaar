import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { addTeacherNote } from "@/app/actions/homework";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { ArrowLeft, StickyNote } from "lucide-react";

export const metadata = { title: "Student history" };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("TEACHER");
  const { id: studentId } = await params;

  const student = await db.user.findUnique({
    where: { id: studentId },
    include: {
      studentProfile: true,
      skillScores: true,
      lessonProgress: { where: { status: "COMPLETED" }, include: { lesson: true }, orderBy: { completedAt: "desc" }, take: 8 },
    },
  });
  if (!student || student.roleType !== "STUDENT") notFound();

  // Only the teachers who taught this student may view the profile.
  const taught = await db.booking.count({ where: { teacherId: session.userId, studentId } });
  const isModerator = false; // teacher workspace only
  if (taught === 0 && !isModerator) notFound();

  const [notes, failedQuizzes] = await Promise.all([
    db.teacherNote.findMany({ where: { studentId, authorId: session.userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.quizAttempt.findMany({ where: { studentId, status: "FAILED" }, orderBy: { submittedAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/teacher/students" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden /> Students
        </Link>
      </nav>

      <header className="flex flex-wrap items-center gap-4">
        <UserAvatar name={student.name} color={student.avatarColor} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{student.name}</h1>
          <p className="text-sm text-muted-foreground">
            {student.studentProfile?.nativeLanguage ?? "—"} speaker · Goal: {student.studentProfile?.learningGoal ?? "—"}
            {student.studentProfile?.studyPreference ? ` · ${student.studentProfile.studyPreference}` : ""}
          </p>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Skill profile */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Skill profile</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {student.skillScores.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex justify-between text-xs"><span>{s.skill.toLowerCase()}</span><span className="text-muted-foreground tabular-nums">{s.score}</span></div>
                <Progress value={s.score} indicatorClassName={s.score >= 70 ? "bg-success" : s.score >= 50 ? "bg-primary" : "bg-warning"} />
              </div>
            ))}
            {failedQuizzes.length > 0 && (
              <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
                Failed quizzes: {failedQuizzes.length} — consider reviewing those topics next session.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Learning history */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent completions</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {student.lessonProgress.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md px-2 py-1.5 odd:bg-muted/60">
                  <span className="min-w-0 truncate">{p.lesson.titleDe}</span>
                  <Badge variant="success" className="ms-2 shrink-0">{p.quizBestScore ?? 0}%</Badge>
                </li>
              ))}
              {student.lessonProgress.length === 0 && <li className="text-xs text-muted-foreground">No completed lessons yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Internal notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="h-4 w-4 text-primary" aria-hidden /> Internal notes</CardTitle>
          <CardDescription>Private to you. Students never see these.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData: FormData) => {
              "use server";
              const body = String(formData.get("note") ?? "");
              if (body.trim().length >= 3) await addTeacherNote(studentId, body);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Textarea name="note" rows={2} placeholder="Recurring mistakes, pronunciation notes, recommended focus…" required minLength={3} className="flex-1" aria-label="New internal note" />
            <Button type="submit" className="sm:self-end">Save note</Button>
          </form>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm leading-relaxed">{n.body}</p>
                <time className="mt-1 block text-[11px] text-muted-foreground">{n.createdAt.toLocaleString("en-GB")}</time>
              </li>
            ))}
            {notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
