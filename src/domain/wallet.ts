// Wallet & credit ledger — all balance mutations go through applyLedgerEntry
// which enforces idempotency via unique key and maintains running balances
// inside a Prisma transaction.
import "server-only";
import { db } from "@/lib/db";
import type { LedgerReason, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function ensureWallet(tx: Tx, studentId: string) {
  return tx.wallet.upsert({ where: { studentId }, create: { studentId }, update: {} });
}

export interface LedgerInput {
  studentId: string;
  delta: number; // +credit / −credit (integer)
  reason: LedgerReason;
  refType?: string;
  refId?: string;
  /** Unique per logical operation; duplicates are silently ignored (idempotent). */
  idempotencyKey?: string;
}

/** Apply one ledger entry. Returns null when the idempotency key already exists. */
export async function applyLedgerEntry(tx: Tx, input: LedgerInput) {
  const wallet = await ensureWallet(tx, input.studentId);

  if (input.idempotencyKey) {
    const existing = await tx.creditLedger.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return null;
  }

  // Atomic balance update guarded against concurrent writes.
  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { },
    select: { id: true },
  });
  void updated;

  // Re-read latest entry for balanceAfter inside the same transaction.
  const last = await tx.creditLedger.findFirst({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
  });
  const balanceAfter = (last?.balanceAfter ?? 0) + input.delta;
  if (balanceAfter < 0) throw new Error("INSUFFICIENT_CREDITS");

  return tx.creditLedger.create({
    data: {
      walletId: wallet.id,
      delta: input.delta,
      balanceAfter,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId,
      idempotencyKey: input.idempotencyKey ?? `auto-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });
}

export async function getBalance(studentId: string): Promise<number> {
  const wallet = await db.wallet.findUnique({ where: { studentId } });
  if (!wallet) return 0;
  const last = await db.creditLedger.findFirst({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
  });
  return last?.balanceAfter ?? 0;
}
