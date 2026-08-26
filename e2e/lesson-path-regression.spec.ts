import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Regressionstest für den „Lernweg starten“-Bug:
 * Früher blieb der Spinner endlos stehen, weil (a) der RadioGroup-Standardwert
 * „studyPreference“ nie in react-hook-form ankam → stille Validierungsfehler,
 * und (b) die API einen PrismaClientValidationError warf (Spread von
 * `suggestedLevel` in Prisma) und der Client Fehler ignorierte.
 */
test.describe.serial("Regression: Lernweg starten (kein endloses Laden)", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  async function signupFreshStudent(page: import("@playwright/test").Page, name: string) {
    const email = `pathfix${Date.now()}${Math.floor(Math.random() * 1000)}@demo.deutschpath.dev`;
    await page.goto("/signup");
    await page.getByLabel("Vollständiger Name").fill(name);
    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Passwort").fill("demo1234!");
    await page.getByRole("button", { name: /Konto erstellen/ }).click();
    await page.waitForURL("**/onboarding", { timeout: 15_000 });
    return email;
  }

  async function fillWizardStep1(page: import("@playwright/test").Page) {
    await page.locator("#country").fill("Deutschland");
    await page.locator("#nativeLanguage").fill("Deutsch");
    const selects = page.locator("select");
    for (let i = 0; i < (await selects.count()); i++) {
      await selects.nth(i).selectOption({ index: 1 });
    }
    // Alphabet-Frage + Lerntempo (RadioGroups)
    await page.getByText("Nein, noch gar nicht").click();
    await page.getByText("Ausgewogen").click();
  }

  test("Neu registrierte:r Lernende:r ohne Einschreibung/Progress erreicht nach dem Klick das Dashboard", async ({ page }) => {
    test.setTimeout(90_000);
    const consoleErrors: string[] = [];
    const apiCalls: Array<{ url: string; status: number; done: boolean }> = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    page.on("response", async (r) => {
      if (r.url().includes("/api/onboarding")) {
        apiCalls.push({ url: r.url(), status: r.status(), done: true });
      }
    });

    await signupFreshStudent(page, "Path Fix Test");
    await fillWizardStep1(page);
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByText("Wo soll dein Lernweg beginnen?")).toBeVisible({ timeout: 5000 });

    await page.getByText("Bei A1 starten").click();
    await expect(page.getByRole("heading", { name: "Du bist bereit zum Starten" })).toBeVisible();

    // Der kritische Klick – darf NIE endlos laden
    await page.getByRole("button", { name: /Meinen Lernweg starten/ }).click();

    // Navigation muss erfolgen; sonst scheitert der Test mit Timeout
    await page.waitForURL("**/student", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Guten (Morgen|Tag|Abend), Path/ })).toBeVisible({ timeout: 10_000 });

    // Keine fehlgeschlagenen API-Aufrufe
    for (const call of apiCalls) {
      expect(call.status, `API ${call.url} antwortete ${call.status}`).toBeLessThan(400);
    }

    // DB: Einschreibung + erste Lektion AVAILABLE vorhanden (arabischer Kurs A1)
    const user = await db.user.findUniqueOrThrow({
      where: { email: (await currentUserEmail()) },
      include: { studentProfile: true },
    });
    expect(user.studentProfile?.onboardedAt).toBeTruthy();
    const enrollments = await db.enrollment.findMany({ where: { studentId: user.id } });
    expect(enrollments.length).toBeGreaterThanOrEqual(1);
    const a1Level = await db.level.findUniqueOrThrow({ where: { code: "A1" } });
    expect(enrollments.some((e) => e.levelId === a1Level.id)).toBe(true);
    const firstLesson = await db.lesson.findFirst({
      where: { chapter: { levelId: a1Level.id, orderIndex: 1 }, orderIndex: 1 },
    });
    expect(firstLesson).toBeTruthy();
    const progress = await db.lessonProgress.findFirst({
      where: { studentId: user.id, lessonId: firstLesson!.id },
    });
    expect(progress?.status).toBe("AVAILABLE");

    // Kein Konsolen-/Hydrationsfehler
    expect(consoleErrors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });

  test("Serverfehler stoppt die Ladeanzeige mit verständlicher Meldung; Wiederholung ist möglich", async ({ page }) => {
    test.setTimeout(90_000);
    let failNext = true;
    await page.route("**/api/onboarding/complete*", async (route) => {
      if (failNext) {
        failNext = false;
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Simulierter Serverfehler" }) });
      } else {
        await route.continue();
      }
    });

    const email = await signupFreshStudent(page, "Retry Test");
    await fillWizardStep1(page);
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByText("Wo soll dein Lernweg beginnen?")).toBeVisible();
    await page.getByText("Bei A1 starten").click();

    const button = page.getByRole("button", { name: /Meinen Lernweg starten|wird eingerichtet/ });
    await button.click();
    // Fehlermeldung erscheint; Spinner darf nicht ewig bleiben
    await expect(page.getByText(/Simulierter Serverfehler/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Meinen Lernweg starten/ })).toBeEnabled({ timeout: 5_000 });

    // Retry ohne Fehler → Navigation erfolgt
    await page.getByRole("button", { name: /Meinen Lernweg starten/ }).click();
    await page.waitForURL("**/student", { timeout: 20_000 });

    // Und die Daten sind trotzdem korrekt
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { studentProfile: true } });
    expect(user.studentProfile?.onboardedAt).toBeTruthy();
  });

  async function currentUserEmail(): Promise<string> {
    // Hilfsfunktion: neuester frisch registrierter Nutzer
    const users = await db.user.findMany({
      where: { email: { startsWith: "pathfix" } },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    return users[0]!.email;
  }
});
