import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import {
  ARABIC_LETTERS,
} from "@/lib/pronunciation/letters";
import {
  evaluateLetterConditions,
} from "@/lib/pronunciation/condition-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGE = "ar-EG";

/*
  خففنا الشروط شوية حتى لا نرفض
  النطق الصحيح مثل "ثاء".
*/
const MIN_ACCURACY = 65;
const MIN_FIRST_SOUND_SCORE = 55;

/*
  لا نعتبر أن الطالب قال الحرف الخطأ
  إلا لو المنافس تفوق بوضوح.
*/

const WRONG_LETTER_MARGIN = 8;
const LOCAL_MODEL_TIMEOUT_MS = 8_000;

const allowedTargets = new Set(
  ARABIC_LETTERS.map(
    (item) => item.referenceText
  )
);

const CONFUSION_REFERENCES: Record<
  string,
  string[]
> = {
  تاء: ["ثاء", "طاء"],

  ثاء: [
    "تاء",
    "فاء",
    "ساء",
    "طاء",
  ],

  جيم: ["شيم"],

  حاء: [
    "هاء",
    "خاء",
  ],

  خاء: [
    "حاء",
    "غاء",
  ],

  دال: [
    "ذال",
    "ضال",
  ],

  ذال: [
    "زال",
    "زاي",
    "دال",
    "ظاء",
  ],

  زاي: [
    "ذاي",
    "ذال",
    "زاء",
    "ظاء",
  ],

  سين: [
    "صين",
    "صاد",
    "ثين",
  ],

  صاد: [
    "ساد",
    "سين",
    "ضاد",
  ],

  ضاد: [
    "داد",
    "دال",
    "صاد",
    "ظاء",
  ],

  طاء: [
    "تاء",
    "ثاء",
    "ظاء",
  ],

  ظاء: [
    "زاء",
    "زاي",
    "ذال",
    "طاء",
    "ضاد",
  ],

  عين: [
    "أين",
    "غين",
  ],

  غين: [
    "عين",
    "خاء",
  ],

  فاء: [
    "ثاء",
    "باء",
  ],

  قاف: ["كاف"],

  كاف: ["قاف"],

  هاء: [
    "حاء",
    "خاء",
  ],
};

type RawPhoneme = {
  Phoneme?: string;

  PronunciationAssessment?: {
    AccuracyScore?: number;
  };
};

type RawWord = {
  Word?: string;

  PronunciationAssessment?: {
    AccuracyScore?: number;
    ErrorType?: string;
  };

  Phonemes?: RawPhoneme[];
};

type RawAzureResult = {
  NBest?: Array<{
    Words?: RawWord[];
  }>;
};

type AssessmentResult = {
  referenceText: string;

  recognized: string;

  accuracy: number | null;

  pronunciation: number | null;

  fluency: number | null;

  completeness: number | null;

  firstSoundScore: number | null;

  words: Array<{
    word: string;

    accuracy: number | null;

    errorType: string;

    phonemes: Array<{
      phoneme: string | null;
      accuracy: number | null;
    }>;
  }>;
};

function validScore(
  value: number | undefined
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return Math.round(value);
}

function recognizeOnce(
  recognizer: SpeechSDK.SpeechRecognizer
): Promise<SpeechSDK.SpeechRecognitionResult> {
  return new Promise(
    (resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (result) => {
          resolve(result);
        },

        (error) => {
          reject(
            new Error(
              typeof error === "string"
                ? error
                : "Azure Speech recognition failed."
            )
          );
        }
      );
    }
  );
}

