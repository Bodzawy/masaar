import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Correct answers for the seeded B2 · Ch1 · L3 quiz (matched by prompt substring).
const QUIZ_FIXTURE: Array<{ includes: string; answer: string }> = [
  { includes: "hohen Arbeitslosigkeit", answer: "Infolge" },
  { includes: "versprochen, die Gehälter", answer: "zu" },
  { includes: "diese Entscheidung", answer: "überdenken" },
  { includes: "Höfliche Bitte mit", answer: "Konjunktiv II" },
  { includes: "Ergebnisse", answer: "wurden" },
  { includes: "Zahlen genau analysiert", answer: "Wenn" },
  { includes: "nie eine Frist verpasst", answer: "hat" },
  { includes: "Bericht, ___ ich gestern gelesen", answer: "den" },
  { includes: "freue mich ___ Ihr Interesse", answer: "über" },
  { includes: "Schulung findet", answer: "am" },
  { includes: "bedeutet „die Frist“", answer: "deadline" },
  { includes: "Synonym für „der Arbeitgeber“", answer: "die Firma, die Personal stellt" },
  { includes: "Besprechung abhalten", answer: "hold a meeting" },
  { includes: "Wegen ihrer ___ Arbeit gelobt", answer: "sorgfältige" },
  { includes: "Wort passt", answer: "sorgfältige" },
  { includes: "das Gehalt“ bezeichnet", answer: "monthly salary" },
  { includes: "Warum schreibt Herr Baumann", answer: "To postpone a meeting and request slides" },
  { includes: "Folien geschickt werden", answer: "Wednesday evening" },
  { includes: "Stellenanzeige NICHT", answer: "Ein Firmenauto" },
  { includes: "Frau Klein laut Ansage", answer: "Betreuung internationaler Partner" },
  { includes: "Herr Moser seine Unterstützung", answer: "Ab Januar" },
];

