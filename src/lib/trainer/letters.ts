import { ARABIC_LETTERS, type ArabicLetterLesson } from "@/lib/pronunciation/letters";
import conditions from "@/lib/pronunciation/letter_conditions.json";

// Only letters that have rules in letter_conditions.json can be evaluated, so
// that file decides which letters the trainer offers.
export const TRAINER_LETTERS: ArabicLetterLesson[] = ARABIC_LETTERS.filter(
  (letter) => Object.prototype.hasOwnProperty.call(conditions, letter.referenceText)
);
