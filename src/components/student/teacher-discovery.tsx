"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, CalendarPlus, Clock3, GraduationCap, Heart, Loader2,
  Search, Star, Users2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/ui/avatar";
import { cn, formatPrice } from "@/lib/utils";
import type { MatchCandidate } from "@/domain/matching";
import { bookLesson, toggleFavorite, joinWaitingQueue } from "@/app/actions/booking";

const RANK_LABELS: Record<string, string> = {
  JUNIOR: "Junior", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced", SENIOR: "Senior", EXPERT: "Expert",
};

export interface TeacherCardData extends MatchCandidate {
  teachesCurrentLevel: boolean;
}

export function TeacherDiscovery({
  teachers,
  lessonContext,
  favoritesFirstDefault = true,
}: {
  teachers: TeacherCardData[];
  lessonContext: { id: string; titleDe: string; level: string } | null;
  favoritesFirstDefault?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [minRating, setMinRating] = useState("0");
  const [language, setLanguage] = useState("all");
  const [favoritesFirst, setFavoritesFirst] = useState(favoritesFirstDefault);
  const [profileTeacher, setProfileTeacher] = useState<TeacherCardData | null>(null);
  const [bookingTeacher, setBookingTeacher] = useState<{ t: TeacherCardData; mode: "INSTANT" | "SCHEDULED" } | null>(null);
  const [pending, start] = useTransition();
  const [queueJoined, setQueueJoined] = useState(false);

  const languages = useMemo(() => [...new Set(teachers.flatMap((t) => t.languages))].sort(), [teachers]);

  const visible = useMemo(() => {
    let list = [...teachers];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((t) => `${t.name} ${t.headline} ${t.specialties.join(" ")}`.toLowerCase().includes(q));
    }
    if (onlineOnly) list = list.filter((t) => t.isOnline);
    if (minRating !== "0") list = list.filter((t) => t.avgRating >= Number(minRating));
    if (language !== "all") list = list.filter((t) => t.languages.includes(language));
    list.sort((a, b) => {
      if (favoritesFirst && a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return b.avgRating * 40 + b.qualityScore * 0.5 - (a.avgRating * 40 + a.qualityScore * 0.5);
    });
    return list;
  }, [teachers, query, onlineOnly, minRating, language, favoritesFirst]);

  function confirmBooking() {
    if (!bookingTeacher) return;
    const { t, mode } = bookingTeacher;
    start(async () => {
      const res = await bookLesson({ teacherId: t.userId, lessonId: lessonContext?.id ?? "", mode });
      if (res.ok && res.data?.bookingId) {
        router.push(`/student/classroom/${res.data.bookingId}`);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, Schwerpunkt suchen…" className="ps-9" aria-label="Lehrkräfte durchsuchen" />
        </div>
        <Select value={minRating} onValueChange={setMinRating}>
          <SelectTrigger className="w-[150px]" aria-label="Minimum rating">
            <Star className="h-3.5 w-3.5 text-accent" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Beliebige Bewertung</SelectItem>
            <SelectItem value="4">4.0+</SelectItem>
            <SelectItem value="4.5">4.5+</SelectItem>
            <SelectItem value="4.8">4.8+</SelectItem>
          </SelectContent>
        </Select>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[170px]" aria-label="Language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Jegliche Sprache</SelectItem>
            {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setOnlineOnly((v) => !v)}
          aria-pressed={onlineOnly}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            onlineOnly ? "border-success bg-success/10 text-success" : "border-input bg-card hover:bg-muted"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", onlineOnly ? "bg-success" : "bg-muted-foreground")} aria-hidden />
          Nur online
        </button>
        <button
          type="button"
          onClick={() => setFavoritesFirst((v) => !v)}
          aria-pressed={favoritesFirst}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            favoritesFirst ? "border-accent bg-accent/10 text-accent-foreground" : "border-input bg-card hover:bg-muted"
          )}
        >
          <Heart className={cn("h-4 w-4", favoritesFirst && "fill-current")} aria-hidden />
          Favoriten zuerst
        </button>
      </div>

      {lessonContext && (
        <p className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm">
          Passende Lehrkräfte für deine nächste Lektion: <strong>{lessonContext.titleDe}</strong> ({lessonContext.level}) – nur qualifizierte Lehrkräfte werden angezeigt.
        </p>
      )}

      {/* Teacher cards */}
      {visible.length === 0 ? (
        <EmptyQueue
          joined={queueJoined}
          onJoin={() =>
            start(async () => {
              await joinWaitingQueue("");
              setQueueJoined(true);
            })
          }
          pending={pending}
          hasFilters={!!query || onlineOnly || minRating !== "0" || language !== "all"}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <li key={t.teacherId}>
              <Card className={cn("group h-full transition-shadow hover:shadow-lg", t.isOnline && "border-success/30")}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="relative shrink-0">
                      <UserAvatar name={t.name} color={t.avatarColor} className="h-12 w-12 text-sm" />
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                          t.isOnline ? "bg-success" : "bg-muted-foreground/40"
                        )}
                        aria-label={t.isOnline ? "Online now" : "Offline"}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => setProfileTeacher(t)} className="truncate text-start font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                          {t.name}
                        </button>
                        <FavoriteButton teacherId={t.userId} initial={!!t.isFavorite} />
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                        {RANK_LABELS[t.rank]} · {t.certification.split("·")[0]?.trim()}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.headline}</p>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/70 px-2 py-1.5">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Bewertung</dt>
                      <dd className="text-sm font-semibold flex items-center justify-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" aria-hidden />{t.avgRating.toFixed(1)}</dd>
                    </div>
                    <div className="rounded-md bg-muted/70 px-2 py-1.5">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Einheiten</dt>
                      <dd className="text-sm font-semibold">{t.completedLessons.toLocaleString()}</dd>
                    </div>
                    <div className="rounded-md bg-muted/70 px-2 py-1.5">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Antwortzeit</dt>
                      <dd className="flex items-center justify-center gap-1 text-sm font-semibold"><Clock3 className="h-3 w-3" aria-hidden />{t.responseTimeMinutes}m</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.specialties.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{formatPrice(t.hourlyRateCents)}<span className="text-xs font-normal text-muted-foreground"> / 50 Min.</span></p>
                      <p className={cn("text-xs font-medium", t.isOnline ? "text-success" : "text-muted-foreground")}>
                        {t.isOnline ? "Jetzt verfügbar" : "Offline – stattdessen planen"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setBookingTeacher({ t, mode: "SCHEDULED" })}>
                        <CalendarPlus aria-hidden />
                        <span className="hidden sm:inline">Planen</span>
                      </Button>
                      <Button
                        size="sm"
                        disabled={!t.isOnline || !lessonContext}
                        title={!lessonContext ? "Complete onboarding first" : undefined}
                        onClick={() => setBookingTeacher({ t, mode: "INSTANT" })}
                      >
                        <Zap aria-hidden /> Instant
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Profile drawer */}
      <Dialog open={!!profileTeacher} onOpenChange={(open) => !open && setProfileTeacher(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {profileTeacher && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 pe-6">
                  <UserAvatar name={profileTeacher.name} color={profileTeacher.avatarColor} className="h-14 w-14 text-base" />
                  <div>
                    <DialogTitle className="text-left">{profileTeacher.name}</DialogTitle>
                    <DialogDescription className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                      {RANK_LABELS[profileTeacher.rank]} · {profileTeacher.certification}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <p className="text-sm leading-relaxed">{profileTeacher.headline}. {profileTeacher.bio}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Bewertung" value={`${profileTeacher.avgRating.toFixed(1)} ★`} sub={`${profileTeacher.ratingCount} Bewertungen`} />
                <Stat label="Einheiten" value={profileTeacher.completedLessons.toLocaleString()} />
                <Stat label="Qualitätspunktzahl" value={`${profileTeacher.qualityScore}/100`} sub={qualityLabel(profileTeacher.qualityScore)} />
              </div>
              <div className="space-y-1.5 text-sm">
                <p><span className="font-medium">Sprachen:</span> {profileTeacher.languages.join(", ")}</p>
                <p><span className="font-medium">Schwerpunkte:</span> {profileTeacher.specialties.join(", ")}</p>
                <p><span className="font-medium">Antwortzeit:</span> ~{profileTeacher.responseTimeMinutes} Minuten</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                Bewertungen heben strukturierte Stunden und klare Erklärungen hervor. Detaillierte Bewertungen siehst du nach eigenen Stunden mit dieser Lehrkraft.
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking confirmation */}
      <Dialog open={!!bookingTeacher} onOpenChange={(open) => !open && setBookingTeacher(null)}>
        <DialogContent>
          {bookingTeacher && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {bookingTeacher.mode === "INSTANT" ? "Sofort Unterricht starten?" : "Unterrichtsstunde bestätigen"}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="pt-2 text-sm leading-relaxed">
                    <p><strong>{lessonContext?.titleDe ?? "Your current lesson"}</strong> · 50 min with <strong>{bookingTeacher.t.name}</strong>.</p>
                    <p className="mt-2">Price: <strong>{formatPrice(bookingTeacher.t.hourlyRateCents)}</strong> (1 Unterrichtsguthaben).</p>
                    <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs">
                      Kostenlose Stornierung bis 24 Std. vor Beginn; später verliert man ein Unterrichtsguthaben.
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setBookingTeacher(null)}>Abbrechen</Button>
                <Button disabled={pending} onClick={confirmBooking}>
                  {pending && <Loader2 className="animate-spin" aria-hidden />}
                  {bookingTeacher.mode === "INSTANT" ? "Unterricht starten" : "Buchen (1 Guthaben)"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {!visible.some((t) => t.isOnline) && visible.length > 0 && (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          No compatible teacher is online right now — favorites and offline teachers below accept scheduled lessons.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function qualityLabel(score: number): string {
  if (score >= 80) return "Gute Qualität";
  if (score >= 70) return "Warnung";
  if (score >= 60) return "In Prüfung";
  return "Gesperrt";
}

function FavoriteButton({ teacherId, initial }: { teacherId: string; initial: boolean }) {
  const [fav, setFav] = useState(initial);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={fav}
      onClick={() =>
        start(async () => {
          const res = await toggleFavorite(teacherId);
          if (res.ok && res.data) setFav(res.data.favorite);
        })
      }
      className={cn("rounded-full p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", fav ? "text-destructive" : "text-muted-foreground hover:text-foreground")}
    >
      <Heart className={cn("h-4 w-4", fav && "fill-current")} aria-hidden />
    </button>
  );
}

function EmptyQueue({ joined, onJoin, pending, hasFilters }: { joined: boolean; onJoin: () => void; pending: boolean; hasFilters: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        <Users2 className="h-10 w-10 text-muted-foreground/50" aria-hidden />
        <h3 className="mt-4 font-semibold">
          {hasFilters ? "Keine Lehrkraft passt zu den Filtern" : "Gerade ist keine passende Lehrkraft online"}
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {hasFilters
            ? "Entferne ein paar Filter, um mehr Lehrkräfte zu sehen."
            : "Trag dich in die Warteschlange ein – wir benachrichtigen dich, sobald eine qualifizierte Lehrkraft online geht. Oder plane eine Stunde für später."}
        </p>
        {!hasFilters && (
          <Button className="mt-5" variant="accent" disabled={joined || pending} onClick={onJoin}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {joined ? "Wir melden uns, sobald eine Lehrkraft verfügbar ist" : "Mich benachrichtigen"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
