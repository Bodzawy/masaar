"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const schema = z.object({
  name: z.string().min(2, "Bitte gib deinen vollständigen Namen ein."),
  email: z.string().email("Bitte gib eine gültige E-Mail-Adresse ein."),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});
type Values = z.infer<typeof schema>;

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setError(data?.error ?? "Konto konnte nicht erstellt werden.");
      return;
    }
    router.replace(data.redirect ?? "/onboarding");
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
        <Label htmlFor="name">Vollständiger Name</Label>
        <Input id="name" autoComplete="name" placeholder="Lena Schmidt" aria-invalid={!!errors.name} {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" type="email" autoComplete="email" placeholder="name@beispiel.de" aria-invalid={!!errors.email} {...register("email")} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Passwort</Label>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
        Konto erstellen
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Schon registriert?{" "}
        <Link href="/signin" className="font-medium text-primary underline-offset-4 hover:underline">
          Anmelden
        </Link>
      </p>
    </form>
  );
}
