import { expect, test } from "@playwright/test";
import conditions from "../src/lib/pronunciation/letter_conditions.json";

// The fake microphone plays TRAINER_FAKE_AUDIO, so it must be a recording of TRAINER_FAKE_LETTER.
const fakeLetter = process.env.TRAINER_FAKE_LETTER ?? "ث";
const fakeReference = process.env.TRAINER_FAKE_REFERENCE ?? "ثاء";
const path = process.env.TRAINER_PATH ?? "/trainer";
const expectFullChain = process.env.TRAINER_EXPECT_FULL === "1";

test.skip(!process.env.TRAINER_FAKE_AUDIO, "set TRAINER_FAKE_AUDIO to a WAV of the letter being tested");

test("microphone → recording → API → Azure → IQRA → conditions → result", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input).includes("/api/pronunciation") && init?.body instanceof FormData) {
        const audio = init.body.get("audio") as File;
        const head = new Uint8Array(await audio.slice(0, 44).arrayBuffer());
        const view = new DataView(head.buffer);
        (window as unknown as { __upload: unknown }).__upload = {
          target: init.body.get("target"),
          fileName: audio.name,
          size: audio.size,
          riff: String.fromCharCode(...head.slice(0, 4)),
          wave: String.fromCharCode(...head.slice(8, 12)),
          channels: view.getUint16(22, true),
          sampleRate: view.getUint32(24, true),
          bits: view.getUint16(34, true),
        };
      }
      return original(input, init);
    };
  });

  await page.goto(path);
  await expect(page.getByTestId("trainer-letter")).toBeVisible();

  for (let step = 0; step < 28; step++) {
    if ((await page.getByTestId("trainer-letter").textContent()) === fakeLetter) break;
    await page.getByRole("button", { name: /تخطَّ هذا الحرف/ }).click();
  }
  await expect(page.getByTestId("trainer-letter")).toHaveText(fakeLetter);
  await page.screenshot({ path: testInfo.outputPath("1-idle.png") });

  const apiCall = page.waitForResponse((r) => r.url().includes("/api/pronunciation") && r.request().method() === "POST");

  await page.getByTestId("record-button").click();
  await expect(page.getByTestId("trainer-status")).toContainText("جارٍ التسجيل");
  await page.screenshot({ path: testInfo.outputPath("2-recording.png") });
  await page.waitForTimeout(2500);
  await page.getByTestId("record-button").click();

  const response = await apiCall;
  expect(response.status()).toBe(200);
  const upload = await page.evaluate(() => (window as unknown as { __upload: Record<string, unknown> }).__upload);
  expect(upload).toMatchObject({
    target: fakeReference,
    fileName: "voice.wav",
    riff: "RIFF",
    wave: "WAVE",
    channels: 1,
    sampleRate: 16000,
    bits: 16,
  });
  expect(upload.size as number).toBeGreaterThan(20_000);

  await expect(page.getByTestId("trainer-result")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("3-result.png"), fullPage: true });

  const api = await response.json();
  await expect(page.getByTestId("trainer-accuracy")).toHaveText(`${api.scores.accuracy}%`);
  await expect(page.getByTestId("trainer-message")).toHaveText(api.conditionEvaluation.message.trim());
  await expect(page.getByTestId("trainer-rule")).toHaveText(api.conditionEvaluation.matchedRule);

  if (expectFullChain) {
    const excellent = (conditions as Record<string, { excellent: { message: string } }>)[fakeReference]!.excellent;
    expect(api.details.iqra?.phonemes?.length).toBeGreaterThan(0);
    expect(api.details.masaar).toBeTruthy();
    await expect(page.getByTestId("trainer-rule")).toHaveText("excellent");
    await expect(page.getByTestId("trainer-message")).toHaveText(excellent.message);
    await expect(page.getByTestId("trainer-phonemes")).not.toContainText("no phonemes");
  }

  await page.getByTestId("retry-button").click();
  await expect(page.getByTestId("record-button")).toBeEnabled();
  expect(consoleErrors).toEqual([]);
});
