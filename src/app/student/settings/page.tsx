import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const session = await requireRole("STUDENT");
  const [profile, prefs] = await Promise.all([
    db.studentProfile.findUnique({ where: { userId: session.userId } }),
    db.notificationPreference.findUnique({ where: { userId: session.userId } }),
  ]);

  return (
    <div className="container max-w-2xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Konto- und Benachrichtigungseinstellungen.</p>
      </header>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Konto</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input defaultValue={session.name} readOnly aria-readonly />
          </div>
          <div className="space-y-1.5">
            <Label>E-Mail</Label>
            <Input defaultValue={session.email} readOnly aria-readonly />
          </div>
          <div className="space-y-1.5">
            <Label>Land</Label>
            <Input defaultValue={profile?.country ?? "—"} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label>Lernziel</Label>
            <Input defaultValue={profile?.learningGoal ?? "—"} readOnly />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Profilbearbeitung erfolgt in dieser Version über das Onboarding.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Benachrichtigungen</CardTitle>
          <CardDescription>Lege fest, worüber du informiert werden möchtest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["Stunden-Erinnerungen", prefs?.lessonReminders],
            ["Feedback-Hinweise", prefs?.feedbackAlerts],
            ["E-Mail-Benachrichtigungen", prefs?.emailEnabled],
            ["Push-Benachrichtigungen", prefs?.pushEnabled],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <Label htmlFor={`pref-${label}`} className="font-normal">{label as string}</Label>
              <Switch id={`pref-${label}`} defaultChecked={!!value} disabled aria-readonly />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Benachrichtigungseinstellungen sind in der Demo schreibgeschützt.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-medium">Oberflächensprache</p>
            <p className="text-xs text-muted-foreground">Wechsle über den Globus zwischen Deutsch und Englisch.</p>
          </div>
          <Badge variant="secondary">{session.role}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
