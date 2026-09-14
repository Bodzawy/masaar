import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import {
  ARABIC_LETTERS,
} from "@/lib/pronunciation/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGE = "ar-EG";

const MIN_ACCURACY = 72;
const MIN_FIRST_SOUND_SCORE = 65;

/*
  لازم نطق الحرف المطلوب يتفوق
  على أقرب نطق خاطئ بالفارق ده.
*/
const MIN_MARGIN = 10;

const allowedTargets = new Set(
  ARABIC_LETTERS.map(
    (item) => item.referenceText
  )
);

/*
  هنا مش بس بنحط أسماء حروف أخرى.

  بنحط كمان الأخطاء اللي اكتشفناها
  فعليًا أثناء التجربة.

  مثال:
  ذال → زال
  عين → أين
*/
const CONFUSION_REFERENCES: Record<
  string,
  string[]
> = {
  تاء: [
    "ثاء",
    "طاء",
  ],

  ثاء: [
    "تاء",
    "فاء",
    "طاء",
  ],

  جيم: [
    "شيم",
  ],

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

  قاف: [
    "كاف",
  ],

  كاف: [
    "قاف",
  ],

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

    /*
      أهم حاجة عندنا في أسماء الحروف
      هي أول صوت.

      مثال:

      ذال / زال
      الاختلاف في أول صوت.

      سين / صين
      الاختلاف في أول صوت.
    */
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
  /*
    نعطي أول صوت أهمية أكبر
    من بقية اسم الحرف.

    لو Azure لم يرجع phoneme،
    نستخدم Accuracy العادية.
  */

  if (
    result.firstSoundScore !==
      null &&
    result.accuracy !== null
  ) {
    return Math.round(
      result.firstSoundScore *
        0.75 +
        result.accuracy *
          0.25
    );
  }

  return (
    result.firstSoundScore ??
    result.accuracy
  );
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

    /*
      1. قيّم الحرف الصحيح.
    */
    const primary =
      await assessAudio(
        audioBuffer,
        target,
        key,
        region
      );

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

    /*
      2. قيّم نفس التسجيل
         ضد الأخطاء المحتملة.
    */
    const alternatives =
      CONFUSION_REFERENCES[target] ??
      [];

    const alternativeResults =
      await Promise.all(
        alternatives.map(
          (alternative) =>
            assessAudio(
              audioBuffer,
              alternative,
              key,
              region
            )
        )
      );

    const targetScore =
      discriminationScore(
        primary
      );

    const scoredAlternatives =
      alternativeResults
        .map((result) => ({
          result,

          score:
            discriminationScore(
              result
            ),
        }))
        .filter(
          (
            item
          ): item is {
            result: AssessmentResult;
            score: number;
          } =>
            typeof item.score ===
            "number"
        );

    scoredAlternatives.sort(
      (a, b) =>
        b.score - a.score
    );

    const bestAlternative =
      scoredAlternatives[0];

    const margin =
      targetScore !== null &&
      bestAlternative
        ? targetScore -
          bestAlternative.score
        : null;

    const accuracyPassed =
      primary.accuracy >=
      MIN_ACCURACY;

    const firstSoundPassed =
      primary.firstSoundScore ===
        null ||
      primary.firstSoundScore >=
        MIN_FIRST_SOUND_SCORE;

    /*
      لو عندنا أخطاء مشابهة،
      لازم الحرف الصحيح يكسب
      بفارق واضح.

      لو مش واضح:
      لا نقول ممتاز.
      نخليه يعيد.
    */
    const contrastPassed =
      !bestAlternative ||
      (margin !== null &&
        margin >= MIN_MARGIN);

    const passed =
      accuracyPassed &&
      firstSoundPassed &&
      contrastPassed;

    let failureReason:
      | "low_accuracy"
      | "weak_first_sound"
      | "wrong_letter"
      | "ambiguous"
      | null = null;

    if (!accuracyPassed) {
      failureReason =
        "low_accuracy";
    } else if (
      !firstSoundPassed
    ) {
      failureReason =
        "weak_first_sound";
    } else if (
      bestAlternative &&
      margin !== null &&
      margin < 0
    ) {
      failureReason =
        "wrong_letter";
    } else if (
      !contrastPassed
    ) {
      failureReason =
        "ambiguous";
    }

    console.log(
      "ARABIC LETTER ASSESSMENT:",
      {
        target,

        targetAccuracy:
          primary.accuracy,

        targetFirstSound:
          primary.firstSoundScore,

        targetScore,

        alternatives:
          scoredAlternatives.map(
            (item) => ({
              reference:
                item.result
                  .referenceText,

              accuracy:
                item.result
                  .accuracy,

              firstSound:
                item.result
                  .firstSoundScore,

              score:
                item.score,
            })
          ),

        bestAlternative:
          bestAlternative
            ? bestAlternative
                .result
                .referenceText
            : null,

        margin,

        passed,

        failureReason,
      }
    );

    return Response.json({
      target,

      /*
        ما نعرضش للطالب
        Speech-to-Text هنا؛
        لأنه ممكن يكون مضلل.
      */
      recognized: "",

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

      discrimination: {
        targetScore,

        firstSoundScore:
          primary.firstSoundScore,

        closestAlternative:
          bestAlternative
            ? bestAlternative
                .result
                .referenceText
            : null,

        alternativeScore:
          bestAlternative
            ? bestAlternative.score
            : null,

        margin,
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