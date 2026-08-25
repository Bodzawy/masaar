"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, ClipboardList, Loader2, Rocket } from "lucide-react";
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
  country: z.string().min(1, "Required"),
  nativeLanguage: z.string().min(1, "Required"),
  ageRange: z.string().min(1, "Required"),
  learningGoal: z.string().min(1, "Required"),
  expectedLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  preferredStudyTimes: z.string().min(1, "Required"),
  studyPreference: z.string().min(1, "Required"),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function OnboardingWizard({ name }: { name: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [choice, setChoice] = useState<"a1" | "placement" | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      country: "", nativeLanguage: "", ageRange: "",
      learningGoal: "", expectedLevel: "B1",
      preferredStudyTimes: "", studyPreference: "",
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
    const values = form.getValues();
    await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, suggestedLevel }),
    });
    router.replace("/student");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <ol className="flex items-center gap-2 text-sm" aria-label="Onboarding progress">
        {["Your profile", "Placement", "Confirm"].map((label, i) => (
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
            <CardTitle>Welcome, {name.split(" ")[0]}!</CardTitle>
            <CardDescription>Tell us a little about you so we can tailor your path.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={form.handleSubmit(() => setStep(2), () => undefined)}
              noValidate
            >
              {(
                [
                  ["country", "Country", "Germany"],
                  ["nativeLanguage", "Native language", "e.g. Arabic"],
                ] as const
              ).map(([field, label, ph]) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={field}>{label}</Label>
                  <Input id={field} placeholder={ph} aria-invalid={!!form.formState.errors[field]} {...form.register(field)} />
                  {form.formState.errors[field] && <p className="text-xs text-destructive">{form.formState.errors[field]?.message}</p>}
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="ageRange">Age range</Label>
                <select
                  id="ageRange"
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...form.register("ageRange")}
                >
                  <option value="">Select…</option>
                  <option>18–24</option><option>25–34</option><option>35–44</option><option>45–54</option><option>55+</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learningGoal">Learning goal</Label>
                <select id="learningGoal" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("learningGoal")}>
                  <option value="">Select…</option>
                  <option>Work & career</option><option>University studies</option><option>Everyday life in Germany</option><option>Culture & travel</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expectedLevel">Expected starting level</Label>
                <select id="expectedLevel" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("expectedLevel")}>
                  {CEFR_LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferredStudyTimes">Preferred study times</Label>
                <select id="preferredStudyTimes" className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("preferredStudyTimes")}>
                  <option value="">Select…</option><option>Mornings</option><option>Lunch breaks</option><option>Afternoons</option><option>Evenings</option><option>Weekends</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Study preference</Label>
                <RadioGroup defaultValue="balanced" onValueChange={(v: string) => form.setValue("studyPreference", v)} className="flex flex-wrap gap-3">
                  {([["focused", "Focused intensity"], ["balanced", "Balanced pace"], ["relaxed", "Relaxed & steady"]] as Array<[string, string]>).map(([v, label]) => (
                    <Label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-normal has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                      <RadioGroupItem value={v} /> {label}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit">Continue <ArrowRight className="rtl:rotate-180" aria-hidden /></Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Where should your path begin?</CardTitle>
            <CardDescription>Choose a placement option — you can always adjust later with your teacher.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setChoice("a1"); setStep(3); }}
              className="rounded-xl border border-border bg-background p-6 text-start transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Rocket className="h-6 w-6 text-primary" aria-hidden />
              <p className="mt-3 font-semibold">Start from A1</p>
              <p className="mt-1 text-sm text-muted-foreground">Begin at the very beginning and build every foundation properly.</p>
            </button>
            <button
              type="button"
              onClick={() => setChoice("placement")}
              className="rounded-xl border border-border bg-background p-6 text-start transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ClipboardList className="h-6 w-6 text-accent" aria-hidden />
              <p className="mt-3 font-semibold">Take the placement test</p>
              <p className="mt-1 text-sm text-muted-foreground">16 quick questions. We suggest the right level transparently.</p>
            </button>

            {choice === "placement" && (
              <div className="space-y-5 sm:col-span-2">
                {PLACEMENT_QUESTIONS.map((q, qi) => (
                  <fieldset key={q.id} className="rounded-lg border border-border bg-background p-4">
                    <legend className="px-1 text-sm font-medium">{qi + 1}. {q.prompt} <Badge variant="muted" className="ms-1">{q.levelProbe}</Badge></legend>
                    <RadioGroup
                      value={answers[q.id]?.toString()}
                      onValueChange={(v: string) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      {q.options.map((opt, oi) => (
                        <Label key={oi} className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-normal hover:bg-muted has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                          <RadioGroupItem value={oi.toString()} /> {opt}
                        </Label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                ))}
                <div className="flex justify-end">
                  <Button onClick={() => setStep(3)} disabled={Object.keys(answers).length < PLACEMENT_QUESTIONS.length}>
                    Continue <ArrowRight className="rtl:rotate-180" aria-hidden />
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
            <CardTitle>You are ready to start</CardTitle>
            <CardDescription>
              {suggestedLevel
                ? `Based on ${choice === "placement" ? "your test result" : "your choice"}, we suggest starting at ${suggestedLevel}. Your teacher can fine-tune this during live lessons.`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(choice === "placement" ? 2 : 1)}>
              <ArrowLeft className="rtl:rotate-180" aria-hidden /> Back
            </Button>
            <Button size="lg" onClick={finish} disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              Start my learning path
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
