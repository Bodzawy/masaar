export const runtime = "nodejs";

const allowedTargets = [
  "ألف",
  "باء",
  "تاء",
  "ثاء",
  "جيم",
  "حاء",
  "خاء",
  "دال",
  "راء",
  "سين",
];

function normalizeArabic(text: string) {
  return text
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[.,!?؟،]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "GROQ_API_KEY is not configured",
        },
        {
          status: 500,
        }
      );
    }

    const formData = await request.formData();

    const audio = formData.get("audio");
    const target = formData.get("target");

    if (!audio || typeof audio === "string") {
      return Response.json(
        {
          error: "لم يتم إرسال تسجيل صوتي",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !target ||
      typeof target !== "string" ||
      !allowedTargets.includes(target)
    ) {
      return Response.json(
        {
          error: "الحرف المطلوب غير صحيح",
        },
        {
          status: 400,
        }
      );
    }

    const groqFormData = new FormData();

    groqFormData.append(
      "file",
      audio,
      audio.name || "voice.webm"
    );

    groqFormData.append(
      "model",
      "whisper-large-v3"
    );

    groqFormData.append(
      "language",
      "ar"
    );

    groqFormData.append(
      "response_format",
      "json"
    );

    groqFormData.append(
      "temperature",
      "0"
    );

    groqFormData.append(
      "prompt",
      "أسماء حروف عربية منفردة: ألف، باء، تاء، ثاء، جيم، حاء، خاء، دال، راء، سين"
    );

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
        },

        body: groqFormData,
      }
    );

    const result = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error(
        "GROQ TRANSCRIPTION ERROR:",
        result
      );

      return Response.json(
        {
          error:
            result?.error?.message ||
            "حدث خطأ أثناء تحليل الصوت",
        },
        {
          status: groqResponse.status,
        }
      );
    }

    const heard =
      typeof result?.text === "string"
        ? result.text.trim()
        : "";

    const cleanHeard =
      normalizeArabic(heard);

    const cleanTarget =
      normalizeArabic(target);

    const correct =
      cleanHeard === cleanTarget ||
      cleanHeard.includes(cleanTarget);

    console.log({
      target,
      heard,
      cleanHeard,
      correct,
    });

    return Response.json({
      target,
      heard,
      correct,
    });
  } catch (error: any) {
    console.error(
      "PRONUNCIATION ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "حدث خطأ أثناء تحليل الصوت",
      },
      {
        status: 500,
      }
    );
  }
}