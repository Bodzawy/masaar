"use client";

import { useState, useTransition } from "react";
import { Mic, Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveHomework } from "@/app/actions/homework";

export interface HomeworkData {
  id: string;
  title: string;
  instructions: string;
  writingPrompt: string | null;
  exercises: Array<{ id: string; prompt: string; sampleAnswer?: string }> | null;
  maxScore: number;
}

export interface SubmissionView {
  status: "DRAFT" | "SUBMITTED" | "GRADED" | "RETURNED";
  writingText: string | null;
  answers: Record<string, string> | null;
  recordingMeta: { fileName?: string; durationSec?: number } | null;
  feedback?: {
    score: number;
    feedbackText: string;
    corrections: Array<{ excerpt: string; comment: string }> | null;
    recommendedPractice: string | null;
    gradedAt: string;
  } | null;
}

const STATUS_BADGES = {
  DRAFT: { label: "Draft", variant: "muted" as const },
  SUBMITTED: { label: "Awaiting grading", variant: "warning" as const },
  GRADED: { label: "Graded", variant: "success" as const },
  RETURNED: { label: "Returned", variant: "accent" as const },
};

export function HomeworkForm({
  homework,
  lessonTitle,
  initial,
}: {
  homework: HomeworkData;
  lessonTitle: string;
  initial: SubmissionView;
}) {
  const [writing, setWriting] = useState(initial.writingText ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers ?? {});
  const [recordingName, setRecordingName] = useState(initial.recordingMeta?.fileName ?? "");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const locked = initial.status === "SUBMITTED" || initial.status === "GRADED";

  function persist(submit: boolean) {
    start(async () => {
      // Demo voice-note metadata only — audio is never uploaded.
      const recordingMeta = recordingName
        ? { fileName: recordingName.slice(0, 120), mimeType: "audio/webm", sizeBytes: Math.min(10_485_760, recordingName.length * 1024), durationSec: 42 }
        : undefined;
      const res = await saveHomework({ homeworkId: homework.id, writingText: writing, answers, recordingMeta }, submit);
      if (!res.ok) {
        setMsg({ tone: "err", text: res.error ?? "Could not save" });
      } else {
        setMsg(
          submit
            ? { tone: "ok", text: "Homework submitted — your teacher will grade it soon." }
            : { tone: "ok", text: "Draft saved." }
        );
        setConfirming(false);
        if (submit) setTimeout(() => window.location.reload(), 800);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        {/* Writing task */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{homework.title}</CardTitle>
              <Badge variant={STATUS_BADGES[initial.status].variant}>{STATUS_BADGES[initial.status].label}</Badge>
            </div>
            <CardDescription>{lessonTitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed">{homework.instructions}</p>
            {homework.writingPrompt && (
              <pre className="whitespace-pre-wrap rounded-lg border border-dashed border-border p-4 font-sans text-sm text-muted-foreground">
                {homework.writingPrompt}
              </pre>
            )}
            <Textarea
              rows={9}
              value={writing}
              onChange={(e) => setWriting(e.target.value)}
              disabled={locked || pending}
              placeholder="Write here…"
              aria-label="Writing task answer"
            />
            <p className="text-xs text-muted-foreground">{writing.trim().split(/\s+/).filter(Boolean).length} words</p>
          </CardContent>
        </Card>

        {/* Exercises */}
        {homework.exercises && homework.exercises.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Exercises</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {homework.exercises.map((ex, i) => (
                <div key={ex.id} className="space-y-1.5">
                  <Label htmlFor={ex.id}>{i + 1}. {ex.prompt}</Label>
                  <Input
                    id={ex.id}
                    value={answers[ex.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [ex.id]: e.target.value }))}
                    disabled={locked || pending}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-6 lg:col-span-2">
        {/* Voice note demo upload */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Mic className="h-4 w-4 text-primary" aria-hidden /> Voice note (demo)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="file"
              accept="audio/*"
              disabled={locked}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 10 * 1024 * 1024) {
                  setMsg({ tone: "err", text: "File too large (max 10 MB)." });
                  return;
                }
                setRecordingName(f.name);
              }}
              aria-label="Attach a voice note"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Demo upload: only the file name and metadata are recorded — audio content is not stored in this MVP.
            </p>
            {recordingName && (
              <Badge variant="secondary" className="max-w-full truncate">Attached: {recordingName}</Badge>
            )}
          </CardContent>
        </Card>

        {/* Actions / feedback */}
        {!locked && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Button className="w-full" disabled={pending || writing.trim().length < 20} onClick={() => setConfirming(true)}>
                <Send aria-hidden /> Submit homework
              </Button>
              <Button variant="outline" className="w-full" disabled={pending} onClick={() => persist(false)}>
                <Save aria-hidden /> Save draft
              </Button>
              {msg && (
                <p role="status" className={`rounded-md px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {msg.text}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {initial.feedback && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                Teacher feedback
                <Badge variant="success">{initial.feedback.score}/{homework.maxScore}</Badge>
              </CardTitle>
              <CardDescription>Graded {new Date(initial.feedback.gradedAt).toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="leading-relaxed">{initial.feedback.feedbackText}</p>
              {!!initial.feedback.corrections?.length && (
                <ul className="space-y-2">
                  {initial.feedback.corrections.map((c, i) => (
                    <li key={i} className="rounded-md border border-border bg-background p-3 text-xs">
                      <p className="font-medium text-destructive">„{c.excerpt}“</p>
                      <p className="mt-1 text-muted-foreground">{c.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
              {initial.feedback.recommendedPractice && (
                <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
                  Recommended practice: {initial.feedback.recommendedPractice}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setConfirming(false)}>
          <Card className="w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Submit homework?</h2>
              <p className="text-sm text-muted-foreground">You cannot edit after submitting.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
                <Button disabled={pending} onClick={() => persist(true)}>
                  {pending && <Loader2 className="animate-spin" aria-hidden />} Submit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
