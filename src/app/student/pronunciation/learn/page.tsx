"use client";

import {
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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

type MasaarResult = {
  letter?: string;
  confidence?: number;
  top3?: Array<{
    label?: string;
    letter?: string;
    confidence?: number;
    score?: number;
  }>;
};

type IqraResult = {
  sequence?: string;
  phonemes?: string[];
  duration?: number;
};

type AzureResult = {
  recognized: string;
  accuracy: number | null;
};


type AssessmentResult = {
    target: string;
    recognized: string;
    passed: boolean;
  
    details?: {
      masaar?: MasaarResult | null;
      iqra?: IqraResult | null;
      azure?: AzureResult | null;

    };
  
    scores: Scores;
  
    failureReason?:
      | "low_accuracy"
      | "weak_first_sound"
      | "wrong_letter"
      | "rule_not_matched"
      | null;

    feedback?: {
      rule: string;
      message: string;
    };

    conditionEvaluation?: {
      target: string;
      azureAccuracy: number;
      azureRecognized: string;
      iqraPhonemes: string[];
      matchedRule: string;
      message: string;
      conditions: string[];
    };
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


  const [masaarResult, setMasaarResult] =
    useState<MasaarResult | null>(null);
  
  const [iqraResult, setIqraResult] =
    useState<IqraResult | null>(null);

  const [azureResult, setAzureResult] =
    useState<AzureResult | null>(null);

  const [conditionResult, setConditionResult] =
    useState<NonNullable<AssessmentResult["conditionEvaluation"]> | null>(null);


  const [status, setStatus] =
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


      if (objectUrlRef.current) {

        URL.revokeObjectURL(
          objectUrlRef.current
        );

        objectUrlRef.current = null;
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
        throw new Error(
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


    } finally {

      setAudioLoading(false);

    }
  }



  async function startLesson() {

    setStarted(true);

    setScores(null);

    setMasaarResult(null);
    setIqraResult(null); 
    setAzureResult(null);   // ⬅️ أضف دي  // ⬅️ أضف دي بجانبها في كل الأربع أماكن
    setConditionResult(null);

    setStatus("");


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



  async function goToLetter(
    newIndex: number
  ) {

    if (
      newIndex < 0 ||
      newIndex >= ARABIC_LETTERS.length
    ) {
      return;
    }


    setIndex(newIndex);

    setScores(null);
    setAzureResult(null);   // ⬅️ أضف دي
    setConditionResult(null);

    setMasaarResult(null);
    setIqraResult(null); 

    setStatus("");


    const letter =
      ARABIC_LETTERS[newIndex];


    if (
      started &&
      letter
    ) {

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            150
          )
      );


      await playArabic(
        letter.modelText
      );

    }

  }



  async function previousLetter() {

    if (
      recording ||
      evaluating ||
      audioLoading
    ) {
      return;
    }


    await goToLetter(
      index - 1
    );

  }



  async function nextLetter() {

    if (
      recording ||
      evaluating ||
      audioLoading
    ) {
      return;
    }


    if (
      index ===
      ARABIC_LETTERS.length - 1
    ) {

      setCompleted(true);

      return;
    }


    await goToLetter(
      index + 1
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
    
      setAzureResult(null);   // ⬅️ أضف دي
      setConditionResult(null);
      setMasaarResult(null);
      setIqraResult(null); 


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


      const chunks: Blob[] = [];


      recorder.ondataavailable =
        (event) => {

          if (
            event.data.size > 0
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
              await response.json();



            if (!response.ok) {

              throw new Error(
                result.error ||
                "Pronunciation failed."
              );

            }



            const assessment =
              result as AssessmentResult;



            setScores(
              assessment.scores
            );


            

            console.log("FULL ASSESSMENT:", assessment);
            setMasaarResult(
            assessment.details?.masaar ?? null
            );
            setIqraResult(              // ⬅️ أضف دي
            assessment.details?.iqra ?? null
            );
            setAzureResult(              // ⬅️ أضف دي
            assessment.details?.azure ?? null
            );
            setConditionResult(
              assessment.conditionEvaluation ?? null
            );





            if (
              assessment.passed
            ) {

              setStatus(
                assessment.feedback?.message ?? "✅ ممتاز!"
              );


              await playArabic(
                "مُمْتَاز"
              );


            } else {

              setStatus(
                assessment.feedback?.message ?? "🟡 حاول مرة أخرى"
              );


              await playArabic(
                "حاول مرة أخرى"
              );

            }



          } catch (error) {

            console.error(
              error
            );


            setStatus(
              "❌ Error"
            );


          } finally {

            setEvaluating(false);

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
        1800
      );


    } catch (error) {

      console.error(
        error
      );

      setRecording(false);

    }

  }
  function restartLesson() {

    setIndex(0);

    setCompleted(false);

    setStarted(false);

    setScores(null);
    setAzureResult(null);   // ⬅️ أضف دي
    setConditionResult(null);

    setMasaarResult(null);
    setIqraResult(null); 

    setStatus("");

  }



  return (

    <div className="mx-auto max-w-3xl space-y-6">


      <Link
        href="/student/pronunciation"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >

        <ArrowLeft className="h-4 w-4" />

        Zurück

      </Link>



      <div className="flex items-end justify-between">

        <div>

          <p className="text-sm font-medium text-primary">
            Level 1
          </p>


          <h1 className="text-3xl font-bold">
            Arabische Buchstaben
          </h1>


        </div>


        <div>
          {index + 1} / {ARABIC_LETTERS.length}
        </div>

      </div>



      <div className="h-2 overflow-hidden rounded-full bg-muted">
  <div
    className="h-full bg-primary"
    style={{
      width: `${progress}%`,
    }}
  />
</div>

<div className="flex items-end justify-between">

<div>

  <p className="text-sm font-medium text-primary">
    Level 1
  </p>

  <h1 className="text-3xl font-bold">
    Arabische Buchstaben
  </h1>

</div>

<div>
  {index + 1} / {ARABIC_LETTERS.length}
</div>

</div>

<div className="h-2 overflow-hidden rounded-full bg-muted">
<div
  className="h-full bg-primary"
  style={{
    width: `${progress}%`,
  }}
/>
</div>

<div className="flex items-center justify-between">

<button
  onClick={previousLetter}
  disabled={
    index === 0 ||
    recording ||
    evaluating ||
    audioLoading
  }
  className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40"
>
  <ChevronRight className="h-4 w-4" />
  السابق
</button>

<button
  onClick={nextLetter}
  disabled={
    recording ||
    evaluating ||
    audioLoading
  }
  className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40"
>
  التالي
  <ChevronLeft className="h-4 w-4" />
</button>

</div>      <div className="rounded-3xl border bg-card p-8 text-center">


        <div
          dir="rtl"
          className="my-8 text-[9rem] font-bold"
        >

          {current.letter}

        </div>



        {!started ? (

          <button
            onClick={startLesson}
            className="rounded-xl bg-primary px-8 py-4 text-lg font-semibold"
          >

            Lektion starten

          </button>


        ) : (


          <button
            onClick={startRecording}
            disabled={
              recording ||
              evaluating
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-lg font-semibold"
          >

            <Mic className="h-5 w-5" />

            {recording
              ? "Ich höre zu..."
              : evaluating
              ? "Wird bewertet..."
              : "Jetzt nachsprechen"
            }

          </button>

        )}





        {scores && (
          <div className="mx-auto mt-6 grid max-w-2xl gap-4 text-right md:grid-cols-2" dir="rtl">
            <div className="rounded-2xl border p-5">
              <h2 className="text-lg font-bold">☁️ Azure Speech</h2>
              <p className="mt-2 text-2xl font-bold">{azureResult?.recognized || "لا توجد نتيجة"}</p>
              <p>الدقة: {azureResult?.accuracy ?? "—"}%</p>
            </div>
            <div className="rounded-2xl border p-5">
              <h2 className="text-lg font-bold">🤖 MASAAR AI</h2>
              {masaarResult ? <>
                <p className="mt-2 text-2xl font-bold">{masaarResult.letter ?? "—"}</p>
                <p>الثقة: {typeof masaarResult.confidence === "number" ? `${Math.round(masaarResult.confidence * 100)}%` : "—"}</p>
                {masaarResult.top3?.length ? <p className="mt-2 text-sm">أفضل النتائج: {masaarResult.top3.map((item) => `${item.letter ?? item.label ?? "—"} (${typeof item.confidence === "number" ? Math.round(item.confidence * 100) : item.score ?? "—"}%)`).join("، ")}</p> : null}
              </> : <p className="mt-2 text-muted-foreground">الخدمة غير متاحة لهذه المحاولة</p>}
            </div>
            <div className="rounded-2xl border p-5 md:col-span-2">
              <h2 className="text-lg font-bold">🕌 IQRA Phoneme Model</h2>
              {iqraResult ? <>
                {iqraResult.sequence ? <p className="mt-2 font-mono" dir="ltr">{iqraResult.sequence}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2" dir="ltr">{iqraResult.phonemes?.length ? iqraResult.phonemes.map((phoneme, index) => <span key={`${phoneme}-${index}`} className="rounded-lg bg-muted px-3 py-1 font-mono">{phoneme}</span>) : "—"}</div>
              </> : <p className="mt-2 text-muted-foreground">الخدمة غير متاحة لهذه المحاولة</p>}
            </div>
          </div>
        )}

{conditionResult && (
  <div className="mx-auto mt-6 max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-6 text-right" dir="rtl">
    <h2 className="text-xl font-bold">⚙️ نتيجة شروط التقييم</h2>
    <p className="mt-3 text-lg font-bold">{conditionResult.message}</p>
    <dl className="mt-4 space-y-2 text-sm">
      <div className="flex justify-between gap-4"><dt>القاعدة المطابقة</dt><dd dir="ltr" className="font-mono">{conditionResult.matchedRule}</dd></div>
      <div className="flex justify-between gap-4"><dt>الحرف المطلوب</dt><dd>{conditionResult.target}</dd></div>
      <div className="flex justify-between gap-4"><dt>Azure</dt><dd>{conditionResult.azureRecognized || "—"} · {conditionResult.azureAccuracy}%</dd></div>
      <div className="flex justify-between gap-4"><dt>IQRA phonemes</dt><dd dir="ltr" className="font-mono">{conditionResult.iqraPhonemes.join(" ") || "—"}</dd></div>
    </dl>
    <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">الشروط المستخدمة: {conditionResult.conditions.length ? conditionResult.conditions.join(" • ") : "لم تطابق أي قاعدة"}</p>
  </div>
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
