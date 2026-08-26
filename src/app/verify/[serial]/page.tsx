import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { brand } from "@/config/brand";
import { CERTIFICATE_RULES } from "@/config/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldX, Award } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificate verification" };

// Public verification route — no auth required, only non-sensitive data shown.
export default async function VerifyCertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const cert = await db.certificate.findUnique({
    where: { serial: decodeURIComponent(serial) },
    include: { student: true, level: true },
  });
  if (!cert) notFound();

  const valid = cert.status === "VALID" && (!cert.expiresAt || cert.expiresAt > new Date());
  const verifyUrl = `${brand.url}/verify/${cert.serial}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160, color: { dark: "#312E81" } });

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-5">
        <div className="text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">D</span>
          <p className="mt-2 text-sm text-muted-foreground">{brand.name} – öffentliche Zertifikatverifizierung</p>
        </div>

        <Card className={valid ? "" : "border-destructive/40"}>
          <CardContent className="p-7">
            <div className="flex items-center gap-3">
              {valid ? (
                <>
                  <ShieldCheck className="h-9 w-9 shrink-0 text-success" aria-hidden />
                  <Badge variant="success" className="uppercase tracking-wide">{cert.status}</Badge>
                </>
              ) : (
                <>
                  <ShieldX className="h-9 w-9 shrink-0 text-destructive" aria-hidden />
                  <Badge variant="destructive" className="uppercase tracking-wide">
                    {cert.status === "REVOKED" ? `Widerrufen${cert.revokedAt ? ` am ${formatDate(cert.revokedAt)}` : ""}` : "Abgelaufen"}
                  </Badge>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
              <dl className="min-w-0 flex-1 space-y-3.5 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ausgestellt für</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{cert.student.name}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Abgeschlossenes Niveau</dt>
                  <dd className="mt-0.5 flex items-center gap-2 font-medium">
                    <Award className="h-4 w-4 text-accent" aria-hidden />
                    {cert.level.code} · {cert.level.title}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ergebnis</dt>
                    <dd className="font-semibold tabular-nums">{cert.score}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Ausgestellt</dt>
                    <dd className="font-medium">{formatDate(cert.issuedAt)}</dd>
                  </div>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Zertifikat-ID</dt>
                  <dd className="font-mono font-medium">{cert.serial}</dd>
                </div>
              </dl>

              {/* QR code */}
              <img
                src={qrDataUrl}
                alt={`QR code linking to ${verifyUrl}`}
                width={140}
                height={140}
                className="rounded-lg border border-border bg-white p-1.5"
              />
            </div>

            <p className="mt-7 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              {CERTIFICATE_RULES.issuerLine}. {CERTIFICATE_RULES.disclaimer}
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" asChild><Link href="/">← Back to {brand.name}</Link></Button>
        </div>
      </div>
    </main>
  );
}
