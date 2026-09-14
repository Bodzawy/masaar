import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
} from "lucide-react";

export default function PronunciationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">

      <Link
        href="/student"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      <div>
        <h1 className="text-3xl font-bold">
          Aussprache & Lesen
        </h1>

        <p className="mt-2 text-muted-foreground">
          Lerne die arabische Aussprache Schritt für Schritt.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">

        <Link
          href="/student/pronunciation/learn"
          className="rounded-3xl border bg-card p-8 transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-2xl font-bold">
            Lernen
          </h2>

          <p className="mt-3 text-muted-foreground">
            Höre die richtige Aussprache, sprich nach und erhalte direktes Feedback.
          </p>

          <div className="mt-6 text-sm font-medium text-primary">
            Lernen starten →
          </div>
        </Link>

        <Link
          href="/student/pronunciation/test"
          className="rounded-3xl border bg-card p-8 transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-2xl font-bold">
            Test
          </h2>

          <p className="mt-3 text-muted-foreground">
            Lies selbstständig vor. Du hörst die Lösung vorher nicht.
          </p>

          <div className="mt-6 text-sm font-medium text-primary">
            Test starten →
          </div>
        </Link>

      </div>

      <div className="rounded-2xl border p-5">
        <p className="font-semibold">
          Level 1 — Arabische Buchstaben
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          28 Buchstaben · Lernen + Test
        </p>
      </div>

    </div>
  );
}