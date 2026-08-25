import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokeCertificate } from "@/app/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const session = await requireRole("ACADEMIC_ADMIN", "SUPER_ADMIN");
  const certificates = await db.certificate.findMany({
    orderBy: { issuedAt: "desc" },
    include: { student: { select: { name: true } }, level: { select: { code: true, title: true } } },
  });
  const canRevoke = session.role === "ACADEMIC_ADMIN" || session.role === "SUPER_ADMIN";

  return (
    <div className="container max-w-4xl space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-issued level completion certificates. Revocations are audited.</p>
      </header>

      <ul className="space-y-2.5">
        {certificates.map((cert) => (
          <li key={cert.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <BadgeCheck className={`h-6 w-6 shrink-0 ${cert.status === "VALID" ? "text-success" : cert.status === "REVOKED" ? "text-destructive" : "text-muted-foreground"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{cert.student.name} — {cert.level.code}</p>
                  <p className="font-mono text-xs text-muted-foreground">{cert.serial} · score {cert.score}% · issued {formatDate(cert.issuedAt)}</p>
                  {cert.revokedReason && <p className="mt-0.5 text-xs text-destructive">Revoked: {cert.revokedReason}</p>}
                </div>
                <Badge variant={cert.status === "VALID" ? "success" : cert.status === "REVOKED" ? "destructive" : "muted"}>{cert.status.toLowerCase()}</Badge>
                <Button size="sm" variant="outline" asChild><Link href={`/verify/${cert.serial}`}>Verify</Link></Button>
                {canRevoke && cert.status === "VALID" && (
                  <form
                    action={async (fd: FormData) => {
                      "use server";
                      const reason = String(fd.get("reason") ?? "").trim();
                      if (reason.length >= 10) await revokeCertificate(cert.id, reason);
                    }}
                    className="flex w-full items-end gap-2 sm:w-auto"
                  >
                    <input
                      name="reason"
                      required
                      minLength={10}
                      placeholder="Revocation reason…"
                      aria-label={`Reason for revoking ${cert.serial}`}
                      className="h-9 flex-1 rounded-md border border-input bg-card px-3 text-sm sm:w-56"
                    />
                    {/* Confirmation comes from the browser dialog; the action is audited. */}
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!window.confirm("Revoking a certificate is irreversible and will be written to the audit log. Continue?")) {
                          e.preventDefault();
                        }
                      }}
                      className="h-9 shrink-0 rounded-md bg-destructive px-3 text-sm font-medium text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Revoke
                    </button>
                  </form>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
        {certificates.length === 0 && (
          <li><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No certificates issued yet.</CardContent></Card></li>
        )}
      </ul>
    </div>
  );
}
