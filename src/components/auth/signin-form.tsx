"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "At least 8 characters"),
});
type Values = z.infer<typeof schema>;

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError(data?.error ?? "Invalid email or password");
      return;
    }
    router.replace(nextPath && nextPath.startsWith("/") ? nextPath : data.redirect ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="lena@demo.de" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export const DEMO_ACCOUNTS = [
  { label: "Student — Lena Schmidt", role: "student", email: "lena.schmidt@demo.deutschpath.dev", desc: "B2 · Chapter 1 · Lesson 3" },
  { label: "Teacher — Stefan Brinkmann", role: "teacher", email: "stefan.brinkmann@demo.deutschpath.dev", desc: "Senior · online" },
  { label: "Super Admin", role: "admin", email: "admin@demo.deutschpath.dev", desc: "Full access" },
  { label: "Academic Admin", role: "admin", email: "academic@demo.deutschpath.dev", desc: "Curriculum & certificates" },
  { label: "Moderator", role: "admin", email: "moderator@demo.deutschpath.dev", desc: "Reports & cases" },
  { label: "Teacher Manager", role: "admin", email: "manager@demo.deutschpath.dev", desc: "Onboarding & retakes" },
] as const;

export function DemoAccountSelector() {
  // Rendered only when the server passes demo accounts; server-side gated by
  // NODE_ENV !== "production" && DEMO_MODE === "true".
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function signIn(email: string) {
    setBusy(email);
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "demo1234!" }),
    });
    const data = await res.json().catch(() => null);
    if (data?.ok) {
      router.replace(data.redirect ?? "/");
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <div className="rounded-lg border border-dashed border-accent/60 bg-accent/10 p-4" data-testid="demo-account-selector">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
        <GraduationCap className="h-4 w-4" aria-hidden /> Demo accounts (development only) — password: demo1234!
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              onClick={() => signIn(a.email)}
              disabled={busy !== null}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-start text-sm shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <span className="block font-medium">{busy === a.email ? "Signing in…" : a.label}</span>
              <span className="block text-xs text-muted-foreground">{a.desc}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
