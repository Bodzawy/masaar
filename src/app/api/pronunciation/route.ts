import { execFile } from "child_process";
import { promisify } from "util";
import {
  writeFile,
  unlink,
} from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

export const runtime = "nodejs";

const execFileAsync =
  promisify(execFile);

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

function normalizeArabic(
  text: string
) {
  return text
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[.,!?؟،]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(
  request: Request
) {
  const id =
    crypto.randomUUID();

  const webmPath = path.join(
    os.tmpdir(),
    `${id}.webm`
  );

  const wavPath = path.join(
    os.tmpdir(),
    `${id}.wav`
  );

  try {
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
            "لم يتم إرسال تسجيل صوتي",
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
          error:
            "الحرف المطلوب غير صحيح",
        },
        {
          status: 400,
        }
      );
    }

    const arrayBuffer =
      await audio.arrayBuffer();

    await writeFile(
      webmPath,
      Buffer.from(arrayBuffer)
    );

    // تحويل التسجيل إلى WAV 16kHz mono
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        webmPath,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        wavPath,
      ],
      {
        maxBuffer:
          10 * 1024 * 1024,
      }
    );

    // نستخدم small بدل base لتحسين العربي
    const modelPath =
      path.join(
        process.cwd(),
        "models",
        "ggml-small.bin"
      );

    const {
      stdout,
    } =
      await execFileAsync(
        "whisper-cli",
        [
          "-m",
          modelPath,

          "-f",
          wavPath,

          "-l",
          "ar",

          "-nt",

          "-np",

          "--prompt",
          "أسماء حروف عربية منفردة: ألف، باء، تاء، ثاء، جيم، حاء، خاء، دال، راء، سين",

          "-bo",
          "5",

          "-bs",
          "5",

          "-tp",
          "0",
        ],
        {
          maxBuffer:
            10 * 1024 * 1024,
        }
      );

    const heard =
      stdout.trim();

    const cleanHeard =
      normalizeArabic(heard);

    const cleanTarget =
      normalizeArabic(target);

    const correct =
      cleanHeard === cleanTarget ||
      cleanHeard.includes(
        cleanTarget
      );

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
      "LOCAL WHISPER ERROR:",
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

  } finally {
    await unlink(
      webmPath
    ).catch(() => {});

    await unlink(
      wavPath
    ).catch(() => {});
  }
}