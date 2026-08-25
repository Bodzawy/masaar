import { NextResponse } from "next/server";
import { setLocaleCookie, isLocale } from "@/lib/i18n/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (body && isLocale(body.locale)) {
    await setLocaleCookie(body.locale);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