async function assessAudio(
  audioBuffer: Buffer,
  referenceText: string,
  key: string,
  region: string
): Promise<AssessmentResult> {
  let audioConfig:
    | SpeechSDK.AudioConfig
    | null = null;

  let recognizer:
    | SpeechSDK.SpeechRecognizer
    | null = null;

  try {
    const speechConfig =
      SpeechSDK.SpeechConfig.fromSubscription(
        key,
        region
      );

    speechConfig.speechRecognitionLanguage =
      LANGUAGE;

    audioConfig =
      SpeechSDK.AudioConfig.fromWavFileInput(
        audioBuffer,
        "voice.wav"
      );

    recognizer =
      new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfig
      );

    const pronunciationConfig =
      new SpeechSDK.PronunciationAssessmentConfig(
        referenceText,

        SpeechSDK
          .PronunciationAssessmentGradingSystem
          .HundredMark,

        SpeechSDK
          .PronunciationAssessmentGranularity
          .Phoneme,

        true
      );

    pronunciationConfig.applyTo(
      recognizer
    );

    const result =
      await recognizeOnce(
        recognizer
      );

    if (
      result.reason ===
      SpeechSDK.ResultReason.NoMatch
    ) {
      return {
        referenceText,
        recognized: "",
        accuracy: null,
        pronunciation: null,
        fluency: null,
        completeness: null,
        firstSoundScore: null,
        words: [],
      };
    }

    if (
      result.reason ===
      SpeechSDK.ResultReason.Canceled
    ) {
      const cancellation =
        SpeechSDK.CancellationDetails.fromResult(
          result
        );

      console.error(
        "AZURE CANCELED:",
        {
          referenceText,
          reason:
            cancellation.reason,
          errorDetails:
            cancellation.errorDetails,
        }
      );

      throw new Error(
        "Azure could not evaluate the recording."
      );
    }

    const assessment =
      SpeechSDK.PronunciationAssessmentResult.fromResult(
        result
      );

    const accuracy =
      validScore(
        assessment.accuracyScore
      );

    const pronunciation =
      validScore(
        assessment.pronunciationScore
      );

    const fluency =
      validScore(
        assessment.fluencyScore
      );

    const completeness =
      validScore(
        assessment.completenessScore
      );

    let words: AssessmentResult["words"] =
      [];

    try {
      const rawJson =
        result.properties.getProperty(
          SpeechSDK.PropertyId
            .SpeechServiceResponse_JsonResult
        );

      if (rawJson) {
        const parsed =
          JSON.parse(
            rawJson
          ) as RawAzureResult;

        const rawWords =
          parsed.NBest?.[0]
            ?.Words ?? [];

        words =
          rawWords.map(
            (word) => ({
              word:
                word.Word ?? "",

              accuracy:
                validScore(
                  word
                    .PronunciationAssessment
                    ?.AccuracyScore
                ),

              errorType:
                word
                  .PronunciationAssessment
                  ?.ErrorType ??
                "None",

              phonemes:
                word.Phonemes?.map(
                  (phoneme) => ({
                    phoneme:
                      phoneme.Phoneme ??
                      null,

                    accuracy:
                      validScore(
                        phoneme
                          .PronunciationAssessment
                          ?.AccuracyScore
                      ),
                  })
                ) ?? [],
            })
          );
      }
    } catch (error) {
      console.warn(
        "Could not read phoneme details:",
        error
      );
    }

    const firstSoundScore =
      words[0]
        ?.phonemes[0]
        ?.accuracy ??
      null;

    return {
      referenceText,

      recognized:
        result.text ?? "",

      accuracy,
      pronunciation,
      fluency,
      completeness,
      firstSoundScore,
      words,
    };
  } finally {
    try {
      recognizer?.close();
    } catch {}

    try {
      audioConfig?.close();
    } catch {}
  }
}

function discriminationScore(
  result: AssessmentResult
): number | null {
  if (
    result.firstSoundScore !==
      null &&
    result.accuracy !== null
  ) {
    return Math.round(
      result.firstSoundScore *
        0.8 +
        result.accuracy *
          0.2
    );
  }

  return (
    result.firstSoundScore ??
    result.accuracy
  );
}

type MasaarResult = {
  letter?: string;
  confidence?: number;
  top3?: Array<{
    label?: string;
    letter?: string;
    confidence?: number;
  }>;
};

type IqraResult = {
  sequence?: string;
  phonemes?: string[];
  duration?: number;
};

