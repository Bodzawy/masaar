import { defineConfig } from "@playwright/test";

// Standalone trainer E2E (no database). Run against any deployment:
//   TRAINER_BASE_URL=https://dev.dz2s.de TRAINER_PATH=/ TRAINER_FAKE_AUDIO=/path/letter.wav \
//   npx playwright test -c playwright.trainer.config.ts
const fakeAudio = process.env.TRAINER_FAKE_AUDIO;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /trainer\.spec\.ts/,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: process.env.TRAINER_BASE_URL ?? "http://localhost:3111",
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        ...(fakeAudio ? [`--use-file-for-fake-audio-capture=${fakeAudio}`] : []),
      ],
    },
  },
});
