import rules from "./letter_conditions.json";

type Rule = {
  conditions: string[];
  message: string;
};

type Context = {
  azureAccuracy: number;
  azureRecognized: string;
  iqraPhonemes: string[];
};

function normalizedText(value: string) {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\u0621-\u064Aa-zA-Z]/g, "");
}

function hasPhonemes(phonemes: string[], expected: string[]) {
  return expected.every((phoneme) => phonemes.includes(phoneme));
}

function matchesCondition(condition: string, context: Context) {
  const accuracy = condition.match(/^azure_accuracy\s*(>=|<=|==|!=|>|<)\s*(\d+)$/);
  if (accuracy) {
    const [, operator, rawValue] = accuracy;
    const value = Number(rawValue);
    switch (operator) {
      case ">=": return context.azureAccuracy >= value;
      case "<=": return context.azureAccuracy <= value;
      case "==": return context.azureAccuracy === value;
      case "!=": return context.azureAccuracy !== value;
      case ">": return context.azureAccuracy > value;
      case "<": return context.azureAccuracy < value;
    }
  }

  const recognized = condition.match(/^azure_recognized\s*(==|!=)\s*(.+)$/);
  if (recognized) {
    const [, operator, expected] = recognized;
    const isMatch = normalizedText(context.azureRecognized) === normalizedText((expected ?? "").trim());
    return operator === "==" ? isMatch : !isMatch;
  }

  const phoneme = condition.match(/^iqra_phonemes\s*(does not contain|contains)\s*(.+)$/);
  if (phoneme) {
    const [, operator, rawExpected] = phoneme;
    const expected = (rawExpected ?? "")
      .replace(/[\[\]'\s]/g, "")
      .split(",")
      .filter(Boolean);
    const found = hasPhonemes(context.iqraPhonemes, expected);
    return operator === "contains" ? found : !found;
  }

  return false;
}

export function evaluateLetterConditions(context: Context & { target: string }) {
  const letterRules = (rules as Record<string, Record<string, Rule>>)[context.target];
  if (!letterRules) return null;

  for (const [rule, definition] of Object.entries(letterRules)) {
    if (definition.conditions.every((condition) => matchesCondition(condition, context))) {
      return {
        rule,
        message: definition.message,
        conditions: definition.conditions,
      };
    }
  }

  return null;
}
