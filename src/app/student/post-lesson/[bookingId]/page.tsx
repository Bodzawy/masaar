import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PostLessonForm } from "@/components/student/post-lesson-form";

export const metadata = { title: "Rate your lesson" };

export default async function PostLessonPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await requireRole("STUDENT");
  const { bookingId } = await params;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { teacher: true, lesson: true, rating: true },
  });
  if (!booking || booking.studentId !== session.userId) notFound();
  if (booking.rating) redirect(`/student/homework/${booking.lesson.id}`);
  if (booking.status !== "COMPLETED") redirect(`/student/classroom/${booking.id}`);

  return (
    <div className="container py-8">
      <PostLessonForm
        bookingId={booking.id}
        lessonId={booking.lesson.id}
        lessonTitle={booking.lesson.titleDe}
        teacherName={booking.teacher.name}
        teacherColor={booking.teacher.avatarColor}
      />
    </div>
  );
}
