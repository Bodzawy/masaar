import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { VocabReview, type VocabCard } from "@/components/student/vocab-review";

export const metadata = { title: "My Vocabulary" };

export default async function VocabularyPage() {
  const session = await requireRole("STUDENT");
  const reviews = await db.studentVocabularyReview.findMany({
    where: { studentId: session.userId },
    orderBy: { dueAt: "asc" },
    take: 40,
    include: { item: true },
  });
  const nowDate = new Date();
  const cards: VocabCard[] = reviews.map((r) => ({
    reviewId: r.id,
    word: r.item.word,
    translation: r.item.translation,
    exampleTarget: r.item.exampleTarget,
    exampleTranslation: r.item.exampleTranslation,
    partOfSpeech: r.item.partOfSpeech,
    box: r.box,
    dueToday: r.dueAt <= nowDate,
  }));
  const dueCount = cards.filter((c) => c.dueToday).length;

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My Vocabulary</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wiederholung mit wachsenden Abständen (Spaced Repetition). Schwierigere Wörter kommen früher zurück.
          {dueCount > 0 && <> <strong>{dueCount} heute fällig.</strong></>}
        </p>
      </header>
      <VocabReview items={cards} />
    </div>
  );
}
