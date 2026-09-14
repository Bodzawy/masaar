"use client";

import {
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  Mic,
  RotateCcw,
  Volume2,
} from "lucide-react";

import {
  ARABIC_LETTERS,
} from "@/lib/pronunciation/letters";

import {
  blobTo16KhzMonoWav,
} from "@/lib/audio/wav";

type Scores = {
  accuracy: number;
  pronunciation: number;
  fluency: number;
  completeness: number;
};

type AssessmentResult = {
  target: string;
  recognized: string;
  passed: boolean;

  scores: Scores;

  words: Array<{
    word: string;
    accuracy: number;
    errorType: string;

    phonemes: Array<{
      phoneme: string | null;
      accuracy: number;
    }>;
  }>;
};

export default function LearnPronunciationPage() {
  const [index, setIndex] =
    useState(0);

  const [started, setStarted] =
    useState(false);

  const [recording, setRecording] =
    useState(false);

  const [evaluating, setEvaluating] =
    useState(false);

  const [audioLoading, setAudioLoading] =
    useState(false);

  const [scores, setScores] =
    useState<Scores | null>(null);

  const [status, setStatus] =
    useState("");

  const [recognized, setRecognized] =
    useState("");

  const [completed, setCompleted] =
    useState(false);

  const audioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const objectUrlRef =
    useRef<string | null>(
      null
    );

  /*
    نضمن إن current موجود دائمًا.
    لو حصل index غير متوقع،
    نرجع لأول حرف بدل undefined.
  */
  const current =
    ARABIC_LETTERS[index] ??
    ARABIC_LETTERS[0]!;

  const progress =
    ((index + 1) /
      ARABIC_LETTERS.length) *
    100;

  async function playArabic(
    text: string
  ) {
    try {
      setAudioLoading(true);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (
        objectUrlRef.current
      ) {
        URL.revokeObjectURL(
          objectUrlRef.current
        );

        objectUrlRef.current =
          null;
      }

      const response =
        await fetch(
          "/api/tts",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              text,
            }),
          }
        );

      if (!response.ok) {
        const result =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          result?.error ||
            "Audio could not be generated."
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob
        );

      objectUrlRef.current =
        url;

      const audio =
        new Audio(url);

      audioRef.current =
        audio;

      await audio.play();

      await new Promise<void>(
        (resolve) => {
          audio.onended =
            () => resolve();

          audio.onerror =
            () => resolve();
        }
      );
    } catch (error) {
      console.error(
        "Arabic audio error:",
        error
      );

      setStatus(
        "❌ Die Aussprache konnte nicht abgespielt werden."
      );
    } finally {
      setAudioLoading(false);
    }
  }

  async function startLesson() {
    setStarted(true);

    setScores(null);
    setStatus("");
    setRecognized("");

    await playArabic(
      current.modelText
    );
  }

  async function repeatModel() {
    setStatus("");

    await playArabic(
      current.modelText
    );
  }

  async function startRecording() {
    if (
      recording ||
      evaluating ||
      audioLoading
    ) {
      return;
    }

    try {
      setScores(null);
      setRecognized("");

      setStatus(
        "🎤 Ich höre zu..."
      );

      const stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: true,
          });

      const recorder =
        new MediaRecorder(
          stream
        );

      const chunks: Blob[] =
        [];

      recorder.ondataavailable =
        (event) => {
          if (
            event.data.size >
            0
          ) {
            chunks.push(
              event.data
            );
          }
        };

      recorder.onstop =
        async () => {
          stream
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );

          setRecording(false);
          setEvaluating(true);

          setStatus(
            "⏳ Deine Aussprache wird bewertet..."
          );

          try {
            const originalBlob =
              new Blob(
                chunks,
                {
                  type:
                    recorder.mimeType ||
                    "audio/webm",
                }
              );

            const wavBlob =
              await blobTo16KhzMonoWav(
                originalBlob
              );

            const formData =
              new FormData();

            formData.append(
              "audio",
              wavBlob,
              "voice.wav"
            );

            formData.append(
              "target",
              current.referenceText
            );

            const response =
              await fetch(
                "/api/pronunciation",
                {
                  method:
                    "POST",

                  body:
                    formData,
                }
              );

            const result =
              (await response.json()) as
                | AssessmentResult
                | {
                    error?: string;
                  };

            if (!response.ok) {
              throw new Error(
                "error" in result
                  ? result.error ||
                      "Pronunciation assessment failed."
                  : "Pronunciation assessment failed."
              );
            }

            const assessment =
              result as AssessmentResult;

            setScores(
              assessment.scores
            );

            setRecognized(
              assessment.recognized
            );

            if (
              assessment.passed
            ) {
              setStatus(
                "✅ ممتاز!"
              );

              await playArabic(
                "مُمْتَاز"
              );

              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    500
                  )
              );

              const isLast =
                index ===
                ARABIC_LETTERS.length -
                  1;

              if (isLast) {
                setCompleted(
                  true
                );

                setStatus(
                  "🎉 أحسنت! أتممت الحروف."
                );

                await playArabic(
                  "أَحْسَنْت"
                );

                return;
              }

              const nextIndex =
                index + 1;

              const nextLetter =
                ARABIC_LETTERS[
                  nextIndex
                ];

              if (!nextLetter) {
                setCompleted(
                  true
                );

                return;
              }

              setIndex(
                nextIndex
              );

              setScores(null);
              setRecognized("");

              setStatus("");

              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    350
                  )
              );

              await playArabic(
                nextLetter.modelText
              );
            } else {
              setStatus(
                "🟡 حاول مرة أخرى"
              );

              await playArabic(
                "حَاوِلْ مَرَّةً أُخْرَى"
              );

              await new Promise(
                (resolve) =>
                  setTimeout(
                    resolve,
                    300
                  )
              );

              await playArabic(
                current.modelText
              );
            }
          } catch (error) {
            console.error(
              "Assessment error:",
              error
            );

            setStatus(
              "❌ " +
                (error instanceof
                Error
                  ? error.message
                  : "Fehler bei der Aussprachebewertung.")
            );
          } finally {
            setEvaluating(
              false
            );
          }
        };

      setRecording(true);

      recorder.start();

      setTimeout(
        () => {
          if (
            recorder.state ===
            "recording"
          ) {
            recorder.stop();
          }
        },
        2500
      );
    } catch (error) {
      console.error(
        "Microphone error:",
        error
      );

      setRecording(false);

      setStatus(
        "❌ Bitte erlaube den Zugriff auf dein Mikrofon."
      );
    }
  }

  function restartLesson() {
    setIndex(0);
    setCompleted(false);
    setStarted(false);

    setScores(null);
    setRecognized("");
    setStatus("");
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">

        <Link
          href="/student/pronunciation"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>

        <div className="rounded-3xl border bg-card p-10 text-center shadow-sm">

          <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />

          <h1 className="mt-6 text-3xl font-bold">
            Sehr gut!
          </h1>

          <p className="mt-3 text-muted-foreground">
            Du hast alle 28 arabischen Buchstaben geübt.
          </p>

          <button
            onClick={
              restartLesson
            }
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Noch einmal üben
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">

      <Link
        href="/student/pronunciation"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </Link>

      <div className="flex items-end justify-between gap-4">

        <div>
          <p className="text-sm font-medium text-primary">
            Level 1
          </p>

          <h1 className="text-3xl font-bold">
            Arabische Buchstaben
          </h1>

          <p className="mt-2 text-muted-foreground">
            Höre gut zu und sprich nach.
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          {index + 1} /{" "}
          {
            ARABIC_LETTERS.length
          }
        </div>

      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="rounded-3xl border bg-card p-8 text-center shadow-sm md:p-12">

        <p className="text-sm text-muted-foreground">
          Buchstabe
        </p>

        <div
          dir="rtl"
          className="my-8 text-[9rem] font-bold leading-none md:text-[11rem]"
        >
          {current.letter}
        </div>

        {!started ? (
          <button
            onClick={
              startLesson
            }
            disabled={
              audioLoading
            }
            className="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-50"
          >
            {audioLoading
              ? "Wird geladen..."
              : "Lektion starten"}
          </button>
        ) : (
          <div className="space-y-4">

            <button
              onClick={
                repeatModel
              }
              disabled={
                recording ||
                evaluating ||
                audioLoading
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-6 py-4 font-medium disabled:opacity-50 sm:w-auto"
            >
              <Volume2 className="h-5 w-5" />

              {audioLoading
                ? "Wird abgespielt..."
                : "Noch einmal anhören"}
            </button>

            <div />

            <button
              onClick={
                startRecording
              }
              disabled={
                recording ||
                evaluating ||
                audioLoading
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
            >
              <Mic className="h-5 w-5" />

              {recording
                ? "Ich höre zu..."
                : evaluating
                  ? "Wird bewertet..."
                  : "Jetzt nachsprechen"}
            </button>

          </div>
        )}

        {scores && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-muted/50 p-6">

            <p className="text-sm text-muted-foreground">
              Aussprache
            </p>

            <div className="mt-2 text-5xl font-bold">
              {
                scores.accuracy
              }

              <span className="text-xl text-muted-foreground">
                /100
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">

              <div>
                <p className="font-bold">
                  {
                    scores.pronunciation
                  }
                </p>

                <p className="text-xs text-muted-foreground">
                  Aussprache
                </p>
              </div>

              <div>
                <p className="font-bold">
                  {
                    scores.fluency
                  }
                </p>

                <p className="text-xs text-muted-foreground">
                  Flüssigkeit
                </p>
              </div>

              <div>
                <p className="font-bold">
                  {
                    scores.completeness
                  }
                </p>

                <p className="text-xs text-muted-foreground">
                  Vollständig
                </p>
              </div>

            </div>

          </div>
        )}

        {recognized && (
          <p
            dir="rtl"
            className="mt-5 text-lg text-muted-foreground"
          >
            سمعنا:{" "}
            {recognized}
          </p>
        )}

        {status && (
          <p className="mt-6 text-xl font-bold">
            {status}
          </p>
        )}

      </div>

    </div>
  );
}