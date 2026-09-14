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

function validScore(
  value: number
): number | null {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return Math.round(value);
}

export async function POST(
  request: Request
) {
  let audioConfig:
    | SpeechSDK.AudioConfig
    | null = null;

  let recognizer:
    | SpeechSDK.SpeechRecognizer
    | null = null;

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

    /*
      التسجيل القادم من المتصفح
      تم تحويله بالفعل إلى:

      WAV
      PCM 16-bit
      Mono
      16 kHz
    */
    const audioBuffer =
      Buffer.from(
        await audio.arrayBuffer()
      );

    /*
      إعداد Azure Speech.
    */
    const speechConfig =
      SpeechSDK.SpeechConfig.fromSubscription(
        key,
        region
      );

    speechConfig.speechRecognitionLanguage =
      "ar-SA";

    /*
      Microsoft Speech SDK يدعم
      WAV Buffer مباشرة في Node.js.
    */
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
      هنا نفعّل Pronunciation Assessment
      رسميًا على الـrecognizer نفسه.
    */
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

    /*
      اطلب من Azure تحليل التسجيل مرة واحدة.
    */
    const result =
      await recognizeOnce(
        recognizer
      );

    if (
      result.reason ===
      SpeechSDK.ResultReason.NoMatch
    ) {
      return Response.json(
        {
          error:
            "لم أستطع سماع النطق بوضوح. حاول مرة أخرى.",
        },
        {
          status: 422,
        }
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
          reason:
            cancellation.reason,

          errorCode:
            cancellation.ErrorCode,

          errorDetails:
            cancellation.errorDetails,
        }
      );

      return Response.json(
        {
          error:
            "Azure Speech could not evaluate the recording.",
        },
        {
          status: 502,
        }
      );
    }

    if (
      result.reason !==
      SpeechSDK.ResultReason
        .RecognizedSpeech
    ) {
      console.error(
        "Unexpected Azure result:",
        result.reason
      );

      return Response.json(
        {
          error:
            "Speech was not recognized correctly.",
        },
        {
          status: 422,
        }
      );
    }

    /*
      دي أهم نقطة:

      بدل ما نستخرج scores يدويًا
      من REST JSON، بنخلي الـSDK
      نفسه يطلع PronunciationAssessmentResult.
    */
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

    /*
      ممنوع نحول missing score إلى 0.

      لو Azure عرف الكلام
      لكنه لم يرجع Pronunciation Score،
      نرجع Error واضح بدل
      ما نظلم الطالب بـ0/100.
    */
    if (
      accuracy === null ||
      pronunciation === null
    ) {
      console.error(
        "Pronunciation scores missing:",
        {
          recognized:
            result.text,

          accuracy:
            assessment.accuracyScore,

          pronunciation:
            assessment.pronunciationScore,

          fluency:
            assessment.fluencyScore,

          completeness:
            assessment.completenessScore,
        }
      );

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
      الـFluency والـCompleteness أقل أهمية
      جدًا في كلمة قصيرة مثل "ألف".

      لو لم يرجعا، نرسل null بدل 0.
    */
    const safeFluency =
      fluency ?? accuracy;

    const safeCompleteness =
      completeness ?? 100;

    /*
      نحاول أيضًا قراءة التفاصيل
      على مستوى الكلمة والفونيم.

      دي هنحتاجها بعدين علشان
      نقول للطالب أي صوت محتاج تحسين.
    */
    let words: Array<{
      word: string;
      accuracy: number | null;
      errorType: string;
      phonemes: Array<{
        phoneme: string | null;
        accuracy: number | null;
      }>;
    }> = [];

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
                typeof word
                  .PronunciationAssessment
                  ?.AccuracyScore ===
                "number"
                  ? Math.round(
                      word
                        .PronunciationAssessment
                        .AccuracyScore
                    )
                  : null,

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
                      typeof phoneme
                        .PronunciationAssessment
                        ?.AccuracyScore ===
                      "number"
                        ? Math.round(
                            phoneme
                              .PronunciationAssessment
                              .AccuracyScore
                          )
                        : null,
                  })
                ) ?? [],
            })
          );
      }
    } catch (error) {
      /*
        لو تفاصيل الفونيم فشلت،
        ما نكسرش التقييم الأساسي.
      */
      console.warn(
        "Could not parse detailed pronunciation result:",
        error
      );
    }

    /*
      Threshold مؤقت.

      بعد ما نجرب Azure على عدة أشخاص
      هنضبطه علميًا لكل Level.
    */
    const passed =
      accuracy >= 75;

    console.log(
      "PRONUNCIATION RESULT:",
      {
        target,
        recognized:
          result.text,
        accuracy,
        pronunciation,
        fluency:
          safeFluency,
        completeness:
          safeCompleteness,
        passed,
      }
    );

    return Response.json({
      target,

      recognized:
        result.text ?? "",

      passed,

      scores: {
        accuracy,

        pronunciation,

        fluency:
          safeFluency,

        completeness:
          safeCompleteness,
      },

      words,
    });
  } catch (error) {
    console.error(
      "PRONUNCIATION SDK ERROR:",
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
  } finally {
    /*
      مهم في Vercel:
      نقفل موارد Azure SDK
      بعد كل request.
    */
    try {
      recognizer?.close();
    } catch {}

    try {
      audioConfig?.close();
    } catch {}
  }
}