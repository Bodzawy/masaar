"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Mic,
  RotateCcw,
  Square,
} from "lucide-react";
import { blobTo16KhzMonoWav } from "@/lib/audio/wav";
import { TRAINER_LETTERS } from "@/lib/trainer/letters";
import {
  buildTrainerResult,
  describeCondition,
  friendlyErrorMessage,
  type PronunciationApiResponse,
  type TrainerResult,
} from "@/lib/trainer/result";
import { cn } from "@/lib/utils";

const MAX_RECORDING_MS = 3500;
const MIN_RECORDING_MS = 400;
const REQUEST_TIMEOUT_MS = 30_000;

// Browser gain control, noise suppression and echo cancellation distort short
// phonemes: in testing they clipped the signal or erased the letter entirely,
// and Azure could no longer recognise it. Unprocessed audio scored correctly.
const MIC_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

type Phase = "idle" | "recording" | "processing" | "result";

function micErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "لم يتم السماح باستخدام الميكروفون. اسمح به من إعدادات المتصفح ثم حاول مرة أخرى.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "لم أجد ميكروفونًا في هذا الجهاز. وصّل ميكروفونًا ثم حاول مرة أخرى.";
  }
  if (name === "NotReadableError") {
    return "الميكروفون مستخدم في تطبيق آخر. أغلق التطبيق الآخر ثم حاول مرة أخرى.";
  }
  return "تعذّر تشغيل الميكروفون. حاول مرة أخرى.";
}

