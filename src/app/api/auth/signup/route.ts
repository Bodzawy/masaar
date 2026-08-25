import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, createSessionCookie } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const msg = body.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  const email = body.data.email.toLowerCase();
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ ok: false, error: "An account with this email already exists" }, { status: 409 });
  }
  const user = await db.user.create({
    data: {
      email,
      name: body.data.name.trim(),
      passwordHash: await hashPassword(body.data.password),
      roleType: "STUDENT",
      studentProfile: { create: {} },
      notificationPref: { create: {} },
    },
  });
  await createSessionCookie({ userId: user.id, email: user.email, name: user.name, role: "STUDENT", onboarded: false });
  return NextResponse.json({ ok: true, redirect: "/onboarding" });
}
