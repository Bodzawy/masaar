import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getLiveProvider } from "@/lib/live/provider";
import { Classroom } from "@/components/classroom/classroom";

export const metadata = { title: "Live Classroom" };

export default async function TeacherClassroomPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await requireRole("TEACHER");
  const { bookingId } = await params;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      student: { include: { studentProfile: true } },
      teacher: true,
      lesson: { include: { objectives: true, materials: true } },
      liveSession: true,
    },
  });
  if (!booking || booking.teacherId !== session.userId) notFound();
  if (booking.status === "COMPLETED") redirect(`/teacher`);

  // Student preview data for the sidebar checklist context
  const [pastScores, notes] = await Promise.all([
    db.lessonProgress.findMany({
      where: { studentId: booking.studentId, quizBestScore: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { lesson: { select: { titleDe: true } } },
    }),
    db.teacherNote.findMany({ where: { authorId: session.userId, studentId: booking.studentId }, orderBy: { createdAt: "desc" }, take: 2 }),
  ]);

  const provider = getLiveProvider();

  return (
    <div>
      <Classroom
        bookingId={booking.id}
        role="TEACHER"
        selfName={session.name}
        selfColor={(await db.user.findUnique({ where: { id: session.userId }, select: { avatarColor: true } }))?.avatarColor ?? "#0F766E"}
        peerName={booking.student.name}
        peerColor={booking.student.avatarColor}
        lessonTitle={booking.lesson.titleDe}
        lessonMaterial={
          booking.lesson.materials[0]
            ? { title: booking.lesson.materials[0].title, body: booking.lesson.materials[0].body }
            : null
        }
        objectives={[
          ...booking.lesson.objectives.map((o) => ({ id: o.id, text: o.text })),
          ...pastScores.map((p) => ({ id: `s-${p.id}`, text: `Review: ${p.lesson.titleDe} — last quiz ${p.quizBestScore}%` })),
          ...(notes.length ? [{ id: "note", text: `Note from last lesson: ${notes[0]!.body.slice(0, 90)}…` }] : []),
        ]}
        demoMode={provider.demoMode}
        providerName={provider.name}
        postLessonHref={`/teacher/students/${booking.studentId}`}
      />
    </div>
  );
}
