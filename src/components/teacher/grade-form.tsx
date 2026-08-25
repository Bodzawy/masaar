"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { gradeHomework } from "@/app/actions/homework";

export function GradeForm({
  submissionId,
  studentName,
  lessonTitle,
  writingText,
  answers,
  recordingMeta,
  maxScore,
}: {
  submissionId: string;
  studentName: string;
  lessonTitle: string;
  writingText: string | null;
  answers: Record<string, string>;
  recordingMeta: { fileName?: string } | null;
  maxScore: number;
}) {
  const [score, setScore] = useState(80);
  const [feedback, setFeedback] = useState("");
  const [corrections, setCorrections] = useState<Array<{ excerpt: string; comment: string }>>([{ excerpt: "", comment: "" }]);
  const [practice, setPractice] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const exerciseEntries = Object.entries(answers);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Submission view */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{studentName} — submission</CardTitle>
          <CardDescription>{lessonTitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Writing</p>
            <p className="whitespace-pre-line rounded-lg border border-border bg-background p-4 text-sm leading-relaxed">{writingText ?? "—"}</p>
          </section>
          {exerciseEntries.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exercise answers</p>
              <ul className="space-y-1.5 text-sm">
                {exerciseEntries.map(([exId, answer]) => (
                  <li key={exId} className="rounded-md bg-muted px-3 py-2">
                    <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{exId}</span>
                    <span className="ms-2">{answer}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recordingMeta?.fileName && (
            <Badge variant="secondary">Voice note attached (demo): {recordingMeta.fileName}</Badge>
          )}
        </CardContent>
      </Card>

      {/* Grading form */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Grade & return</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="score">Score ({maxScore})</Label>
            <Input id="score" type="number" min={0} max={maxScore} value={score} onChange={(e) => setScore(Math.max(0, Math.min(maxScore, Number(e.target.value))))} />
          </div>

          <div className="space-y-2">
            <Label>Corrections</Label>
            {corrections.map((c, i) => (
              <div key={i} className="grid gap-1.5 rounded-md border border-border p-2.5 sm:grid-cols-[1fr_1.4fr]">
                <Input
                  value={c.excerpt}
                  onChange={(e) => setCorrections((cs) => cs.map((cc, j) => (j === i ? { ...cc, excerpt: e.target.value } : cc)))}
                  placeholder="Excerpt"
                />
                <Input
                  value={c.comment}
                  onChange={(e) => setCorrections((cs) => cs.map((cc, j) => (j === i ? { ...cc, comment: e.target.value } : cc)))}
                  placeholder="Correction / explanation"
                />
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setCorrections((cs) => [...cs, { excerpt: "", comment: "" }])}>+ Add correction</Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fb">Feedback</Label>
            <Textarea id="fb" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What was strong? What should they focus on?" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp">Recommended practice (optional)</Label>
            <Input id="rp" value={practice} onChange={(e) => setPractice(e.target.value)} placeholder="e.g. Dativ prepositions — 15 min drills" />
          </div>

          {msg && <p role="status" className={`rounded-md px-3 py-2 text-sm ${msg.startsWith("Error") ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{msg}</p>}

          <Button
            disabled={pending || feedback.trim().length < 5}
            onClick={() =>
              start(async () => {
                const res = await gradeHomework({
                  submissionId,
                  score,
                  feedbackText: feedback.trim(),
                  corrections: corrections.filter((c) => c.excerpt.trim() && c.comment.trim()),
                  recommendedPractice: practice.trim() || undefined,
                });
                if (!res.ok) setMsg(`Error: ${res.error}`);
                else setMsg("Graded and returned to the student.");
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            Grade & return
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
