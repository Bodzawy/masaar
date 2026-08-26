import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Richtige Antworten für das B2·K1·L3-Quiz („Werbung und Konsum“) – Abgleich über Prompt-Teilstring.
const QUIZ_FIXTURE: Array<{ includes: string; answer: string }> = [
  { includes: "die Universitäten", answer: "الْجَامِعَات" },
  { includes: "Buch des Studenten", answer: "الطَّالِبِ" },
  { includes: "(Pl. f.) schreiben", answer: "يَكْتُبْنَ" },
  { includes: "Nominalsatz?", answer: "الْمَدِينَةُ كَبِيرَةٌ" },
  { includes: "weil ich Erfolg will", answer: "لِأَنَّنِي" },
  { includes: "zwei Bücher", answer: "كِتَابَانِ" },
  { includes: "Aktiv oder Passiv", answer: "Passiv („wurde gebaut“)" },
  { includes: "Obwohl die Technologie", answer: "رَغْمَ أَنَّ التِّقْنِيَةَ مُفِيدَة" },
  { includes: "Plural von هَذِهِ وَظِيفَةٌ", answer: "هَٰذِهِ وَظَائِفُ جَدِيدَةٌ" },
  { includes: "Verneinung der Vergangenheit", answer: "لَمْ أَكْتُبِ الرِّسَالَةَ" },
  { includes: "Was bedeutet وَظِيفَة", answer: "Stelle / Aufgabe" },
  { includes: "Gesellschaft / Firma", answer: "شَرِكَة" },
  { includes: "Gegenteil von صَعْب", answer: "سَهْلٌ" },
  { includes: "Zeitung jeden Morgen", answer: "صَحِيفَة" },
  { includes: "Entscheidung treffen", answer: "اَتَّخَذَ قَرَارًا" },
  { includes: "تَخَصَّصَ فِي bedeutet", answer: "sich spezialisieren auf" },
  { includes: "Warum schreibt Muhammad", answer: "Um einen Kurs zu verschieben und eine Bestätigung zu erbitten" },
  { includes: "Bestätigung geschickt werden", answer: "vor Mittwoch" },
  { includes: "Steht NICHT in der Kursbeschreibung", answer: "Ein Pflicht-Einstufungsgespräch" },
  { includes: "Frau Khalil laut Durchsage", answer: "Sie verantwortet internationale Firmen" },
];

async function login(page: import("@playwright/test").Page) {
  await page.goto("/signin");
  await page.getByLabel("E-Mail").fill("lena.schmidt@demo.deutschpath.dev");
  await page.getByLabel("Passwort").fill("demo1234!");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL("**/student");
}

async function lenaId(): Promise<string> {
  const lena = await db.user.findUniqueOrThrow({ where: { email: "lena.schmidt@demo.deutschpath.dev" } });
  return lena.id;
}

async function currentLessonIds() {
  const student = await lenaId();
  const lessons = await db.lesson.findMany({
    where: { chapter: { level: { code: "B2" }, orderIndex: 1 } },
    orderBy: { orderIndex: "asc" },
    include: { progress: { where: { studentId: student } } },
  });
  const current = lessons.find((l) => l.progress[0]?.status === "IN_PROGRESS") ?? lessons[0]!;
  const next = lessons[3]!;
  return { currentId: current.id, nextId: next.id, nextTitle: next.titleDe };
}

