import { describe, expect, it } from "vitest";
import { evaluateLetterConditions } from "@/lib/pronunciation/condition-engine";

describe("Arabic-letter condition engine", () => {
  it("selects the ثاء feedback based on Azure and IQRA results", () => {
    expect(evaluateLetterConditions({ target: "ثاء", azureAccuracy: 84, azureRecognized: "ثاء", iqraPhonemes: ["f", "aa"] }))
      .toMatchObject({ rule: "excellent" });
    expect(evaluateLetterConditions({ target: "ثاء", azureAccuracy: 84, azureRecognized: "ثاء", iqraPhonemes: ["s", "aa"] }))
      .toMatchObject({ rule: "said_sin" });
    expect(evaluateLetterConditions({ target: "ثاء", azureAccuracy: 62, azureRecognized: "ثاء", iqraPhonemes: ["f", "aa"] }))
      .toMatchObject({ rule: "wrong" });
  });

  it("supports Azure recognition comparisons for future rules", () => {
    expect(evaluateLetterConditions({ target: "ألف", azureAccuracy: 81, azureRecognized: "أَلِف.", iqraPhonemes: [] }))
      .toMatchObject({ rule: "excellent" });
  });
});
