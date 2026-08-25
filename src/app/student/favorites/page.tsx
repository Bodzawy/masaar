import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Heart, Star, Clock3, Zap, CalendarPlus } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { TeacherRankKey } from "@/config/domain";

export const metadata = { title: "Favorite Teachers" };

export default async function FavoritesPage() {
  const session = await requireRole("STUDENT");
  const favorites = await db.favoriteTeacher.findMany({
    where: { studentId: session.userId },
    include: {
      teacher: {
        include: {
          teacherProfile: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Favorite Teachers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Favorites who are online appear first in Find a Teacher.</p>
      </header>

      {favorites.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center p-10 text-center">
          <Heart className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="mt-3 font-medium">No favorites yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any teacher card to save them here.</p>
          <Button size="sm" className="mt-4" asChild><Link href="/student/teachers">Browse teachers</Link></Button>
        </CardContent></Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {favorites.map(({ teacher }) => {
            const p = teacher.teacherProfile!;
            return (
              <li key={teacher.id}>
                <Card>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="relative shrink-0">
                      <UserAvatar name={teacher.name} color={teacher.avatarColor} />
                      <span className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card ${p.isOnline ? "bg-success" : "bg-muted-foreground/40"}`} aria-label={p.isOnline ? "Online" : "Offline"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{teacher.name}</p>
                      <p className="text-xs text-muted-foreground">{p.headline.slice(0, 60)}…</p>
                      <p className="mt-1 flex items-center gap-2 text-xs">
                        <Star className="h-3 w-3 fill-accent text-accent" aria-hidden /> {((p.qualityScore / 20) || 4.5).toFixed(1)}
                        · <Clock3 className="h-3 w-3" aria-hidden />{p.responseTimeMinutes}m
                        <Badge variant="outline">{p.rank as TeacherRankKey}</Badge>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Prices start at {formatPrice(1900)} per lesson.</p>
    </div>
  );
}
