import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { BOOKING_RULES } from "@/config/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Clock3, Landmark } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata = { title: "Verdienst" };

export default async function EarningsPage() {
  const session = await requireRole("TEACHER");
  const [completedBookings, payouts] = await Promise.all([
    db.booking.findMany({ where: { teacherId: session.userId, status: "COMPLETED" }, orderBy: { scheduledAt: "desc" } }),
    db.teacherPayout.findMany({ where: { teacherId: session.userId }, orderBy: { createdAt: "desc" } }),
  ]);

  // Demo split: teacher earns 70% of the lesson price.
  const TEACHER_SHARE = 0.7;
  const lifetimeCents = Math.round(completedBookings.reduce((n, b) => n + b.priceCents, 0) * TEACHER_SHARE);
  const pendingPayoutsCents = payouts.filter((p) => p.status === "PENDING").reduce((n, p) => n + p.amountCents, 0);
  const paidOutCents = payouts.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amountCents, 0);
  const availableCents = Math.max(0, lifetimeCents - pendingPayoutsCents - paidOutCents);

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Verdienst</h1>
        <p className="mt-1 text-sm text-muted-foreground">{BOOKING_RULES.currency} · demo payout schedule: monthly.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Wallet className="h-3.5 w-3.5" aria-hidden /> Jetzt verfügbar</p>
          <p className="mt-1.5 text-2xl font-semibold">{formatPrice(availableCents)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden /> In Klärung</p>
          <p className="mt-1.5 text-2xl font-semibold">{formatPrice(pendingPayoutsCents)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Landmark className="h-3.5 w-3.5" aria-hidden /> Gesamtverdienst</p>
          <p className="mt-1.5 text-2xl font-semibold">{formatPrice(lifetimeCents)}</p>
          <p className="text-xs text-muted-foreground">{completedBookings.length} abgeschlossene Einheiten</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Auszahlungen</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 odd:bg-muted/60">
                <span className="text-xs text-muted-foreground">{formatDate(p.periodStart)} – {formatDate(p.periodEnd)}</span>
                <span className="ms-auto font-medium tabular-nums">{formatPrice(p.amountCents)}</span>
                <Badge variant={p.status === "PAID" ? "success" : p.status === "REJECTED" ? "destructive" : "warning"}>{p.status.toLowerCase()}</Badge>
              </li>
            ))}
            {payouts.length === 0 && <li className="text-xs text-muted-foreground">Noch keine Auszahlungen.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
