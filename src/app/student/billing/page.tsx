import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBalance } from "@/domain/wallet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/utils";
import { CreditCard, Wallet, Receipt, Package } from "lucide-react";

export const metadata = { title: "Billing" };

const REASON_LABELS: Record<string, string> = {
  SIGNUP_BONUS: "Welcome bonus",
  PACKAGE_PURCHASE: "Package purchase",
  LESSON_BOOKING: "Lesson booked",
  LESSON_REFUND_RETAKE: "Refund (retake/cancellation)",
  LESSON_REFUND_TEACHER_CANCEL: "Refund (teacher cancelled)",
  ADMIN_ADJUSTMENT: "Support adjustment",
};

export default async function BillingPage() {
  const session = await requireRole("STUDENT");
  const [balance, wallet, subscription, payments, packages] = await Promise.all([
    getBalance(session.userId),
    db.wallet.findUnique({ where: { studentId: session.userId }, include: { entries: { orderBy: { createdAt: "desc" }, take: 20 } } }),
    db.subscription.findFirst({ where: { studentId: session.userId }, orderBy: { periodEnd: "desc" } }),
    db.payment.findMany({ where: { studentId: session.userId }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.package.findMany({ where: { active: true }, orderBy: { priceCents: "asc" } }),
  ]);

  return (
    <div className="container max-w-5xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Subscriptions, lesson credits and payment history.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Wallet className="h-3.5 w-3.5" aria-hidden /> Lesson credits</p>
            <p className="mt-1.5 text-3xl font-semibold">{balance}</p>
            <p className="text-xs text-muted-foreground">1 credit = one 50-min lesson</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><CreditCard className="h-3.5 w-3.5" aria-hidden /> Subscription</p>
            {subscription ? (
              <>
                <p className="mt-1.5 font-semibold">{subscription.planName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(subscription.monthlyPriceCents)}/mo · renews {formatDate(subscription.periodEnd)}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">No active plan</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Receipt className="h-3.5 w-3.5" aria-hidden /> Spent this month</p>
            <p className="mt-1.5 text-3xl font-semibold">{formatPrice(payments.filter((p) => p.status === "PAID").reduce((n, p) => n + p.amountCents, 0))}</p>
            <p className="text-xs text-muted-foreground">{payments.filter((p) => p.status === "PAID").length} payments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Packages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-primary" aria-hidden /> Plans & packages</CardTitle>
            <CardDescription>Purchase flows use the demo payment provider in this build.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground">{pkg.description}</p>
                </div>
                <Badge variant="secondary">{formatPrice(pkg.priceCents)}{pkg.kind === "SUBSCRIPTION" ? "/mo" : ""}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Credit ledger + payments */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Credit ledger</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {(wallet?.entries ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-md px-2 py-1 odd:bg-muted/60">
                    <span className="truncate text-xs">{REASON_LABELS[e.reason] ?? e.reason}</span>
                    <span className={`font-medium tabular-nums ${e.delta > 0 ? "text-success" : "text-destructive"}`}>
                      {e.delta > 0 ? "+" : ""}{e.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {payments.map((pay) => (
                  <li key={pay.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 odd:bg-muted/60">
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {pay.description} · <span className="text-muted-foreground">{formatDate(pay.createdAt)}</span>
                    </span>
                    <Badge variant={pay.status === "PAID" ? "success" : pay.status === "REFUNDED" ? "muted" : "warning"}>{pay.status.toLowerCase()}</Badge>
                    <span className="tabular-nums text-xs font-medium">{formatPrice(pay.amountCents)}</span>
                  </li>
                ))}
                {payments.length === 0 && <li className="text-xs text-muted-foreground">No payments yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
