import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireRole("STUDENT");
  const [profile, prefs] = await Promise.all([
    db.studentProfile.findUnique({ where: { userId: session.userId } }),
    db.notificationPreference.findUnique({ where: { userId: session.userId } }),
  ]);

  return (
    <div className="container max-w-2xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Account and notification preferences.</p>
      </header>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input defaultValue={session.name} readOnly aria-readonly />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input defaultValue={session.email} readOnly aria-readonly />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input defaultValue={profile?.country ?? "—"} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label>Learning goal</Label>
            <Input defaultValue={profile?.learningGoal ?? "—"} readOnly />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Profile editing is available through onboarding retakes in this MVP.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Choose what you want to hear about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["Lesson reminders", prefs?.lessonReminders],
            ["Feedback alerts", prefs?.feedbackAlerts],
            ["Email notifications", prefs?.emailEnabled],
            ["Push notifications", prefs?.pushEnabled],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <Label htmlFor={`pref-${label}`} className="font-normal">{label as string}</Label>
              <Switch id={`pref-${label}`} defaultChecked={!!value} disabled aria-readonly />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Notification preferences are read-only in the demo build.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm font-medium">Interface language</p>
            <p className="text-xs text-muted-foreground">Switch between English and Arabic (RTL) via the globe button.</p>
          </div>
          <Badge variant="secondary">{session.role}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
