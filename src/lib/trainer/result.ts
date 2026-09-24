export type PronunciationApiResponse = {
  target?: string;
  recognized?: string;
  passed?: boolean;
  scores?: { accuracy?: number | null };
  details?: {
    iqra?: { phonemes?: string[] } | null;
  };
  conditionEvaluation?: {
    matchedRule?: string;
    message?: string;
    conditions?: string[];
    iqraPhonemes?: string[];
    azureAccuracy?: number | null;
  };
};

export type TrainerResult = {
  passed: boolean;
  rule: string;
  message: string;
  accuracy: number | null;
  recognized: string;
  detectedPhonemes: string[];
  expectedPhonemes: string[];
  matchedPhonemes: string[];
  conditions: string[];
  tone: "success" | "retry" | "neutral";
};

export const NO_RULE = "no_matching_rule";

// Only positive "iqra_phonemes contains ..." conditions describe sounds the
// student is expected to produce; "does not contain" ones are ignored.
export function expectedPhonemesFromConditions(conditions: string[]): string[] {
  const expected: string[] = [];
  for (const condition of conditions) {
    const match = condition.match(/^iqra_phonemes\s+contains\s+(.+)$/);
    if (!match) continue;
    for (const phoneme of match[1]!.replace(/[\[\]'\s]/g, "").split(",")) {
      if (phoneme && !expected.includes(phoneme)) expected.push(phoneme);
    }
  }
  return expected;
}

export function buildTrainerResult(response: PronunciationApiResponse): TrainerResult {
  const evaluation = response.conditionEvaluation ?? {};
  const rule = evaluation.matchedRule ?? NO_RULE;
  const conditions = evaluation.conditions ?? [];
  const detectedPhonemes = evaluation.iqraPhonemes ?? response.details?.iqra?.phonemes ?? [];
  const expectedPhonemes = expectedPhonemesFromConditions(conditions);
  const passed = response.passed === true;

  return {
    passed,
    rule,
    message: evaluation.message ?? "",
    accuracy: evaluation.azureAccuracy ?? response.scores?.accuracy ?? null,
    recognized: response.recognized ?? "",
    detectedPhonemes,
    expectedPhonemes,
    matchedPhonemes: expectedPhonemes.filter((phoneme) => detectedPhonemes.includes(phoneme)),
    conditions,
    tone: passed ? "success" : rule === NO_RULE ? "neutral" : "retry",
  };
}

const OPERATORS: Record<string, string> = {
  ">=": "≥", "<=": "≤", "==": "=", "!=": "≠", ">": ">", "<": "<",
};

// Display-only wording for a rule condition; evaluation stays in condition-engine.ts.
export function describeCondition(condition: string): string {
  const accuracy = condition.match(/^azure_accuracy\s*(>=|<=|==|!=|>|<)\s*(\d+)$/);
  if (accuracy) return `Azure accuracy ${OPERATORS[accuracy[1]!]} ${accuracy[2]}`;

  const phoneme = condition.match(/^iqra_phonemes\s*(does not contain|contains)\s*(.+)$/);
  if (phoneme) {
    const list = phoneme[2]!.replace(/[\[\]'\s]/g, "").split(",").filter(Boolean).join(", ");
    return phoneme[1] === "contains"
      ? `IQRA phonemes contain ${list}`
      : `IQRA phonemes do not contain ${list}`;
  }

  const recognized = condition.match(/^azure_recognized\s*(==|!=)\s*(.+)$/);
  if (recognized) return `Azure heard ${recognized[1] === "==" ? "=" : "≠"} ${recognized[2]!.trim()}`;

  return condition;
}

const ARABIC = /[؀-ۿ]/;

export function friendlyErrorMessage(status: number, serverError?: string): string {
  if (serverError && ARABIC.test(serverError)) return serverError;
  if (status === 413) return "التسجيل كبير جدًا. حاول مرة أخرى بتسجيل أقصر.";
  if (status === 429) return "الطلبات كثيرة الآن. انتظر قليلًا ثم حاول مرة أخرى.";
  if (status >= 500) return "حدثت مشكلة في تحليل النطق. حاول مرة أخرى بعد قليل.";
  return "تعذّر تحليل التسجيل. حاول مرة أخرى.";
}