async function postAudioToModel(
  service: "MASAAR" | "IQRA",
  baseUrl: string | undefined,
  audioBuffer: Buffer
): Promise<unknown | null> {
  if (!baseUrl) {
    console.warn(`${service} URL is not configured.`);
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    LOCAL_MODEL_TIMEOUT_MS
  );

  try {
    const formData = new FormData();
    formData.append(
      "audio",
      new Blob([new Uint8Array(audioBuffer)]),
      "voice.wav"
    );

    const internalApiKey = process.env.INTERNAL_API_KEY;

    const response = await fetch(`${baseUrl}/predict`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      // Only sent when INTERNAL_API_KEY is configured (production). MASAAR
      // and IQRA ignore this header entirely when they have no key of their
      // own to compare it against, so local development is unaffected.
      headers: internalApiKey
        ? { "X-Internal-Api-Key": internalApiKey }
        : undefined,
    });

    if (!response.ok) {
      console.error(`${service} returned ${response.status}.`);
      return null;
    }

    return await response.json();
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? `timed out after ${LOCAL_MODEL_TIMEOUT_MS / 1000} seconds`
      : error;
    console.error(`${service} ERROR:`, reason);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function assessMasaar(
  audioBuffer: Buffer
): Promise<MasaarResult | null> {
  const result = await postAudioToModel(
    "MASAAR",
    process.env.MASAAR_URL,
    audioBuffer
  );

  if (!result || typeof result !== "object") return null;
  const data = result as MasaarResult & { ok?: boolean };
  return data.ok === false ? null : data;
}

async function assessIqra(
  audioBuffer: Buffer
): Promise<IqraResult | null> {
  const result = await postAudioToModel(
    "IQRA",
    process.env.IQRA_URL,
    audioBuffer
  );

  if (!result || typeof result !== "object") return null;
  const data = result as IqraResult & { ok?: boolean };
  if (data.ok === false) return null;

  return {
    sequence: data.sequence,
    phonemes: Array.isArray(data.phonemes)
      ? data.phonemes.filter((phoneme): phoneme is string => typeof phoneme === "string")
      : [],
    duration: data.duration,
  };
}

export async function POST(
  request: Request
) {
  try {
    const key =
      process.env.AZURE_SPEECH_KEY;

    const region =
      process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      return Response.json(
        {
          error:
            "Azure Speech is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const formData =
      await request.formData();

    const audio =
      formData.get("audio");

    const target =
      formData.get("target");

    if (
      !audio ||
      typeof audio === "string"
    ) {
      return Response.json(
        {
          error:
            "Audio is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof target !== "string" ||
      !allowedTargets.has(target)
    ) {
      return Response.json(
        {
          error:
            "Invalid pronunciation target.",
        },
        {
          status: 400,
        }
      );
    }

    const audioBuffer =
      Buffer.from(
        await audio.arrayBuffer()
      );

    // Start all independent evaluations together. Previously Masaar and Iqra
    // finished before Azure even started, making the user wait for their sum.
    const [masaar, iqra, primary] = await Promise.all([
      assessMasaar(audioBuffer),
      assessIqra(audioBuffer),
      assessAudio(audioBuffer, target, key, region),
    ]);

    if (
      primary.accuracy === null ||
      primary.pronunciation === null
    ) {
      return Response.json(
        {
          error:
            "لم أستطع تقييم النطق بوضوح. حاول مرة أخرى.",
        },
        {
          status: 422,
        }
      );
    }

    const targetScore =
      discriminationScore(
        primary
      );

    const accuracyPassed =
      primary.accuracy >=
      MIN_ACCURACY;

    const firstSoundPassed =
      primary.firstSoundScore ===
        null ||
      primary.firstSoundScore >=
        MIN_FIRST_SOUND_SCORE;

    const legacyPassed =
      accuracyPassed &&
      firstSoundPassed;

    let passed = legacyPassed;

    let failureReason:
      | "low_accuracy"
      | "weak_first_sound"
      | "wrong_letter"
      | "rule_not_matched"
      | null = null;

    if (!accuracyPassed) {
      failureReason =
        "low_accuracy";
    } else if (
      !firstSoundPassed
    ) {
      failureReason =
        "weak_first_sound";
    }

    const feedback =
      evaluateLetterConditions({
        target,
        azureAccuracy: primary.accuracy,
        azureRecognized: primary.recognized,
        iqraPhonemes:
          iqra?.phonemes ?? [],
      });

    if (feedback) {
      // The conditions file, not the legacy score alone, decides whether this
      // attempt passes. Only an explicit "excellent" rule is a pass.
      passed = feedback.rule === "excellent";

      if (!passed && failureReason === null) {
        failureReason = "rule_not_matched";
      }
    } else {
      // Never report success when the data required by a rule is unavailable.
      passed = false;
      failureReason = "rule_not_matched";
    }

    const resolvedFeedback =
      feedback ?? {
        rule: "no_matching_rule",
        message: iqra?.phonemes?.length
          ? "لم تنطبق شروط تقييم هذا الحرف. حاول مرة أخرى."
          : "تعذر تحليل أصوات النطق. حاول مرة أخرى بعد التأكد من اتصال IQRA.",
      };

    console.log(
      "ARABIC LETTER ASSESSMENT:",
      {
        target,

        targetAccuracy:
          primary.accuracy,

        firstSound:
          primary.firstSoundScore,

        targetScore,

        closestAlternative: null,
        alternativeScore: null,
        margin: null,

        passed,

        failureReason,

        feedback: resolvedFeedback,

        conditionEvaluation: {
          target,
          azureAccuracy: primary.accuracy,
          azureRecognized: primary.recognized,
          iqraPhonemes: iqra?.phonemes ?? [],
          matchedRule: resolvedFeedback.rule,
          message: resolvedFeedback.message,
          conditions: feedback?.conditions ?? [],
        },
      }
    );

    console.log("FINAL MASAAR RESULT:", masaar);
    return Response.json({
        target,
      
        recognized:
          primary.recognized,
      
        passed,
      
        failureReason,
      
        scores: {
          accuracy:
            primary.accuracy,
      
          pronunciation:
            primary.pronunciation,
      
          fluency:
            primary.fluency ??
            primary.accuracy,
      
          completeness:
            primary.completeness ??
            100,
        },
      
        details: {
          masaar,
      
          azure: {
            recognized:
              primary.recognized,
      
            accuracy:
              primary.accuracy,
          },
      
          iqra,
        },

        conditionEvaluation: {
          target,
          azureAccuracy: primary.accuracy,
          azureRecognized: primary.recognized,
          iqraPhonemes: iqra?.phonemes ?? [],
          matchedRule: resolvedFeedback.rule,
          message: resolvedFeedback.message,
          conditions: feedback?.conditions ?? [],
        },
      
        discrimination: {
          targetScore,
      
          firstSoundScore:
            primary.firstSoundScore,
      
          closestAlternative: null,
          alternativeScore: null,
          margin: null,
        },
      
        words:
          primary.words,
      });
  } catch (error) {
    console.error(
      "PRONUNCIATION API ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pronunciation assessment failed.",
      },
      {
        status: 500,
      }
    );
  }
}
