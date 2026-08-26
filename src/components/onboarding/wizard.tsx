"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, ClipboardList, Loader2, Rocket, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLACEMENT_QUESTIONS } from "@/config/placement";
import { CEFR_LEVELS, PLACEMENT_THRESHOLDS } from "@/config/domain";
import type { CefrCode } from "@/config/domain";

const profileSchema = z.object({
  country: z.string().min(1, "Bitte gib dein Land an."),
  nativeLanguage: z.string().min(1, "Bitte gib deine Muttersprache an."),
  ageRange: z.string().min(1, "Bitte wähle deine Altersgruppe."),
  learningGoal: z.string().min(1, "Bitte wähle ein Lernziel."),
  expectedLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  preferredStudyTimes: z.string().min(1, "Bitte wähle deine wöchentliche Lernzeit."),
  studyPreference: z.string().min(1, "Bitte wähle dein Lerntempo."),
  alphabetFamiliarity: z.string().min(1, "Bitte antworte zur arabischen Schrift."),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function OnboardingWizard({ name }: { name: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<"a1" | "placement" | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      country: "Deutschland",
      nativeLanguage: "Deutsch",
      ageRange: "",
      learningGoal: "",
      expectedLevel: "A1",
      preferredStudyTimes: "",
      studyPreference: "",
      alphabetFamiliarity: "",
    },
  });

  const suggestedLevel: CefrCode | null = useMemo(() => {
    if (choice === "a1") return "A1";
    if (choice !== "placement") return null;
    const correct = PLACEMENT_QUESTIONS.filter((q) => answers[q.id] === q.correctIndex).length;
    let level: CefrCode = "A1";
    for (const t of PLACEMENT_THRESHOLDS) if (correct >= t.minCorrect) level = t.level;
    return level;
  }, [choice, answers]);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const values = form.getValues();
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, suggestedLevel }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        // Ladeanzeige stoppt; verständlicher, wiederholbarer Fehler – kein endloser Spinner.
        setError(data?.error ?? `Der Server hat einen Fehler gemeldet (${res.status}).`);
        return;
      }
      router.replace("/student");
      router.refresh();
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte prüfe dein Netzwerk und versuche es erneut.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <ol className="flex items-center gap-2 text-sm" aria-label="Onboarding-Fortschritt">
        {["Dein Profil", "Einstufung", "Bestätigen"].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                step as number >= i + 1
                  ? "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                  : "flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
              }
              aria-current={step === i + 1 ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span className={step as number >= i + 1 ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {i < 2 && <span className="mx-1 h-px w-8 bg-border" aria-hidden />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Willkommen, {name.split(" ")[0]}!</CardTitle>
            <CardDescription>Erzähl uns kurz von dir – so passen wir deinen Lernweg an.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={form.handleSubmit(() => setStep(2), () => undefined)}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="country">Land</Label>
                <Input id="country" placeholder="Deutschland" aria-invalid={!!form.formState.errors.country} {...form.register("country")} />
                {form.formState.errors.country && <p className="text-xs text-destructive">{form.formState.errors.country.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nativeLanguage">Muttersprache</Label>
                <Input id="nativeLanguage" placeholder="Deutsch" aria-invalid={!!form.formState.errors.nativeLanguage} {...form.register("nativeLanguage")} />
                {form.formState.errors.nativeLanguage && <p className="text-xs text-destructive">{form.formState.errors.nativeLanguage.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ageRange">Altersgruppe</Label>
                <select
                  id="ageRange"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-invalid={!!form.formState.errors.ageRange}
                  {...form.register("ageRange")}
                >
                  <option value="">Auswählen…</option>
                  <option>18–24</option><option>25–34</option><option>35–44</option><option>45–54</option><option>55+</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learningGoal">Warum möchtest du Arabisch lernen?</Label>
                <select id="learningGoal" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-invalid={!!form.formState.errors.learningGoal} {...form.register("learningGoal")}>
                  <option value="">Auswählen…</option>
                  <option>Alltag und Kommunikation</option>
                  <option>Reisen</option>
                  <option>Beruf</option>
                  <option>Familie und Freunde</option>
                  <option>Studium</option>
                  <option>Lesen und Schreiben</option>
                  <option>Religion / klassische Texte</option>
                  <option>Allgemeine Sprachkenntnisse</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expectedLevel">Geschätztes Startniveau</Label>
                <select id="expectedLevel" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("expectedLevel")}>
                  {CEFR_LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferredStudyTimes">Lernzeit pro Woche</Label>
                <select id="preferredStudyTimes" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-invalid={!!form.formState.errors.preferredStudyTimes} {...form.register("preferredStudyTimes")}>
                  <option value="">Auswählen…</option>
                  <option>1–2 Std. pro Woche</option>
                  <option>3–5 Std. pro Woche</option>
                  <option>6–10 Std. pro Woche</option>
                  <option>mehr als 10 Std. pro Woche</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="alphabetFamiliarity">Kannst du das arabische Alphabet lesen?</Label>
                <RadioGroup
                  onValueChange={(v: string) => form.setValue("alphabetFamiliarity", v, { shouldValidate: true })}
                  value={form.watch("alphabetFamiliarity")}
                  className="flex flex-wrap gap-3"
                >
                  {([
                    ["none", "Nein, noch gar nicht"],
                    ["basic", "Ein wenig – Buchstaben erkenne ich"],
                    ["fluent", "Ja, ich kann lesen"],
                  ] as Array<[string, string]>).map(([v, label]) => (
                    <Label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-normal has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                      <RadioGroupItem value={v} /> {label}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Bevorzugtes Lerntempo</Label>
                <RadioGroup
                  value={form.watch("studyPreference")}
                  onValueChange={(v: string) => form.setValue("studyPreference", v, { shouldValidate: true })}
                  className="flex flex-wrap gap-3"
                >
                  {([["focused", "Fokussiert & intensiv"], ["balanced", "Ausgewogen"], ["relaxed", "Entspannt & beständig"]] as Array<[string, string]>).map(([v, label]) => (
                    <Label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-normal has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                      <RadioGroupItem value={v} /> {label}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              {(Object.keys(form.formState.errors).length > 0) && (
                <p role="alert" className="sm:col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Bitte fülle alle Felder aus, um fortzufahren.
                </p>
              )}
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Weiter <ArrowRight className="rtl:rotate-180" aria-hidden />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Wo soll dein Lernweg beginnen?</CardTitle>
            <CardDescription>Wähle eine Einstufung – deine Lehrkraft kann später feinjustieren.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setChoice("a1"); setStep(3); }}
              className="rounded-xl border border-border bg-background p-6 text-start transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Rocket className="h-6 w-6 text-primary" aria-hidden />
              <p className="mt-3 font-semibold">Bei A1 starten</p>
              <p className="mt-1 text-sm text-muted-foreground">Von Null an beginnen – Alphabet, Aussprache, erste Wörter.</p>
            </button>
            <button
              type="button"
              onClick={() => setChoice("placement")}
              className="rounded-xl border border-border bg-background p-6 text-start transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ClipboardList className="h-6 w-6 text-accent" aria-hidden />
              <p className="mt-3 font-semibold">Einstufungstest machen</p>
              <p className="mt-1 text-sm text-muted-foreground">16 kurze Fragen. Wir schlagen transparent das passende Niveau vor.</p>
            </button>

            {choice === "placement" && (
              <div className="space-y-5 sm:col-span-2">
                {PLACEMENT_QUESTIONS.map((q, qi) => (
                  <fieldset key={q.id} className="rounded-lg border border-border bg-background p-4">
                    <legend className="px-1 text-sm font-medium">
                      {qi + 1}. {q.prompt} <Badge variant="muted" className="ms-1">{q.levelProbe}</Badge>
                    </legend>
                    <RadioGroup
                      value={answers[q.id]?.toString()}
                      onValueChange={(v: string) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      {q.options.map((opt, oi) => (
                        <Label key={oi} className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-normal hover:bg-muted has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                          <RadioGroupItem value={oi.toString()} />
                          <span dir={q.optionDir === "rtl" ? "rtl" : undefined} className={q.optionDir === "rtl" ? "font-arabic" : ""}>{opt}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                ))}
                <div className="flex justify-end">
                  <Button onClick={() => setStep(3)} disabled={Object.keys(answers).length < PLACEMENT_QUESTIONS.length}>
                    Weiter <ArrowRight className="rtl:rotate-180" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && choice && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Du bist bereit zum Starten</CardTitle>
            <CardDescription>
              {suggestedLevel
                ? choice === "placement"
                  ? `Aufgrund deines Testergebnisses schlagen wir den Einstieg bei ${suggestedLevel} vor. Deine Lehrkraft kann das im Live-Unterricht feinjustieren.`
                  : `Wir starten bei ${suggestedLevel}. Deine Lehrkraft kann das im Live-Unterricht feinjustieren.`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(choice === "placement" ? 2 : 1)} disabled={saving}>
                <ArrowLeft className="rtl:rotate-180" aria-hidden /> Zurück
              </Button>
              <Button size="lg" onClick={finish} disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                {saving ? "Lernweg wird eingerichtet…" : "Meinen Lernweg starten"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
