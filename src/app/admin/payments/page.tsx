import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPrice } from "@/lib/utils";

export const metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireRole("FINANCE_ADMIN", "SUPER_ADMIN");
  const [payments, payouts] = await Promise.all([
    db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { student: { select: { name: true } } } }),
    db.teacherPayout.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { teacher: { select: { name: true } } } }),
  ]);

  const revenueCents = payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amountCents, 0);

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Student payments and teacher payouts (demo provider).</p>
        </div>
        <p className="text-sm"><span className="font-semibold tabular-nums">{formatPrice(revenueCents)}</span> <span className="text-muted-foreground">collected all-time</span></p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Student payments</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {payments.map((pay) => (
                <li key={pay.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 odd:bg-muted/60">
                  <span className="min-w-0 flex-1 truncate">{pay.student.name} — {pay.description}</span>
                  <Badge variant={pay.status === "PAID" ? "success" : pay.status === "REFUNDED" ? "muted" : pay.status === "FAILED" ? "destructive" : "warning"}>{pay.status.toLowerCase()}</Badge>
                  <span className="w-16 text-end tabular-nums">{formatPrice(pay.amountCents)}</span>
                  <span className="hidden w-20 text-end text-xs text-muted-foreground sm:block">{formatDate(pay.createdAt)}</span>
                </li>
              ))}
              {payments.length === 0 && <li className="text-xs text-muted-foreground">No payments.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Teacher payouts</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {payouts.map((payout) => (
                <li key={payout.id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 odd:bg-muted/60">
                  <span className="min-w-0 flex-1 truncate">{payout.teacher.name}</span>
                  <Badge variant={payout.status === "PAID" ? "success" : payout.status === "REJECTED" ? "destructive" : "warning"}>{payout.status.toLowerCase()}</Badge>
                  <span className="w-16 text-end tabular-nums">{formatPrice(payout.amountCents)}</span>
                </li>
              ))}
              {payouts.length === 0 && <li className="text-xs text-muted-foreground">No payouts.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
