import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";

export const metadata = { title: "Students" };

export default async function TeacherStudentsPage() {
  const session = await requireRole("TEACHER");
  // Distinct students this teacher has taught
  const bookings = await db.booking.findMany({
    where: { teacherId: session.userId },
    orderBy: { scheduledAt: "desc" },
    include: { student: true, lesson: true },
  });
  const seen = new Map<string, { name: string; color: string; lastLesson: string; lastDate: Date; count: number }>();
  for (const b of bookings) {
    const entry = seen.get(b.studentId);
    if (entry) {
      entry.count += 1;
    } else {
      seen.set(b.studentId, { name: b.student.name, color: b.student.avatarColor, lastLesson: b.lesson.titleDe, lastDate: b.scheduledAt, count: 1 });
    }
  }

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everyone you have taught, with their latest lesson.</p>
      </header>

      {seen.size === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No students yet.</CardContent></Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {[...seen.entries()].map(([id, s]) => (
            <li key={id}>
              <Link href={`/teacher/students/${id}`} className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center gap-3">
                  <UserAvatar name={s.name} color={s.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">Last: {s.lastLesson}</p>
                    <p className="text-xs text-muted-foreground">{s.count} lesson{s.count > 1 ? "s" : ""}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
