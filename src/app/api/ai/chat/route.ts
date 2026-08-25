import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getAiProvider } from "@/lib/ai/provider";

const schema = z.object({ message: z.string().min(1).max(1000) });

// Rate-limit integration point for AI chat.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const progress = await db.studentProgress.findFirst({
    where: { studentId: session.userId },
    orderBy: { updatedAt: "desc" },
  });
  const enrollment = await db.enrollment.findFirst({
    where: { studentId: session.userId, status: "ACTIVE" },
    include: { level: true },
  });

  const provider = getAiProvider();
  let reply: string;
  try {
    reply = await provider.reply(body.data.message, {
      level: progress?.levelCode ?? enrollment?.level.code ?? "A1",
    });
  } catch (e) {
    console.error("AI provider error", e);
    reply = "The assistant could not answer just now. Please try again shortly.";
  }

  await db.aiMessage.createMany({
    data: [
      { userId: session.userId, role: "user", content: body.data.message },
      { userId: session.userId, role: "assistant", content: reply },
    ],
  });
  return NextResponse.json({ reply, demoMode: provider.demoMode });
}
