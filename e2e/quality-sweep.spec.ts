import { test, expect } from "@playwright/test";

// Quality sweep: no console errors, no hydration failures, no horizontal
// overflow — verified per page at mobile / tablet / desktop viewports.

const STUDENT_PAGES = [
  "/student",
  "/student/learning-path",
  "/student/teachers",
  "/student/schedule",
  "/student/vocabulary",
  "/student/skills",
  "/student/homework",
  "/student/exams",
  "/student/favorites",
  "/student/notifications",
  "/student/billing",
  "/student/settings",
  "/student/assistant",
];

const PUBLIC_PAGES = ["/", "/signin", "/verify/CERT-839293"];

async function assertNoOverflowAndNoErrors(
  page: import("@playwright/test").Page,
  path: string,
  consoleErrors: string[]
) {
  await page.goto(path, { waitUntil: "networkidle" }).catch(() => page.goto(path));
  await page.waitForTimeout(250); // allow charts/animations to settle

  // Horizontal overflow check
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scroll <= overflow.client + 1,
    `horizontal overflow on ${path} (${overflow.scroll}px > ${overflow.client}px)`
  ).toBe(true);

  // Hydration / React errors surface in the console
  const hydration = consoleErrors.filter(
    (m) => /hydration|did not match|Minified React error/i.test(m)
  );
  expect(hydration, `hydration/console errors on ${path}: ${hydration.join(" | ")}`).toEqual([]);
}

test.describe("responsive & console quality sweep", () => {
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`[${viewport.name}] public pages render clean`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      for (const path of PUBLIC_PAGES) {
        await assertNoOverflowAndNoErrors(page, path, errors);
      }
      expect(errors.filter((e) => !/favicon|net::ERR_FAILED/i.test(e))).toEqual([]);
    });

    test(`[${viewport.name}] student workspace renders clean`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      // Sign in once
      await page.goto("/signin");
      await page.getByLabel("Email").fill("lena.schmidt@demo.deutschpath.dev");
      await page.getByLabel("Password").fill("demo1234!");
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL("**/student");

      for (const path of STUDENT_PAGES) {
        await assertNoOverflowAndNoErrors(page, path, errors);
      }
      expect(errors.filter((e) => !/favicon|net::ERR_FAILED/i.test(e))).toEqual([]);
    });

    test(`[${viewport.name}] teacher & admin overviews render clean`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      for (const [email, home] of [
        ["stefan.brinkmann@demo.deutschpath.dev", "/teacher"],
        ["admin@demo.deutschpath.dev", "/admin"],
      ] as Array<[string, string]>) {
        // Fresh session per role — signed-in users are redirected away from /signin.
        await page.context().clearCookies();
        await page.goto("/signin");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill("demo1234!");
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(`**${home}`);
        for (const path of [home]) {
          await assertNoOverflowAndNoErrors(page, path, errors);
        }
      }
      expect(errors.filter((e) => !/favicon|net::ERR_FAILED/i.test(e))).toEqual([]);
    });
  }
});
