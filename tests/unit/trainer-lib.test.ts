import { describe, expect, it } from "vitest";
import conditions from "@/lib/pronunciation/letter_conditions.json";
import { ARABIC_LETTERS } from "@/lib/pronunciation/letters";
import { evaluateLetterConditions } from "@/lib/pronunciation/condition-engine";
import { isTrainerHost } from "@/lib/trainer/host";
import { TRAINER_LETTERS } from "@/lib/trainer/letters";
import {
  buildTrainerResult,
  describeCondition,
  expectedPhonemesFromConditions,
  friendlyErrorMessage,
} from "@/lib/trainer/result";

describe("trainer letters", () => {
  it("offers exactly the letters that have rules in letter_conditions.json", () => {
    expect(TRAINER_LETTERS.map((l) => l.referenceText).sort()).toEqual(Object.keys(conditions).sort());
    expect(TRAINER_LETTERS.length).toBe(ARABIC_LETTERS.length);
  });
});

describe("trainer host", () => {
  it("matches only the standalone trainer host", () => {
    expect(isTrainerHost("dev.dz2s.de")).toBe(true);
    expect(isTrainerHost("DEV.dz2s.de:443")).toBe(true);
    expect(isTrainerHost("masaar-theta.vercel.app")).toBe(false);
    expect(isTrainerHost("dz2s.de")).toBe(false);
    expect(isTrainerHost(null)).toBe(false);
  });
});

describe("trainer result", () => {
  it("parses expected phonemes from positive conditions only", () => {
    expect(expectedPhonemesFromConditions(["azure_accuracy >= 70", "iqra_phonemes contains ['f','aa']"])).toEqual(["f", "aa"]);
    expect(expectedPhonemesFromConditions(["iqra_phonemes contains b"])).toEqual(["b"]);
    expect(expectedPhonemesFromConditions(["iqra_phonemes does not contain ['j','ii','m']"])).toEqual([]);
  });

  it("builds a success result from the API response using the config message", () => {
    const message = conditions["باء"].excellent.message;
    const result = buildTrainerResult({
      passed: true,
      recognized: "باء.",
      scores: { accuracy: 87 },
      conditionEvaluation: {
        matchedRule: "excellent",
        message,
        conditions: conditions["باء"].excellent.conditions,
        iqraPhonemes: ["b", "aa"],
        azureAccuracy: 87,
      },
    });
    expect(result).toMatchObject({ passed: true, tone: "success", message, accuracy: 87, matchedPhonemes: ["b"] });
  });

  it("marks a matched non-excellent rule as retry and a missing rule as neutral", () => {
    const retry = buildTrainerResult({
      passed: false,
      conditionEvaluation: { matchedRule: "said_sin", message: "x", conditions: [], iqraPhonemes: ["s", "aa"], azureAccuracy: 80 },
    });
    expect(retry.tone).toBe("retry");

    const neutral = buildTrainerResult({ passed: false, conditionEvaluation: { matchedRule: "no_matching_rule", message: "y" } });
    expect(neutral.tone).toBe("neutral");
  });

  it("agrees with the condition engine for every letter's excellent rule", () => {
    for (const [target, rules] of Object.entries(conditions)) {
      const excellent = (rules as Record<string, { conditions: string[]; message: string }>).excellent!;
      const phonemes = expectedPhonemesFromConditions(excellent.conditions);
      const evaluation = evaluateLetterConditions({ target, azureAccuracy: 95, azureRecognized: "", iqraPhonemes: phonemes });
      expect(evaluation?.message, target).toBeTruthy();
    }
  });

  it("describes conditions for display", () => {
    expect(describeCondition("azure_accuracy >= 70")).toBe("Azure accuracy ≥ 70");
    expect(describeCondition("iqra_phonemes contains ['f','aa']")).toBe("IQRA phonemes contain f, aa");
    expect(describeCondition("iqra_phonemes does not contain d")).toBe("IQRA phonemes do not contain d");
  });

  it("prefers Arabic server messages and otherwise uses safe Arabic fallbacks", () => {
    expect(friendlyErrorMessage(422, "لم أستطع تقييم النطق بوضوح. حاول مرة أخرى.")).toContain("لم أستطع");
    expect(friendlyErrorMessage(500, "Azure could not evaluate the recording.")).toContain("مشكلة");
    expect(friendlyErrorMessage(400, "Audio is required.")).toContain("تعذّر");
  });
});
