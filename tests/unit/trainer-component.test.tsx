import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import conditions from "@/lib/pronunciation/letter_conditions.json";

vi.mock("@/lib/audio/wav", () => ({
  blobTo16KhzMonoWav: vi.fn(async () => new Blob(["RIFFtest"], { type: "audio/wav" })),
}));

import { PronunciationTrainer } from "@/components/trainer/pronunciation-trainer";

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: MediaStream) {
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio-bytes"]) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
const fakeStream = { getTracks: () => [track] } as unknown as MediaStream;
const getUserMedia = vi.fn();
const fetchMock = vi.fn();

const excellent = conditions["ألف"].excellent;
const okResponse = {
  target: "ألف",
  recognized: "ألف.",
  passed: true,
  scores: { accuracy: 87 },
  details: { iqra: { phonemes: ["b", "aa"] } },
  conditionEvaluation: {
    matchedRule: "excellent",
    message: excellent.message,
    conditions: excellent.conditions,
    iqraPhonemes: ["b", "aa"],
    azureAccuracy: 87,
  },
};

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function recordOnce() {
  fireEvent.click(screen.getByTestId("record-button"));
  await waitFor(() => expect(screen.getByTestId("trainer-status").textContent).toContain("جارٍ التسجيل"));
  await wait(450); // the trainer rejects recordings shorter than 400 ms
  fireEvent.click(screen.getByTestId("record-button"));
}

beforeEach(() => {
  FakeRecorder.instances = [];
  track.stop.mockClear();
  getUserMedia.mockReset().mockResolvedValue(fakeStream);
  fetchMock.mockReset().mockResolvedValue(json(okResponse));
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PronunciationTrainer", () => {
  it("starts on the first letter with progress", () => {
    render(<PronunciationTrainer />);
    expect(screen.getByTestId("trainer-letter").textContent).toBe("ا");
    expect(screen.getByTestId("trainer-progress").textContent).toContain("1 من 28");
  });

  it("records, posts a WAV with the letter target, and shows the condition-engine result", async () => {
    render(<PronunciationTrainer />);
    await recordOnce();

    await waitFor(() => expect(screen.getByTestId("trainer-result")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/pronunciation");
    const body = init.body as FormData;
    expect(body.get("target")).toBe("ألف");
    expect((body.get("audio") as File).name).toBe("voice.wav");

    expect(screen.getByTestId("trainer-accuracy").textContent).toBe("87%");
    expect(screen.getByTestId("trainer-phonemes").textContent).toContain("b");
    expect(screen.getByTestId("trainer-rule").textContent).toBe("excellent");
    expect(screen.getByTestId("trainer-message").textContent).toBe(excellent.message);
    expect(track.stop).toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  });

  it("lets the student retry and move to the next letter", async () => {
    render(<PronunciationTrainer />);
    await recordOnce();
    await waitFor(() => screen.getByTestId("trainer-result"));

    fireEvent.click(screen.getByTestId("retry-button"));
    expect(screen.getByTestId("trainer-letter").textContent).toBe("ا");

    await recordOnce();
    await waitFor(() => screen.getByTestId("trainer-result"));
    fireEvent.click(screen.getByTestId("next-button"));
    expect(screen.getByTestId("trainer-letter").textContent).toBe("ب");
    expect(screen.getByTestId("trainer-progress").textContent).toContain("2 من 28");
  });

  it("explains a denied microphone permission", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    render(<PronunciationTrainer />);
    fireEvent.click(screen.getByTestId("record-button"));
    await waitFor(() => expect(screen.getByTestId("trainer-error").textContent).toContain("الميكروفون"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows Arabic server messages and safe fallbacks for API errors", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "لم أستطع تقييم النطق بوضوح. حاول مرة أخرى." }, 422));
    render(<PronunciationTrainer />);
    await recordOnce();
    await waitFor(() => expect(screen.getByTestId("trainer-error").textContent).toContain("لم أستطع تقييم النطق"));

    fetchMock.mockResolvedValueOnce(json({ error: "Azure could not evaluate the recording." }, 500));
    await recordOnce();
    await waitFor(() => expect(screen.getByTestId("trainer-error").textContent).toContain("مشكلة في تحليل النطق"));
  });

  it("handles a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<PronunciationTrainer />);
    await recordOnce();
    await waitFor(() => expect(screen.getByTestId("trainer-error").textContent).toContain("الاتصال"));
  });

  it("rejects a recording that is too short without calling the API", async () => {
    render(<PronunciationTrainer />);
    fireEvent.click(screen.getByTestId("record-button"));
    await waitFor(() => expect(screen.getByTestId("trainer-status").textContent).toContain("جارٍ التسجيل"));
    fireEvent.click(screen.getByTestId("record-button"));
    await waitFor(() => expect(screen.getByTestId("trainer-error").textContent).toContain("قصير"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not start twice or submit twice while busy", async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    render(<PronunciationTrainer />);

    const button = screen.getByTestId("record-button");
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId("trainer-status").textContent).toContain("جارٍ التسجيل"));
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await wait(450);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId("trainer-status").textContent).toContain("جارٍ تحليل"));
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release(json(okResponse));
    await waitFor(() => screen.getByTestId("trainer-result"));
  });
});
