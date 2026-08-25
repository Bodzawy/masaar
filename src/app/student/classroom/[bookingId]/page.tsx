import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getLiveProvider } from "@/lib/live/provider";
import { Classroom } from "@/components/classroom/classroom";

export const metadata = { title: "Live Classroom" };

export default async function StudentClassroomPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await requireRole("STUDENT");
  const { bookingId } = await params;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      teacher: true,
      lesson: { include: { objectives: true, materials: true } },
      liveSession: true,
    },
  });
  if (!booking || booking.studentId !== session.userId) notFound();

  const provider = getLiveProvider();
  if (booking.status === "COMPLETED") redirect(`/student/post-lesson/${booking.id}`);

  return (
    <Classroom
      bookingId={booking.id}
      role="STUDENT"
      selfName={session.name}
      selfColor="#4338CA"
      peerName={booking.teacher.name}
      peerColor={booking.teacher.avatarColor}
      lessonTitle={booking.lesson.titleDe}
      lessonMaterial={
        booking.lesson.materials[0]
          ? { title: booking.lesson.materials[0].title, body: booking.lesson.materials[0].body }
          : null
      }
      objectives={booking.lesson.objectives.map((o) => ({ id: o.id, text: o.text }))}
      demoMode={provider.demoMode}
      providerName={provider.name}
      postLessonHref={`/student/post-lesson/${booking.id}`}
    />
  );
}