test.describe.serial("student happy path (Arabisch lernen)", () => {
  let bookingCountBefore = 0;

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("Anmeldung und Dashboard zeigen die aktuelle Lektion", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/signin");
    await expect(page.getByTestId("demo-account-selector")).toHaveCount(0); // in Produktion versteckt
    await page.getByLabel("E-Mail").fill("lena.schmidt@demo.deutschpath.dev");
    await page.getByLabel("Passwort").fill("demo1234!");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.waitForURL("**/student");
    await expect(page.getByRole("heading", { name: /Guten (Morgen|Tag|Abend), Lena/ })).toBeVisible();
    await expect(page.getByText("الإعلان والاستهلاك").first()).toBeVisible();

    const lena = await db.user.findUniqueOrThrow({ where: { email: "lena.schmidt@demo.deutschpath.dev" } });
    bookingCountBefore = await db.booking.count({ where: { studentId: lena.id } });
    expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });

  test("bucht eine Sofortstunde bei einer qualifizierten online-Lehrkraft", async ({ page }) => {
    await login(page);
    await page.goto("/student/teachers");
    const instantButtons = page.getByRole("button", { name: /Sofort|Instant/ });
    await expect(instantButtons.first()).toBeEnabled();
    await instantButtons.first().click();
    await expect(page.getByText("Sofort Unterricht starten?")).toBeVisible();
    await page.getByRole("button", { name: "Unterricht starten" }).click();
    await page.waitForURL("**/student/classroom/**", { timeout: 20_000 });

    const lena = await db.user.findUniqueOrThrow({ where: { email: "lena.schmidt@demo.deutschpath.dev" } });
    expect(await db.booking.count({ where: { studentId: lena.id } })).toBe(bookingCountBefore + 1);
  });

  test("durchläuft das Demo-Klassenzimmer und bewertet die Lehrkraft", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));

    await login(page);
    await page.goto("/student/schedule");
    await page.getByRole("link", { name: /Klassenzimmer/ }).first().click();
    await page.waitForURL("**/student/classroom/**");
    await expect(page.getByText(/Lokaler Demo-Modus/)).toBeVisible(); // ehrliche Anbieter-Kennzeichnung

    await page.getByRole("button", { name: /Verlassen & bewerten/ }).click();
    await page.waitForURL("**/student/post-lesson/**");

    const groups = page.locator('[role="radiogroup"]');
    await expect(groups).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await groups.nth(i).getByRole("radio").nth(4).click();
    }
    await page.getByRole("button", { name: /Absenden & weiter/ }).click();
    await page.waitForURL("**/quiz**", { timeout: 15_000 });

    const { currentId } = await currentLessonIds();
    const progress = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: await lenaId(), lessonId: currentId } },
    });
    expect(progress.attendanceComplete).toBe(true);
    expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });

  test("besteht das 20-Fragen-Quiz mit arabischen Inhalten (serverseitige Wertung)", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));

    await login(page);
    const { currentId } = await currentLessonIds();
    await page.goto(`/student/lessons/${currentId}/quiz`);

    for (let q = 0; q < 20; q++) {
      const legend = await page.locator("fieldset legend").innerText();
      const fixture = QUIZ_FIXTURE.find((f) => legend.toLowerCase().includes(f.includes.toLowerCase()));
      expect(fixture, `Keine Fixture für: ${legend}`).toBeDefined();
      await page
        .locator('[role="radiogroup"]')
        .first()
        .getByRole("radio", { name: fixture!.answer })
        .click();
      if (q < 19) {
        await page.getByRole("button", { name: /Weiter/ }).click();
      } else {
        await page.getByRole("button", { name: /Quiz absenden/ }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Absenden" }).click();
      }
    }

    await expect(page.getByRole("heading", { name: "Bestanden" })).toBeVisible({ timeout: 20_000 });

    const progress = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: await lenaId(), lessonId: currentId } },
    });
    expect(progress.quizPassed).toBe(true);
    expect(progress.quizBestScore).toBe(100);
    expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
  });

  test("Hausaufgabe einreichen → Lektion abgeschlossen → nächste Lektion freigeschaltet", async ({ page }) => {
    await login(page);
    const { currentId, nextId, nextTitle } = await currentLessonIds();

    await page.goto(`/student/homework/${currentId}`);
    await page.getByLabel("Schreibaufgabe").fill(
      "مرحبًا نادينة،\nأشكرك على عملك الرائع في التقارير. لاحظت أن بعض الأرقام غير مكتملة. هل يمكنك إكمالها قبل الجمعة؟ شكرًا لك!"
    );
    await page.getByRole("button", { name: /Hausaufgabe einreichen/ }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole("button", { name: "Absenden" }).click();
    await expect(page.getByText("Wartet auf Korrektur")).toBeVisible({ timeout: 15_000 });

    // In der Datenbank: Lektion COMPLETED, nächste AVAILABLE
    const done = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: await lenaId(), lessonId: currentId } },
    });
    expect(done.status).toBe("COMPLETED");
    const unlocked = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: await lenaId(), lessonId: nextId } },
    });
    expect(unlocked.status).toBe("AVAILABLE");

    await page.goto(`/student/lessons/${nextId}`);
    await expect(page.getByRole("heading", { name: nextTitle })).toBeVisible();
    await expect(page.getByText("Diese Lektion ist gesperrt")).toHaveCount(0);
  });

  test("gesperrte Inhalte sind per URL-Manipulation nicht erreichbar", async ({ page }) => {
    await login(page);
    const lockedLesson = await db.lesson.findFirst({
      where: { chapter: { level: { code: "B2" }, orderIndex: 3 }, orderIndex: 1 },
      select: { id: true },
    });
    await page.goto(`/student/lessons/${lockedLesson!.id}`);
    await expect(page.getByText("Diese Lektion ist gesperrt")).toBeVisible();
    await expect(page.getByText(/vorherige Kapitelprüfung/i)).toBeVisible();
  });

  test("Rollenwechsel per URL wird von der Middleware blockiert", async ({ page }) => {
    await login(page);
    await page.goto("/admin/reports");
    await page.waitForURL("**/student");
  });
});
