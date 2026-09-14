import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import {
  ARABIC_LETTERS,
} from "@/lib/pronunciation/letters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANGUAGE = "ar-EG";
const MIN_ACCURACY = 75;

const allowedTargets = new Set(
  ARABIC_LETTERS.map(
    (item) => item.referenceText
  )
);

const letterNames =
  ARABIC_LETTERS.map(
    (item) => item.referenceText
  );

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

type PronunciationResult = {
  recognized: string;

  accuracy: number;
  pronunciation: number;

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

/*
  المرحلة الأولى:

  لا نقول لـAzure ما هو الحرف المطلوب.

  فقط نقول له:
  الكلام المتوقع واحد من أسماء
  الحروف العربية الـ28.

  وبالتالي نحاول معرفة:
  هل الطالب قال تاء؟
  أم ثاء؟
  أم طاء؟
  أم فاء؟
  ...
*/
async function identifyLetter(
  audioBuffer: Buffer,
  key: string,
  region: string
): Promise<string> {
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

    /*
      نساعد Azure بأن نقول له إن الكلام
      المتوقع هو أسماء الحروف فقط.
    */
    const phraseList =
      SpeechSDK.PhraseListGrammar.fromRecognizer(
        recognizer
      );

    for (
      const letterName of letterNames
    ) {
      phraseList.addPhrase(
        letterName
      );
    }

    const result =
      await recognizeOnce(
        recognizer
      );

    if (
      result.reason ===
      SpeechSDK.ResultReason.NoMatch
    ) {
      return "";
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
        "AZURE IDENTIFICATION CANCELED:",
        {
          reason:
            cancellation.reason,

          errorCode:
            cancellation.ErrorCode,

          errorDetails:
            cancellation.errorDetails,
        }
      );

      throw new Error(
        "Azure could not identify the spoken letter."
      );
    }

    if (
      result.reason !==
      SpeechSDK.ResultReason
        .RecognizedSpeech
    ) {
      return "";
    }

    return result.text ?? "";
  } finally {
    try {
      recognizer?.close();
    } catch {}

    try {
      audioConfig?.close();
    } catch {}
  }
}

/*
  المرحلة الثانية:

  بعد معرفة ماذا قال الطالب،
  نقيّم جودة نطقه للحرف المطلوب.
*/
async function assessPronunciation(
  audioBuffer: Buffer,
  target: string,
  key: string,
  region: string
): Promise<PronunciationResult> {
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
        target,

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
        "AZURE ASSESSMENT CANCELED:",
        {
          reason:
            cancellation.reason,

          errorCode:
            cancellation.ErrorCode,

          errorDetails:
            cancellation.errorDetails,
        }
      );

      throw new Error(
        "Azure could not evaluate the pronunciation."
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

    if (
      accuracy === null ||
      pronunciation === null
    ) {
      throw new Error(
        "Azure did not return a pronunciation score."
      );
    }

    let words: PronunciationResult["words"] =
      [];

    try {
      const rawJson =
        result.properties.getProperty(
          SpeechSDK.PropertyId
            .SpeechServiceResponse_JsonResult
        );

      if (rawJson) {
        const raw =
          JSON.parse(
            rawJson
          ) as RawAzureResult;

        const rawWords =
          raw.NBest?.[0]
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
        "Could not parse phoneme details:",
        error
      );
    }

    return {
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
      STEP 1:
      ماذا قال الطالب فعلاً؟
    */
    const identified =
      await identifyLetter(
        audioBuffer,
        key,
        region
      );

    /*
      STEP 2:
      جودة النطق مقارنة بالحرف المطلوب.
    */
    const assessment =
      await assessPronunciation(
        audioBuffer,
        target,
        key,
        region
      );

    const normalizedTarget =
      normalizeArabic(
        target
      );

    const normalizedIdentified =
      normalizeArabic(
        identified
      );

    const correctLetter =
      normalizedIdentified ===
      normalizedTarget;

    const accuracyPassed =
      assessment.accuracy >=
      MIN_ACCURACY;

    const passed =
      correctLetter &&
      accuracyPassed;

    let failureReason:
      | "wrong_letter"
      | "low_accuracy"
      | "not_recognized"
      | null = null;

    if (!normalizedIdentified) {
      failureReason =
        "not_recognized";
    } else if (!correctLetter) {
      failureReason =
        "wrong_letter";
    } else if (!accuracyPassed) {
      failureReason =
        "low_accuracy";
    }

    console.log(
      "PRONUNCIATION RESULT:",
      {
        target,

        identified,

        assessmentRecognized:
          assessment.recognized,

        correctLetter,

        accuracy:
          assessment.accuracy,

        pronunciation:
          assessment.pronunciation,

        passed,

        failureReason,
      }
    );

    return Response.json({
      target,

      /*
        مهم:
        نعرض ما سمعه Azure
        في مرحلة تحديد الحرف.
      */
      recognized:
        identified,

      passed,

      failureReason,

      scores: {
        accuracy:
          assessment.accuracy,

        pronunciation:
          assessment.pronunciation,

        fluency:
          assessment.fluency ??
          assessment.accuracy,

        completeness:
          assessment.completeness ??
          100,
      },

      identification: {
        expected:
          target,

        heard:
          identified,

        correct:
          correctLetter,
      },

      words:
        assessment.words,
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