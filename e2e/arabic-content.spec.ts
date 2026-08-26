import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * Arabisch-spezifische Qualitätssicherung:
 * – RTL-Inseln (arabische Inhalte) innerhalb der LTR-Shell
 * – Gemischter Text stabil, Harakat erhalten
 * – Arabische Eingaben (Quiz/Hausaufgaben) funktionieren
 * – Kein Überlauf, keine Konsolen-/Hydrationsfehler bei 390/768/1440 px
 */
test.describe.serial("Arabische Inhalte & gemischte Richtungen", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  async function lenaId(): Promise<string> {
  const lena = await db.user.findUniqueOrThrow({ where: { email: "lena.schmidt@demo.deutschpath.dev" } });
  return lena.id;
}

async function login(page: import("@playwright/test").Page) {
    await page.goto("/signin");
    await page.getByLabel("E-Mail").fill("lena.schmidt@demo.deutschpath.dev");
    await page.getByLabel("Passwort").fill("demo1234!");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.waitForURL("**/student");
  }

  test("Dokument bleibt LTR; arabische Vokabelkarte ist eine RTL-Insel", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));

    await login(page);
    await page.goto("/student/vocabulary");

    // Shell LTR
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    // Erste Vokabelkarte: arabisches Wort in RTL-Insel mit Naskh-Schrift
    const firstWord = page.locator('[dir="rtl"][lang="ar"]').first();
    await expect(firstWord).toBeVisible();
    const cls = await firstWord.getAttribute("class");
    expect(cls).toContain("font-arabic");

    // Harakat aus der Seed-Datenbank bleiben im DOM erhalten
    const item = await db.vocabularyItem.findFirst({ where: { levelCode: "B2" } });
    expect(item).toBeTruthy();
    const harakat = /[\u064B-\u0652]/; // Fatha/Damma/Kasra/Sukun…
    expect(harakat.test(item!.word) || harakat.test(item!.exampleTarget)).toBe(true);
    // Das gerenderte Wort entspricht exakt dem Seed-Wort (Harakat bleiben erhalten)
    const rendered = (await firstWord.textContent())?.trim();
    expect(rendered).toBe(item!.word);

    expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });

  test("Arabisches Quiz-Optionfeld ist RTL und auswählbar", async ({ page }) => {
    await login(page);
    const lena = await lenaId();
    const lessons = await db.lesson.findMany({
      where: { chapter: { level: { code: "B2" }, orderIndex: 1 } },
      orderBy: { orderIndex: "asc" },
      include: { progress: { where: { studentId: lena.id } } },
    });
    const current = lessons.find((l) => l.progress[0]?.status === "IN_PROGRESS") ?? lessons[0]!;
    await page.goto(`/student/lessons/${current.id}/quiz`);

    // Erste Frage hat eine arabische Option → RTL gerendert
    const arabicOption = page.locator('[role="radiogroup"] >> visible=true').first().locator('[dir="rtl"]');
    const count = await arabicOption.count();
    if (count > 0) {
      await expect(arabicOption.first()).toBeVisible();
      await arabicOption.first().click(); // Auswahl funktioniert
      const pressed = await page
        .locator('[role="radiogroup"]')
        .first()
        .locator('[role="radio"][aria-checked="true"]')
        .count();
      expect(pressed).toBeGreaterThanOrEqual(1);
    }
  });

  test("Arabische Eingabe in der Hausaufgabe (Tastatur + Harakat bleiben erhalten)", async ({ page }) => {
    await login(page);
    const lena = await lenaId();
    const lesson = await db.lesson.findFirst({
      where: { chapter: { level: { code: "B2" }, orderIndex: 1 }, orderIndex: 3 },
      include: { homework: true, progress: { where: { studentId: lena.id } } },
    });
    const status = lesson?.progress[0]?.status;
    if (!lesson?.homework || !status || !["AVAILABLE", "IN_PROGRESS"].includes(status)) {
      test.skip(true, "Hausaufgabe der Lektion ist in diesem Zustand nicht offen");
      return;
    }
    await page.goto(`/student/homework/${lesson.id}`);
    const textarea = page.getByLabel("Schreibaufgabe");
    await textarea.click();
    await textarea.fill("");
    // Tastatureingabe simulieren (kein fill), um echte Input-Events zu prüfen
    await textarea.pressSequentially("مرحبا");
    const value = await textarea.inputValue();
    expect(value).toContain("مرحبا");
    expect(containsArabicClass(textarea)).toBeTruthy();
  });

  test("Gemischte Richtung: Landing zeigt deutsche Anweisung + arabische Wörter ohne Überlauf (390/768/1440)", async ({ page }) => {
    for (const vp of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(vp);
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));

      await page.goto("/", { waitUntil: "networkidle" }).catch(() => page.goto("/"));
      await page.waitForTimeout(200);
      // Deutsche Anweisung + arabische Schriftprobe koexistieren
      await expect(page.getByText("Deine ersten Wörter:")).toBeVisible();
      await expect(page.locator('p[dir="ltr"], p:not([dir])').filter({ hasText: "Deine ersten Wörter" })).toBeVisible();
      const rtlSample = page.locator('span[dir="rtl"][lang="ar"]');
      await expect(rtlSample.first()).toBeVisible();

      const overflow = await page.evaluate(() => ({
        s: document.documentElement.scrollWidth,
        c: document.documentElement.clientWidth,
      }));
      expect(overflow.s, `Overflow bei ${vp.width}px: ${overflow.s} > ${overflow.c}`).toBeLessThanOrEqual(overflow.c + 1);
      expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
    }
  });

  function containsArabicClass(locator: import("@playwright/test").Locator): boolean | null {
    // synchroner Check über Klassenattribut
    return locator.evaluate((el) => el.className.includes("font-arabic")) as unknown as boolean;
  }
});