async function currentLessonIds() {
  // The student's CURRENT lesson = first non-completed unlocked lesson in B2·Ch1.
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


async function login(page: import("@playwright/test").Page) {
  // Each test gets a fresh context — sign in through the real form every time.
  await page.goto("/signin");
  await page.getByLabel("Email").fill("lena.schmidt@demo.deutschpath.dev");
  await page.getByLabel("Password").fill("demo1234!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/student");
}

test.describe.serial("student happy path", () => {
  let bookingCountBefore = 0;

  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("sign in via demo selector and see dashboard with current lesson", async ({ page }) => {
    // Real credential sign-in through the form (demo selector only exists in dev).
    await page.goto("/signin");
    await expect(page.getByTestId("demo-account-selector")).toHaveCount(0); // hidden in production builds
    await page.getByLabel("Email").fill("lena.schmidt@demo.deutschpath.dev");
    await page.getByLabel("Password").fill("demo1234!");
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.waitForURL("**/student");
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Lena/ })).toBeVisible();
    await expect(page.getByText("Kommunikation am Arbeitsplatz").first()).toBeVisible();

    const lena = await db.user.findUniqueOrThrow({ where: { email: "lena.schmidt@demo.deutschpath.dev" } });
    bookingCountBefore = await db.booking.count({ where: { studentId: lena.id } });
  });

  test("books an instant lesson with a compatible online teacher", async ({ page }) => {
    await login(page);

    await page.goto("/student/teachers");
    // Qualified online favorites appear first; book the first instant slot.
    const instantButtons = page.getByRole("button", { name: /Instant/ });
    await expect(instantButtons.first()).toBeEnabled();
    await instantButtons.first().click();
    await expect(page.getByText("Start an instant lesson?")).toBeVisible();
    await page.getByRole("button", { name: "Start lesson" }).click();
    await page.waitForURL("**/student/classroom/**", { timeout: 20_000 });

    const lena = await db.user.findUniqueOrThrow({ where: { email: "lena.schmidt@demo.deutschpath.dev" } });
    const countAfterBooking = await db.booking.count({ where: { studentId: lena.id } });
    expect(countAfterBooking).toBe(bookingCountBefore + 1);
  });

  test("completes the demo live lesson and rates the teacher", async ({ page }) => {
    await login(page);

    // Enter the classroom of the just-created instant booking
    await page.goto("/student/schedule");
    await page.getByRole("link", { name: /Classroom/ }).first().click();
    await page.waitForURL("**/student/classroom/**");
    await expect(page.getByText(/Local demo mode/)).toBeVisible(); // honest provider labeling

    await page.getByRole("button", { name: /Leave & rate lesson/ }).click();
    await page.waitForURL("**/student/post-lesson/**");

    // Rate all six categories with 5 stars
    const groups = page.locator('[role="radiogroup"]');
    await expect(groups).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await groups.nth(i).getByRole("radio").nth(4).click();
    }
    await page.getByRole("button", { name: /Submit & continue/ }).click();
    await page.waitForURL("**/quiz**", { timeout: 15_000 });

    // Attendance was recorded server-side
    const { currentId } = await currentLessonIds();
    const progress = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: (await lenaId()), lessonId: currentId } },
    });
    expect(progress.attendanceComplete).toBe(true);
  });

  test("passes the 20-question quiz with server-side scoring", async ({ page }) => {
    await login(page);

    const { currentId } = await currentLessonIds();
    await page.goto(`/student/lessons/${currentId}/quiz`);

    for (let q = 0; q < 20; q++) {
      const legend = await page.locator("fieldset legend").innerText();
      const fixture = QUIZ_FIXTURE.find((f) =>
        legend.toLowerCase().includes(f.includes.toLowerCase())
      );
      expect(fixture, `fixture missing for: ${legend}`).toBeDefined();
      await page.locator('[role="radiogroup"]').first().getByRole("radio", { name: fixture!.answer, exact: true }).click();
      if (q < 19) {
        await page.getByRole("button", { name: /Next/ }).click();
      } else {
        await page.getByRole("button", { name: /Submit quiz/ }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
      }
    }

    await expect(page.getByRole("heading", { name: "Passed" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/You scored \d+%/)).toBeVisible();

    const progress = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: await lenaId(), lessonId: currentId } },
    });
    expect(progress.quizPassed).toBe(true);
    expect(progress.quizBestScore).toBe(100);
  });

  test("submits homework → lesson completes → next lesson unlocks", async ({ page }) => {
    await login(page);

    const { currentId, nextId, nextTitle } = await currentLessonIds();

    // Continue from result screen or navigate directly
    await page.goto(`/student/homework/${currentId}`);
    await page.getByLabel("Writing task answer").fill(
      "Hallo Nadine, vielen Dank für deine tolle Arbeit an den Reports. Mir ist aufgefallen, dass einige Zahlen noch fehlen. Könntest du sie bitte bis Freitag ergänzen? Danke dir!"
    );
    await page.getByRole("button", { name: /Submit homework/ }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).last().click();
    await expect(page.getByText("Awaiting grading")).toBeVisible({ timeout: 15_000 });

    // Lesson must now be COMPLETED and the NEXT lesson AVAILABLE — in the database.
    const done = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: await lenaId(), lessonId: currentId } },
    });
    expect(done.status).toBe("COMPLETED");
    const unlocked = await db.lessonProgress.findUniqueOrThrow({
      where: { studentId_lessonId: { studentId: await lenaId(), lessonId: nextId } },
    });
    expect(unlocked.status).toBe("AVAILABLE");

    // …and in the UI: the locked page would refuse direct access to later lessons.
    await page.goto(`/student/lessons/${nextId}`);
    await expect(page.getByRole("heading", { name: nextTitle })).toBeVisible();
    await expect(page.getByText("This lesson is locked")).toHaveCount(0);
  });

  test("locked progression cannot be bypassed by URL manipulation", async ({ page }) => {
    await login(page);

    // Chapter 3's lessons are still locked (chapters 1 exam not passed)
    const lockedLesson = await db.lesson.findFirst({
      where: { chapter: { level: { code: "B2" }, orderIndex: 3 }, orderIndex: 1 },
      select: { id: true, titleDe: true },
    });
    await page.goto(`/student/lessons/${lockedLesson!.id}`);
    await expect(page.getByText("This lesson is locked")).toBeVisible();
    await expect(page.getByText(/pass the previous chapter exam/i)).toBeVisible();
  });

  test("cross-role access is blocked by middleware", async ({ page }) => {
    // Student tries admin workspace → redirected to own home
    await login(page);
    await page.goto("/admin/reports");
    await page.waitForURL("**/student");
  });
});

async function lenaId(): Promise<string> {
  const lena = await db.user.findUniqueOrThrow({ where: { email: "lena.schmidt@demo.deutschpath.dev" } });
  return lena.id;
}
