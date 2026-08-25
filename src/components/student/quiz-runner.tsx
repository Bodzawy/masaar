"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { autosaveAnswer, submitQuiz } from "@/app/actions/quiz";

export interface QuizQuestionView {
  id: string;
  skill: string;
  prompt: string;
  context: string | null;
  options: Array<{ id: string; text: string }>;
}

export interface QuizResultView {
  score: number;
  passed: boolean;
  correctCount: number;
  total: number;
  weakSkills: string[];
  review: Array<{
    questionId: string;
    prompt: string;
    chosenText: string | null;
    correctText: string;
    explanation: string;
    wasCorrect: boolean;
    skill: string;
  }>;
  nextHref?: string;
}

export function QuizRunner({
  attemptId,
  passScore,
  questions,
  initialAnswers,
}: {
  attemptId: string;
  passScore: number;
  questions: QuizQuestionView[];
  initialAnswers: Record<string, string>;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<QuizResultView | null>(null);
  const [submitting, startSubmit] = useTransition();
  // Track in-flight saves so submission always waits for persistence.
  const pendingSaves = useRef<Array<Promise<unknown>>>([]);

  const q = questions[idx]!;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const persist = useCallback(
    (questionId: string, optionId: string | null) => {
      const p = autosaveAnswer(attemptId, questionId, optionId)
        .then(() => setSavedAt(new Date()))
        .catch(() => undefined);
      pendingSaves.current.push(p);
    },
    [attemptId]
  );

  function choose(optionId: string) {
    setAnswers((a) => ({ ...a, [q.id]: optionId }));
    persist(q.id, optionId);
  }

  async function flushSaves() {
    const all = pendingSaves.current;
    pendingSaves.current = [];
    await Promise.allSettled(all);
  }

  function doSubmit() {
    startSubmit(async () => {
      await flushSaves();
      const res = await submitQuiz(attemptId);
      if (!res.ok || res.score == null) return;
      // Fetch full correction view from the server-rendered data embedded below
      const reviewRes = await fetch(`/api/quiz/${attemptId}/review`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      setResult({
        score: res.score,
        passed: !!res.passed,
        correctCount: res.correctCount ?? 0,
        total: res.total ?? questions.length,
        weakSkills: reviewRes?.weakSkills ?? [],
        review: reviewRes?.review ?? [],
        nextHref: reviewRes?.nextHref,
      });
    });
  }

  if (result) {
    return <QuizResult result={result} passScore={passScore} onRetry={() => router.refresh()} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Question {idx + 1} of {questions.length}</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Save className={`h-3 w-3 ${savedAt ? "text-success" : ""}`} aria-hidden />
            {savedAt ? "Answers autosaved" : "Autosave on"}
          </span>
        </div>
        <Progress value={(answeredCount / questions.length) * 100} />
        <p className="text-xs text-muted-foreground">Pass mark: {passScore}% · answer at least the required share correctly</p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <Badge variant="muted">{q.skill}</Badge>
          {q.context && (
            <blockquote className="whitespace-pre-line rounded-lg border-s-4 border-primary/40 bg-primary/5 p-4 text-sm leading-relaxed">
              {q.context}
            </blockquote>
          )}
          <fieldset>
            <legend className="text-lg font-medium leading-snug">{q.prompt}</legend>
            <div className="mt-4 grid gap-2.5" role="radiogroup" aria-label={q.prompt}>
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(opt.id)}
                    className={`rounded-lg border px-4 py-3 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/40 hover:bg-muted/60"
                    }`}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          <ChevronLeft className="rtl:rotate-180" aria-hidden /> Previous
        </Button>
        <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length} answered</span>
        {idx < questions.length - 1 ? (
          <Button onClick={() => setIdx((i) => i + 1)}>
            Next <ChevronRight className="rtl:rotate-180" aria-hidden />
          </Button>
        ) : (
          <Button variant="accent" disabled={!allAnswered || submitting} onClick={() => setConfirming(true)}>
            {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
            Submit quiz
          </Button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex flex-wrap justify-center gap-1.5 pt-2" role="tablist" aria-label="Jump to question">
        {questions.map((qq, i) => (
          <button
            key={qq.id}
            type="button"
            role="tab"
            aria-selected={i === idx}
            aria-label={`Question ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-7 w-7 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              i === idx
                ? "bg-primary text-white"
                : answers[qq.id]
                  ? "bg-success/20 text-success"
                  : "bg-muted text-muted-foreground hover:bg-border"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit this quiz?</DialogTitle>
            <DialogDescription>You cannot change answers afterwards.</DialogDescription>
          </DialogHeader>
          {!allAnswered && (
            <p className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {questions.length - answeredCount} question(s) unanswered.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Keep editing</Button>
            <Button variant="accent" disabled={submitting} onClick={doSubmit}>
              {submitting && <Loader2 className="animate-spin" aria-hidden />} Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuizResult({ result, passScore, onRetry }: { result: QuizResultView; passScore: number; onRetry: () => void }) {
  const [showReview, setShowReview] = useState(false);
  const weakTopics = useMemo(() => [...new Set(result.review.filter((r) => !r.wasCorrect).map((r) => r.skill))], [result]);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 animate-fade-in">
      <Card className={`overflow-hidden ${result.passed ? "border-success/50" : "border-destructive/40"}`}>
        <CardContent className="p-8 text-center">
          <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${result.passed ? "bg-success/15" : "bg-destructive/10"}`}>
            {result.passed
              ? <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
              : <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />}
          </span>
          <p className="mt-4 text-sm uppercase tracking-wider font-semibold text-muted-foreground">
            You scored {result.score}% ({result.correctCount}/{result.total} correct)
          </p>
          <h1 className={`mt-1 text-2xl font-bold ${result.passed ? "text-success" : "text-destructive"}`}>
            {result.passed ? "Passed" : "Not passed yet"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Pass mark is {passScore}%.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {result.passed ? (
              <>
                {result.nextHref && (
                  <Button asChild>
                    <a href={result.nextHref}>Continue to next lesson</a>
                  </Button>
                )}
                <Button variant="outline" asChild><a href="/student">Back to overview</a></Button>
              </>
            ) : (
              <>
                <Button onClick={onRetry}>Retry quiz</Button>
                {result.nextHref && (
                  <Button variant="outline" asChild><a href={result.nextHref}>Continue anyway</a></Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {(weakTopics.length > 0 || result.review.length > 0) && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Review</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowReview((s) => !s)}>
                {showReview ? "Hide answers" : `Show all ${result.review.length} explanations`}
              </Button>
            </div>
            {weakTopics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">Topics to review:</span>
                {weakTopics.map((t) => <Badge key={t} variant="warning">{t}</Badge>)}
              </div>
            )}
            {showReview && (
              <ol className="mt-4 space-y-3">
                {result.review.map((r, i) => (
                  <li key={r.questionId} className={`rounded-lg border p-4 ${r.wasCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${r.wasCorrect ? "bg-success text-white" : "bg-destructive text-white"}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-sm font-medium">{r.prompt}</p>
                        <p className="text-xs text-muted-foreground">
                          Your answer: <span className={r.wasCorrect ? "text-success font-medium" : "text-destructive font-medium"}>{r.chosenText ?? "—"}</span>
                          {!r.wasCorrect && <> · Correct: <span className="font-medium text-success">{r.correctText}</span></>}
                        </p>
                        <p className="rounded-md bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">{r.explanation}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
