// Certificates — serial generation + verification hash.
// Platform-issued level completion certificates (see CERTIFICATE_RULES wording).
import "server-only";
import { createHash, randomInt } from "node:crypto";

export function generateSerial(): string {
  return `CERT-${randomInt(100000, 999999)}`;
}

export function generateCaseId(prefix = "RPT"): string {
  return `${prefix}-${randomInt(10000, 99999)}`;
}

/** Deterministic public verification hash: SHA-256(serial|student|level|score). */
export function verificationHash(serial: string, studentName: string, level: string, score: number): string {
  return createHash("sha256").update(`${serial}|${studentName}|${level}|${score}`).digest("hex").slice(0, 32);
}
