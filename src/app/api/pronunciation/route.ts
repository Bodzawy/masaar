import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

import {
  ARABIC_LETTERS,
} from "@/lib/pronunciation/letters";

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

      // ==========================
      // MASAAR
      // ==========================
      let masaar: any = null;

      try {
        const masaarForm = new FormData();

        masaarForm.append(
          "audio",
          new Blob([audioBuffer]),
          "voice.wav"
        );

        console.log("CALLING MASAAR...");

        const masaarResponse = await fetch(
          "http://127.0.0.1:5001/predict",
          {
            method: "POST",
            body: masaarForm,
          }
        );

        console.log(
          "MASAAR STATUS:",
          masaarResponse.status
        );

        const text = await masaarResponse.text();

        console.log("MASAAR RAW:", text);

        masaar = JSON.parse(text);
      } catch (error) {
        console.error("MASAAR ERROR:", error);
      }

      console.log("FINAL MASAAR RESULT:", masaar);

      // ==========================
      // IQRA
      // ==========================
      let iqra: any = null;

      try {
        const iqraForm = new FormData();

        iqraForm.append(
          "audio",
          new Blob([audioBuffer]),
          "voice.wav"
        );

        console.log("CALLING IQRA...");

        const iqraResponse = await fetch(
            "http://127.0.0.1:5002/predict",
          {
            method: "POST",
            body: iqraForm,
          }
        );

        console.log("IQRA STATUS:", iqraResponse.status);

        const iqraText = await iqraResponse.text();

        console.log("IQRA RAW:", iqraText);

        const iqraJson = JSON.parse(iqraText);

        if (iqraJson.ok === false) {
          console.error("IQRA MODEL ERROR:", iqraJson.error);
          iqra = null;
        } else {
          iqra = {
            sequence: iqraJson.sequence,
            phonemes: iqraJson.phonemes, // array of strings زي ["f","aa","<"]
            duration: iqraJson.duration,
          };
        }
      } catch (error) {
        console.error("IQRA ERROR:", error);
      }

      console.log("FINAL IQRA RESULT:", iqra);

    
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

    const alternativeScore =
      bestAlternative?.score ??
      null;

    const margin =
      targetScore !== null &&
      alternativeScore !== null
        ? targetScore -
          alternativeScore
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
      أهم تعديل:

      لو المنافس قريب فقط،
      لا نرفض الطالب.

      نرفض فقط لو المنافس نفسه
      متفوق على المطلوب بفارق واضح.
    */
    const clearlyWrongLetter =
      margin !== null &&
      margin <=
        -WRONG_LETTER_MARGIN;

    const passed =
      accuracyPassed &&
      firstSoundPassed &&
      !clearlyWrongLetter;

    let failureReason:
      | "low_accuracy"
      | "weak_first_sound"
      | "wrong_letter"
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
      clearlyWrongLetter
    ) {
      failureReason =
        "wrong_letter";
    }

    console.log(
      "ARABIC LETTER ASSESSMENT:",
      {
        target,

        targetAccuracy:
          primary.accuracy,

        firstSound:
          primary.firstSoundScore,

        targetScore,

        closestAlternative:
          bestAlternative
            ?.result
            .referenceText ??
          null,

        alternativeScore,

        margin,

        passed,

        failureReason,
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
      
        discrimination: {
          targetScore,
      
          firstSoundScore:
            primary.firstSoundScore,
      
          closestAlternative:
            bestAlternative
              ?.result
              .referenceText ??
            null,
      
          alternativeScore,
      
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