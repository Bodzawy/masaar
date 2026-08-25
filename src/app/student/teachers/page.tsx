import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { matchTeachers } from "@/domain/matching";
import type { CefrCode } from "@/config/domain";
import { TeacherDiscovery, type TeacherCardData } from "@/components/student/teacher-discovery";

export const metadata = { title: "Find a Teacher" };

export default async function FindTeacherPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const session = await requireRole("STUDENT");
  const sp = await searchParams;

  const [activeEnrollment, progress] = await Promise.all([
    db.enrollment.findFirst({ where: { studentId: session.userId, status: "ACTIVE" }, include: { level: true } }),
    db.studentProgress.findFirst({ where: { studentId: session.userId }, orderBy: { updatedAt: "desc" } }),
  ]);
  const levelCode = (progress?.levelCode ?? activeEnrollment?.level.code ?? "A1") as CefrCode;

  // Lesson context: explicit ?lesson= or the student's current lesson
  const lessonId = sp.lesson ?? (await currentLessonId(session.userId));
  let lessonContext: { id: string; titleDe: string; level: string } | null = null;
  if (lessonId) {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { chapter: { include: { level: true } }, progress: { where: { studentId: session.userId } } },
    });
    if (
      lesson &&
      (!lesson.progress[0] || lesson.progress[0].status !== "LOCKED") &&
      lesson.chapter.level.code === levelCode
    ) {
      lessonContext = { id: lesson.id, titleDe: lesson.titleDe, level: levelCode };
    }
  }

  // Approved teachers (never suspended), favorites, rating aggregates
  const [profiles, favorites, ratings] = await Promise.all([
    db.teacherProfile.findMany({
      where: { onboardingStage: "APPROVED", qualityState: { not: "SUSPENDED" } },
      include: { user: true },
    }),
    db.favoriteTeacher.findMany({ where: { studentId: session.userId } }),
    db.teacherRating.groupBy({
      by: ["teacherId"],
      _avg: { overall: true },
      _count: { teacherId: true },
    }),
  ]);
  const ratingMap = new Map(ratings.map((r) => [r.teacherId, r]));
  const favSet = new Set(favorites.map((f) => f.teacherId));

  const candidates: TeacherCardData[] = profiles.map((p) => {
    const r = ratingMap.get(p.userId);
    return {
      teacherId: p.id,
      userId: p.userId,
      name: p.user.name,
      rank: p.rank,
      isOnline: p.isOnline,
      qualityScore: p.qualityScore,
      qualityState: p.qualityState,
      avgRating: r?._avg.overall ?? p.qualityScore / 20,
      ratingCount: r?._count.teacherId ?? 0,
      completedLessons: p.completedLessons,
      responseTimeMinutes: p.responseTimeMinutes,
      hourlyRateCents: p.hourlyRateCents,
      languages: p.languages,
      specialties: p.specialties,
      certification: p.certification,
      headline: p.headline,
      bio: p.bio,
      avatarColor: p.user.avatarColor,
      isFavorite: favSet.has(p.userId),
      teachesCurrentLevel: true,
    };
  });

  // Hard rule: only teachers qualified for the student's current level.
  const { qualified } = matchTeachers(candidates, { level: levelCode, favoritesFirst: true });

  return (
    <div className="container max-w-7xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Find a Teacher</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start an instant lesson with an online teacher, or schedule for later. Favorites who are online appear first.
        </p>
      </header>
      <TeacherDiscovery teachers={qualified} lessonContext={lessonContext} />
    </div>
  );
}

async function currentLessonId(studentId: string): Promise<string | null> {
  const enrollment = await db.enrollment.findFirst({
    where: { studentId, status: "ACTIVE" },
    include: {
      level: {
        include: { chapters: { orderBy: { orderIndex: "asc" }, include: { lessons: { orderBy: { orderIndex: "asc" } } } } },
      },
    },
  });
  if (!enrollment) return null;
  const progresses = await db.lessonProgress.findMany({
    where: { studentId, lesson: { chapter: { levelId: enrollment.levelId } } },
  });
  for (const ch of enrollment.level.chapters) {
    for (const l of ch.lessons) {
      const p = progresses.find((pr) => pr.lessonId === l.id);
      if (p && (p.status === "AVAILABLE" || p.status === "IN_PROGRESS")) return l.id;
    }
  }
  return null;
}