export function PronunciationTrainer() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<TrainerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);

  const letter = TRAINER_LETTERS[index]!;
  const total = TRAINER_LETTERS.length;
  const isLast = index === total - 1;

  const releaseStream = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.onstop = null;
        recorder.stop();
      }
      releaseStream();
    };
  }, [releaseStream]);

  const fail = useCallback(
    (message: string) => {
      releaseStream();
      busyRef.current = false;
      if (!mountedRef.current) return;
      setResult(null);
      setError(message);
      setPhase("idle");
    },
    [releaseStream]
  );

  const submit = useCallback(
    async (chunks: Blob[], mimeType: string, target: string) => {
      releaseStream();
      if (!mountedRef.current) return;
      setPhase("processing");

      const duration = Date.now() - startedAtRef.current;
      if (chunks.length === 0 || duration < MIN_RECORDING_MS) {
        fail("التسجيل قصير جدًا. اضغط على الميكروفون وانطق الحرف بوضوح.");
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const wav = await blobTo16KhzMonoWav(new Blob(chunks, { type: mimeType || "audio/webm" }));

        const form = new FormData();
        form.append("audio", wav, "voice.wav");
        form.append("target", target);

        const response = await fetch("/api/pronunciation", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        let payload: (PronunciationApiResponse & { error?: string }) | null = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || !payload) {
          fail(friendlyErrorMessage(response.status, payload?.error));
          return;
        }

        busyRef.current = false;
        if (!mountedRef.current) return;
        setError(null);
        setResult(buildTrainerResult(payload));
        setPhase("result");
      } catch (caught) {
        const aborted = caught instanceof DOMException && caught.name === "AbortError";
        fail(
          aborted
            ? "استغرق التحليل وقتًا طويلًا. حاول مرة أخرى."
            : "تعذّر الاتصال بالخادم. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
        );
      } finally {
        clearTimeout(timeout);
      }
    },
    [fail, releaseStream]
  );

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setResult(null);
    const target = letter.referenceText;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      fail("متصفحك لا يدعم تسجيل الصوت. جرّب نسخة حديثة من Chrome أو Safari أو Firefox.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
    } catch (caught) {
      fail(micErrorMessage(caught));
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    try {
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        void submit(chunks, recorder.mimeType, target);
      };

      recorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = Date.now();
      recorder.start();
      setPhase("recording");
      timerRef.current = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      fail("تعذّر بدء التسجيل. حاول مرة أخرى.");
    }
  }, [fail, letter.referenceText, stopRecording, submit]);

  function goTo(nextIndex: number) {
    if (phase === "recording" || phase === "processing") return;
    setIndex((nextIndex + total) % total);
    setResult(null);
    setError(null);
    setPhase("idle");
  }

  function tryAgain() {
    setResult(null);
    setError(null);
    setPhase("idle");
  }

  const recording = phase === "recording";
  const processing = phase === "processing";
  const statusText = recording
    ? "جارٍ التسجيل… انطق الحرف الآن"
    : processing
      ? "جارٍ تحليل نطقك…"
      : "🎙️ ابدأ التسجيل";

  return (
    <main
      dir="rtl"
      lang="ar"
      className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-indigo-50 via-background to-amber-50 px-4 py-6 sm:py-10"
    >
      <div className="w-full max-w-md">
        <header className="mb-5 text-center">
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">تدريب النطق</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="trainer-progress">
            الحرف {index + 1} من {total}
          </p>
          <div className="mx-auto mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </header>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
          {phase !== "result" || !result ? (
            <div className="flex flex-col items-center text-center">
              <p className="text-lg text-muted-foreground">انطق الحرف:</p>

              <div
                data-testid="trainer-letter"
                className="my-4 select-none font-arabic text-[8.5rem] font-bold leading-none text-primary sm:text-[10rem]"
                aria-label={`الحرف ${letter.referenceText}`}
              >
                {letter.letter}
              </div>
              <p className="mb-6 rounded-full bg-primary/10 px-4 py-1 font-arabic text-lg text-primary">
                {letter.referenceText}
              </p>

              <button
                type="button"
                data-testid="record-button"
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
                aria-label={recording ? "إيقاف التسجيل" : "ابدأ التسجيل"}
                className={cn(
                  "relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition focus-ring",
                  recording ? "bg-destructive" : "bg-primary hover:brightness-110",
                  processing && "cursor-not-allowed opacity-70"
                )}
              >
                {recording && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" aria-hidden />
                )}
                {processing ? (
                  <Loader2 className="relative h-10 w-10 animate-spin" aria-hidden />
                ) : recording ? (
                  <Square className="relative h-9 w-9 fill-current" aria-hidden />
                ) : (
                  <Mic className="relative h-10 w-10" aria-hidden />
                )}
              </button>

              <p
                data-testid="trainer-status"
                aria-live="polite"
                className="mt-4 min-h-6 text-base font-medium text-foreground"
              >
                {statusText}
              </p>
              {recording && <p className="text-sm text-muted-foreground">اضغط على المربع للإيقاف</p>}

              {error && (
                <div
                  role="alert"
                  data-testid="trainer-error"
                  className="mt-5 flex w-full items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-right text-sm text-destructive"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 flex w-full items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  disabled={recording || processing || index === 0}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:text-foreground disabled:opacity-40 focus-ring"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  الحرف السابق
                </button>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  disabled={recording || processing}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:text-foreground disabled:opacity-40 focus-ring"
                >
                  {isLast ? "من البداية" : "تخطَّ هذا الحرف"}
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ) : (
            <div data-testid="trainer-result" className="flex flex-col items-center text-center">
              <h2 className="text-xl font-bold">نتيجة النطق</h2>
              <div className="mt-3 flex items-center gap-3">
                <span className="font-arabic text-6xl font-bold leading-none text-primary">{letter.letter}</span>
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-white",
                    result.tone === "success" ? "bg-success" : result.tone === "retry" ? "bg-warning" : "bg-muted-foreground"
                  )}
                  aria-hidden
                >
                  {result.tone === "success" ? <Check className="h-6 w-6" /> : <RotateCcw className="h-5 w-5" />}
                </span>
              </div>

              <dl className="mt-5 w-full space-y-3 text-sm" dir="ltr">
                <div className="rounded-xl bg-muted p-3 text-left">
                  <div className="flex items-center justify-between">
                    <dt className="font-medium text-muted-foreground">Azure Accuracy</dt>
                    <dd className="text-lg font-bold" data-testid="trainer-accuracy">
                      {result.accuracy === null ? "—" : `${result.accuracy}%`}
                    </dd>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        result.accuracy !== null && result.accuracy >= 70 ? "bg-success" : "bg-warning"
                      )}
                      style={{ width: `${Math.min(100, result.accuracy ?? 0)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-muted p-3 text-left">
                  <dt className="font-medium text-muted-foreground">IQRA Phoneme</dt>
                  <dd className="mt-2 flex flex-wrap gap-2" data-testid="trainer-phonemes">
                    {result.detectedPhonemes.length === 0 ? (
                      <span className="text-muted-foreground">no phonemes detected</span>
                    ) : (
                      result.detectedPhonemes.map((phoneme, position) => (
                        <span
                          key={`${phoneme}-${position}`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono",
                            result.matchedPhonemes.includes(phoneme)
                              ? "border-success/40 bg-success/10 text-success"
                              : "border-border bg-card"
                          )}
                        >
                          {phoneme}
                          {result.matchedPhonemes.includes(phoneme) && <Check className="h-3.5 w-3.5" aria-hidden />}
                        </span>
                      ))
                    )}
                  </dd>
                </div>

                <div className="rounded-xl bg-muted p-3 text-left">
                  <dt className="flex items-center justify-between font-medium text-muted-foreground">
                    <span>Condition evaluation</span>
                    <span className="rounded bg-card px-2 py-0.5 font-mono text-xs" data-testid="trainer-rule">
                      {result.rule}
                    </span>
                  </dt>
                  <dd className="mt-2 space-y-1">
                    {result.conditions.length === 0 ? (
                      <span className="text-muted-foreground">no rule matched</span>
                    ) : (
                      result.conditions.map((condition) => (
                        <div key={condition} className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
                          <span>{describeCondition(condition)}</span>
                        </div>
                      ))
                    )}
                  </dd>
                </div>
              </dl>

              <p
                data-testid="trainer-message"
                className={cn(
                  "mt-5 w-full rounded-2xl p-4 text-lg font-semibold leading-relaxed",
                  result.tone === "success"
                    ? "bg-success/10 text-success"
                    : result.tone === "retry"
                      ? "bg-warning/10 text-warning"
                      : "bg-muted text-foreground"
                )}
              >
                {result.message}
              </p>

              <div className="mt-5 flex w-full gap-3">
                <button
                  type="button"
                  data-testid="retry-button"
                  onClick={tryAgain}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 font-medium transition hover:bg-muted focus-ring"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  حاول مرة أخرى
                </button>
                <button
                  type="button"
                  data-testid="next-button"
                  onClick={() => goTo(index + 1)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground transition hover:brightness-110 focus-ring"
                >
                  {isLast ? "من البداية" : "الحرف التالي"}
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
