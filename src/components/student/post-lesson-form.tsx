"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Heart, Loader2, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { submitRating, reportTeacher, requestRetake } from "@/app/actions/post-lesson";

const CATEGORIES = [
  ["explanation", "Explanation quality"],
  ["languageClarity", "Language clarity"],
  ["punctuality", "Punctuality"],
  ["interaction", "Interaction"],
  ["patience", "Patience"],
  ["technicalQuality", "Technical quality"],
] as const;

export function PostLessonForm({
  bookingId,
  lessonId,
  lessonTitle,
  teacherName,
  teacherColor,
}: {
  bookingId: string;
  lessonId: string;
  lessonTitle: string;
  teacherName: string;
  teacherColor: string;
}) {
  const router = useRouter();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [retakeText, setRetakeText] = useState("");
  const [dialogMsg, setDialogMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const overallSet = ratings.explanation != null;
  const avg =
    CATEGORIES.reduce((n, [key]) => n + (ratings[key] ?? 0), 0) / Math.max(1, Object.values(ratings).length);
  const overallLow = avg > 0 && avg <= 2;

  function submit() {
    setError(null);
    if (!CATEGORIES.every(([k]) => ratings[k])) {
      setError("Please rate all six categories.");
      return;
    }
    if (overallLow && comment.trim().length < 10) {
      setError("Please tell us what happened (at least 10 characters).");
      return;
    }
    start(async () => {
      const res = await submitRating({
        bookingId,
        overall: Math.round(avg),
        explanation: ratings.explanation!,
        languageClarity: ratings.languageClarity!,
        punctuality: ratings.punctuality!,
        interaction: ratings.interaction!,
        patience: ratings.patience!,
        technicalQuality: ratings.technicalQuality!,
        comment: comment.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not submit rating");
        return;
      }
      setDone(true);
      setTimeout(() => router.push(`/student/lessons/${lessonId}/quiz`), 1400);
    });
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-lg animate-scale-in">
        <CardContent className="p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <Star className="h-7 w-7 text-success" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold">Thanks for your feedback!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Continuing to your lesson quiz…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="text-center">
            <UserAvatar name={teacherName} color={teacherColor} className="mx-auto h-16 w-16 text-xl" />
            <h1 className="mt-3 text-xl font-semibold">How was your lesson?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lessonTitle} with {teacherName} — your feedback keeps teaching quality high.
            </p>
          </div>

          <div className="space-y-4">
            {CATEGORIES.map(([key, label]) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{label}</span>
                <StarPicker value={ratings[key]} onChange={(v) => setRatings((r) => ({ ...r, [key]: v }))} />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comment">
              {overallLow ? "What happened? (required for low ratings)" : "Anything to add? (optional)"}
            </Label>
            <Textarea
              id="comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share what went well or what could improve…"
            />
          </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Label className="flex cursor-pointer items-center gap-2.5 text-sm font-normal">
              <Checkbox
                checked={favorite}
                onCheckedChange={(v) => setFavorite(v === true)}
              />
              Add {teacherName.split(" ")[0]} to my favorites
            </Label>
            <Button onClick={submit} disabled={pending || !overallSet}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              Submit & continue
            </Button>
          </div>

          {/* Separate, carefully worded actions */}
          <div className="grid gap-2 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRetakeOpen(true)}
              className="flex items-start gap-2.5 rounded-md p-3 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="text-xs leading-relaxed">
                <strong className="block text-sm">Request lesson retake</strong>
                Repeat this lesson with another teacher after review.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="flex items-start gap-2.5 rounded-md p-3 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
              <span className="text-xs leading-relaxed">
                <strong className="block text-sm">Report teacher</strong>
                Serious concerns go to our moderation team.
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report teacher</DialogTitle>
            <DialogDescription>
              Describe the problem precisely. Reports create a case reviewed by our moderation team and are treated confidentially.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="What happened during the session?" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={pending || reportText.trim().length < 20}
              onClick={() =>
                start(async () => {
                  const res = await reportTeacher({ bookingId, reason: "OTHER", description: reportText.trim() });
                  if (res.ok) {
                    setReportOpen(false);
                    setDialogMsg(`Report submitted — case ${res.caseId} created.`);
                  }
                })
              }
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retake dialog */}
      <Dialog open={retakeOpen} onOpenChange={setRetakeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a lesson retake</DialogTitle>
            <DialogDescription>
              Retake requests are reviewed by our team. If approved, one lesson credit is returned and you can repeat this
              lesson with another teacher. Approval is not automatic and refunds are never issued before review.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={retakeText} onChange={(e) => setRetakeText(e.target.value)} placeholder="Why should this lesson be retaken?" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRetakeOpen(false)}>Cancel</Button>
            <Button
              disabled={pending || retakeText.trim().length < 20}
              onClick={() =>
                start(async () => {
                  const res = await requestRetake({ bookingId, lessonId, reason: retakeText.trim() });
                  if (res.ok) {
                    setRetakeOpen(false);
                    setDialogMsg(`Retake request ${res.requestId} submitted for review.`);
                  }
                })
              }
            >
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {dialogMsg && (
        <p className="rounded-md bg-success/10 px-4 py-3 text-center text-sm font-medium text-success animate-fade-in" role="status">
          {dialogMsg}
        </p>
      )}
    </div>
  );
}

function StarPicker({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={(hover || value) === v}
          aria-label={`${v} star${v > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(v)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(v)}
          className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={cn("h-6 w-6 transition-transform hover:scale-110", v <= (hover || (value ?? 0)) ? "fill-accent text-accent" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}
