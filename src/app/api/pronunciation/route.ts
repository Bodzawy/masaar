import { ARABIC_LETTERS } from "@/lib/pronunciation/letters";

export const runtime = "nodejs";

const allowedTargets = new Set(
  ARABIC_LETTERS.map((item) => item.referenceText)
);

type AzureAssessment = {
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  PronScore?: number;
};

type AzureResult = {
  RecognitionStatus?: string;
  DisplayText?: string;

  NBest?: Array<{
    Display?: string;
    Lexical?: string;

    PronunciationAssessment?: AzureAssessment;

    Words?: Array<{
      Word?: string;

      PronunciationAssessment?: {
        AccuracyScore?: number;
        ErrorType?: string;
      };

      Phonemes?: Array<{
        Phoneme?: string;

        PronunciationAssessment?: {
          AccuracyScore?: number;
        };
      }>;
    }>;
  }>;
};

export async function POST(request: Request) {
  try {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      return Response.json(
        { error: "Azure Speech is not configured." },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    const audio = formData.get("audio");
    const target = formData.get("target");

    if (!audio || typeof audio === "string") {
      return Response.json(
        { error: "Audio is required." },
        { status: 400 }
      );
    }

    if (
      typeof target !== "string" ||
      !allowedTargets.has(target)
    ) {
      return Response.json(
        { error: "Invalid target." },
        { status: 400 }
      );
    }

    const config = {
      ReferenceText: target,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    };

    const pronunciationHeader = Buffer.from(
      JSON.stringify(config),
      "utf8"
    ).toString("base64");

    const endpoint =
      `https://${region}.stt.speech.microsoft.com` +
      `/speech/recognition/conversation/cognitiveservices/v1` +
      `?language=ar-SA&format=detailed`;

    const response = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Ocp-Apim-Subscription-Key": key,

        "Pronunciation-Assessment":
          pronunciationHeader,

        "Content-Type":
          "audio/wav; codecs=audio/pcm; samplerate=16000",

        Accept: "application/json",
      },

      body: Buffer.from(
        await audio.arrayBuffer()
      ),
    });

    const raw = await response.text();

    let result: AzureResult;

    try {
      result = JSON.parse(raw);
    } catch {
      console.error("AZURE INVALID RESPONSE:", raw);

      return Response.json(
        { error: "Invalid Azure response." },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error(
        "AZURE ASSESSMENT ERROR:",
        response.status,
        result
      );

      return Response.json(
        { error: "Pronunciation assessment failed." },
        { status: response.status }
      );
    }

    if (result.RecognitionStatus !== "Success") {
      return Response.json(
        {
          error: "Speech was not recognized clearly.",
          recognitionStatus: result.RecognitionStatus,
        },
        { status: 422 }
      );
    }

    const best = result.NBest?.[0];

    const assessment =
      best?.PronunciationAssessment;

    const accuracy = Math.round(
      assessment?.AccuracyScore ?? 0
    );

    const pronunciation = Math.round(
      assessment?.PronScore ?? accuracy
    );

    const fluency = Math.round(
      assessment?.FluencyScore ?? 0
    );

    const completeness = Math.round(
      assessment?.CompletenessScore ?? 0
    );

    const passed = accuracy >= 75;

    return Response.json({
      target,

      recognized:
        result.DisplayText ||
        best?.Display ||
        best?.Lexical ||
        "",

      passed,

      scores: {
        accuracy,
        pronunciation,
        fluency,
        completeness,
      },

      words:
        best?.Words?.map((word) => ({
          word: word.Word ?? "",

          accuracy: Math.round(
            word.PronunciationAssessment
              ?.AccuracyScore ?? 0
          ),

          errorType:
            word.PronunciationAssessment
              ?.ErrorType ?? "None",

          phonemes:
            word.Phonemes?.map((phoneme) => ({
              phoneme: phoneme.Phoneme ?? null,

              accuracy: Math.round(
                phoneme.PronunciationAssessment
                  ?.AccuracyScore ?? 0
              ),
            })) ?? [],
        })) ?? [],
    });
  } catch (error) {
    console.error(
      "PRONUNCIATION ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Pronunciation assessment failed.",
      },
      { status: 500 }
    );
  }
}