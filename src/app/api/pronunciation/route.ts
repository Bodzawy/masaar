import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import {
  ARABIC_LETTERS,
} from "@/lib/pronunciation/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedTargets = new Set(
  ARABIC_LETTERS.map(
    (item) => item.referenceText
  )
);

/*
  هنبدأ فقط بأهم تجربة عندنا:

  تاء ↔ طاء

  لو أثبتت نجاحها، هنضيف:
  س / ص
  ح / ه / خ
  ع / غ
  ك / ق
  ...إلخ
*/
const CONFUSION_TARGETS: Record<
  string,
  string[]
> = {
  تاء: ["طاء"],
  طاء: ["تاء"],
};

const MIN_ACCURACY = 75;

/*
  المطلوب لازم يكون أعلى
  من الحرف المنافس بفارق معقول.

  نبدأ بـ5 درجات ثم نضبط الرقم
  بعد التجربة على عدة أصوات.
*/
const MIN_CONTRAST_MARGIN = 5;

type Assessment = {
  referenceText: string;
  recognized: string;

  accuracy: number | null;
  pronunciation: number | null;
  fluency: number | null;
  completeness: number | null;

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

function normalizeArabic(
  value: string
) {
  return value
    .replace(
      /[\u064B-\u065F\u0670]/g,
      ""
    )
    .replace(/ـ/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[^\u0621-\u064A]/g, "")
    .trim();
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

async function assessAgainstReference(
  audioBuffer: Buffer,
  referenceText: string,
  key: string,
  region: string
): Promise<Assessment> {
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
      "ar-SA";

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
      throw new Error(
        "Speech was not recognized clearly."
      );
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
        "AZURE SPEECH CANCELED:",
        {
          referenceText,

          reason:
            cancellation.reason,

          errorCode:
            cancellation.ErrorCode,

          errorDetails:
            cancellation.errorDetails,
        }
      );

      throw new Error(
        "Azure Speech could not evaluate the recording."
      );
    }

    if (
      result.reason !==
      SpeechSDK.ResultReason
        .RecognizedSpeech
    ) {
      throw new Error(
        "Speech was not recognized correctly."
      );
    }

    const pronunciationResult =
      SpeechSDK.PronunciationAssessmentResult.fromResult(
        result
      );

    const accuracy =
      validScore(
        pronunciationResult.accuracyScore
      );

    const pronunciation =
      validScore(
        pronunciationResult.pronunciationScore
      );

    const fluency =
      validScore(
        pronunciationResult.fluencyScore
      );

    const completeness =
      validScore(
        pronunciationResult.completenessScore
      );

    let words: Assessment["words"] =
      [];

    try {
      const rawJson =
        result.properties.getProperty(
          SpeechSDK.PropertyId
            .SpeechServiceResponse_JsonResult
        );

      if (rawJson) {
        const rawResult =
          JSON.parse(
            rawJson
          ) as RawAzureResult;

        const rawWords =
          rawResult.NBest?.[0]
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
        "Could not parse detailed pronunciation result:",
        error
      );
    }

    return {
      referenceText,

      recognized:
        result.text ?? "",

      accuracy,

      pronunciation,

      fluency,

      completeness,

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
      1. تقييم التسجيل مقابل
         الحرف المطلوب فعلاً.
    */
    const primary =
      await assessAgainstReference(
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
            "Azure recognized the speech, but did not return a pronunciation score.",
        },
        {
          status: 502,
        }
      );
    }

    /*
      2. نجيب الحروف التي يمكن
         الخلط بينها وبين المطلوب.
    */
    const alternatives =
      CONFUSION_TARGETS[target] ??
      [];

    const contrastResults: Assessment[] =
      [];

    /*
      3. نفس التسجيل يتقيّم مرة أخرى
         أمام كل حرف مشابه.
    */
    for (
      const alternative of alternatives
    ) {
      const result =
        await assessAgainstReference(
          audioBuffer,
          alternative,
          key,
          region
        );

      contrastResults.push(
        result
      );
    }

    /*
      4. نعرف أقوى منافس.
    */
    const validAlternatives =
      contrastResults.filter(
        (
          item
        ): item is Assessment & {
          accuracy: number;
        } =>
          typeof item.accuracy ===
          "number"
      );

    const bestAlternative =
      validAlternatives.sort(
        (a, b) =>
          b.accuracy -
          a.accuracy
      )[0];

    /*
      5. لو Speech-to-Text نفسه
         قال بوضوح إن الطالب نطق
         الحرف الآخر، نرفضه.
    */
    const normalizedRecognized =
      normalizeArabic(
        primary.recognized
      );

    const recognizedAsAlternative =
      alternatives.some(
        (alternative) =>
          normalizeArabic(
            alternative
          ) ===
          normalizedRecognized
      );

    /*
      6. نحسب الفارق بين المطلوب
         وأقرب حرف مشابه.
    */
    const contrastMargin =
      bestAlternative
        ? primary.accuracy -
          bestAlternative.accuracy
        : null;

    /*
      النجاح العادي:
      Accuracy >= 75

      ولو عندنا حرف مشابه:
      لازم المطلوب يتفوق عليه
      بفارق 5 درجات على الأقل.
    */
    const accuracyPassed =
      primary.accuracy >=
      MIN_ACCURACY;

    const contrastPassed =
      !bestAlternative ||
      contrastMargin === null ||
      contrastMargin >=
        MIN_CONTRAST_MARGIN;

    const passed =
      accuracyPassed &&
      contrastPassed &&
      !recognizedAsAlternative;

    let failureReason:
      | "low_accuracy"
      | "confused_letter"
      | "ambiguous"
      | null = null;

    if (!accuracyPassed) {
      failureReason =
        "low_accuracy";
    } else if (
      recognizedAsAlternative
    ) {
      failureReason =
        "confused_letter";
    } else if (
      !contrastPassed
    ) {
      /*
        لو المنافس أعلى من المطلوب:
        غالبًا قال الحرف المنافس.

        لو الفرق بسيط جدًا:
        نعتبرها ambiguous
        ونخليه يعيد بدل ما نحكم
        عليه حكم غلط.
      */
      if (
        bestAlternative &&
        bestAlternative.accuracy >
          primary.accuracy
      ) {
        failureReason =
          "confused_letter";
      } else {
        failureReason =
          "ambiguous";
      }
    }

    console.log(
      "PRONUNCIATION CONTRAST RESULT:",
      {
        target,

        recognized:
          primary.recognized,

        targetAccuracy:
          primary.accuracy,

        bestAlternative:
          bestAlternative
            ? {
                target:
                  bestAlternative.referenceText,

                accuracy:
                  bestAlternative.accuracy,
              }
            : null,

        contrastMargin,

        passed,

        failureReason,
      }
    );

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

      contrast:
        bestAlternative
          ? {
              expected: target,

              expectedScore:
                primary.accuracy,

              alternative:
                bestAlternative.referenceText,

              alternativeScore:
                bestAlternative.accuracy,

              margin:
                contrastMargin,
            }
          : null,

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