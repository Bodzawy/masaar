export const runtime = "nodejs";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

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

    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return Response.json(
        { error: "Text is required." },
        { status: 400 }
      );
    }

    const voice = "ar-SA-ZariyahNeural";

    const ssml = `
      <speak version="1.0"
             xmlns="http://www.w3.org/2001/10/synthesis"
             xml:lang="ar-SA">
        <voice name="${voice}">
          <prosody rate="-8%">
            ${escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `.trim();

    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
          "User-Agent": "Masaar",
        },
        body: ssml,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("AZURE TTS ERROR:", response.status, errorText);

      return Response.json(
        { error: "Could not generate Arabic speech." },
        { status: response.status }
      );
    }

    const audio = await response.arrayBuffer();

    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("TTS ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "TTS failed.",
      },
      { status: 500 }
    );
  }
}