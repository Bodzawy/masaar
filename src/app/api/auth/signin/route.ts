import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSessionCookie } from "@/lib/auth";
import { homeForRole } from "@/lib/routing";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Rate-limit integration point (per-IP): plug a limiter here before validation.
export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }
  const user = await db.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
    include: { studentProfile: true },
  });
  // Uniform error to avoid account enumeration.
  if (!user || user.status === "DEACTIVATED" || !(await verifyPassword(body.data.password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }
  if (user.status === "SUSPENDED") {
    return NextResponse.json({ ok: false, error: "This account is suspended. Contact support." }, { status: 403 });
  }
  await createSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.roleType,
    onboarded: user.roleType === "STUDENT" ? !!user.studentProfile?.onboardedAt : undefined,
  });
  let redirect = homeForRole(user.roleType);
  if (user.roleType === "STUDENT" && !user.studentProfile?.onboardedAt) redirect = "/onboarding";
  return NextResponse.json({ ok: true, redirect });
}
