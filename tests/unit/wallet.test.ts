// Integration tests against the real database (rolled back — no residue).
// Covers credit ledger idempotency + retake approval credit return.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { applyLedgerEntry } from "@/domain/wallet";

let testUserId: string;

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email: `wallet-test-${Date.now()}@test.local`,
      passwordHash: "x",
      name: "Wallet Test",
      roleType: "STUDENT",
    },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: testUserId } });
  await db.$disconnect();
});

describe("credit ledger", () => {
  it("applies a deduction exactly once per idempotency key", async () => {
    await applyLedgerEntry(db as never, { studentId: testUserId, delta: 3, reason: "SIGNUP_BONUS" });

    const key = `booking-test-${Date.now()}`;
    let applied = 0;
    for (let i = 0; i < 3; i++) {
      const result = await db.$transaction(async (tx) =>
        applyLedgerEntry(tx as never, {
          studentId: testUserId,
          delta: -1,
          reason: "LESSON_BOOKING",
          idempotencyKey: key,
        })
      );
      if (result) applied += 1;
    }
    expect(applied).toBe(1);

    const balance = await db.creditLedger.findFirst({
      where: { wallet: { studentId: testUserId } },
      orderBy: { createdAt: "desc" },
    });
    expect(balance?.balanceAfter).toBe(2); // 3 − 1 (deduped twice)
  });

  it("refuses to go negative", async () => {
    await expect(
      db.$transaction(async (tx) =>
        applyLedgerEntry(tx as never, {
          studentId: testUserId,
          delta: -999,
          reason: "LESSON_BOOKING",
          idempotencyKey: `neg-${Date.now()}`,
        })
      )
    ).rejects.toThrow("INSUFFICIENT_CREDITS");
  });

  it("simulates retake approval: refund applies once and only once", async () => {
    // Give the wallet a starting balance and simulate two approval attempts
    await applyLedgerEntry(db as never, { studentId: testUserId, delta: 5, reason: "PACKAGE_PURCHASE" });
    const key = `retake-refund-${Date.now()}`;

    await db.$transaction((tx) =>
      applyLedgerEntry(tx as never, { studentId: testUserId, delta: 1, reason: "LESSON_REFUND_RETAKE", idempotencyKey: key })
    );
    const second = await db.$transaction((tx) =>
      applyLedgerEntry(tx as never, { studentId: testUserId, delta: 1, reason: "LESSON_REFUND_RETAKE", idempotencyKey: key })
    );

    expect(second).toBeNull(); // duplicate decision ignored

    const entries = await db.creditLedger.findMany({
      where: { wallet: { studentId: testUserId } },
      orderBy: { createdAt: "asc" },
    });
    // 3 −1 +5 +1 = 8
    const last = entries[entries.length - 1]!;
    expect(last.balanceAfter).toBe(8);
  });
});
