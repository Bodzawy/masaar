import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Settings" };

export default async function TeacherSettingsPage() {
  const session = await requireRole("TEACHER");
  const profile = await db.teacherProfile.findUnique({ where: { userId: session.userId } });
  if (!profile) return null;

  return (
    <div className="container max-w-2xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Teaching profile details.</p>
      </header>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Rank</Label><div><Badge variant="default">{profile.rank}</Badge></div></div>
          <div className="space-y-1.5"><Label>Certification</Label><Input defaultValue={profile.certification} readOnly /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Headline</Label><Input defaultValue={profile.headline} readOnly /></div>
          <div className="space-y-1.5"><Label>Languages</Label><Input defaultValue={profile.languages.join(", ")} readOnly /></div>
          <div className="space-y-1.5"><Label>Specialties</Label><Input defaultValue={profile.specialties.join(", ")} readOnly /></div>
          <div className="space-y-1.5"><Label>Hourly rate</Label><Input defaultValue={`${(profile.hourlyRateCents / 100).toFixed(2)} EUR`} readOnly /></div>
          <div className="space-y-1.5"><Label>Response time</Label><Input defaultValue={`~${profile.responseTimeMinutes} min`} readOnly /></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Profile changes go through Teacher Manager review in production.</p>
        </CardContent>
      </Card>
    </div>
  );
}
