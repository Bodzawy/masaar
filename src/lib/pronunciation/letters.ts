export type ArabicLetterLesson = {
    id: string;
    letter: string;
    referenceText: string;
    modelText: string;
  };
  
  export const ARABIC_LETTERS: ArabicLetterLesson[] = [
    { id: "alif", letter: "ا", referenceText: "ألف", modelText: "أَلِف" },
    { id: "baa", letter: "ب", referenceText: "باء", modelText: "بَاء" },
    { id: "taa", letter: "ت", referenceText: "تاء", modelText: "تَاء" },
    { id: "thaa", letter: "ث", referenceText: "ثاء", modelText: "ثَاء" },
    {
        id: "jeem",
        letter: "ج",
        referenceText: "جيم",
        modelText: "جِيم",
      },    { id: "haa", letter: "ح", referenceText: "حاء", modelText: "حَاء" },
    { id: "khaa", letter: "خ", referenceText: "خاء", modelText: "خَاء" },
    { id: "daal", letter: "د", referenceText: "دال", modelText: "دَال" },
    { id: "dhaal", letter: "ذ", referenceText: "ذال", modelText: "ذَال" },
    { id: "raa", letter: "ر", referenceText: "راء", modelText: "رَاء" },
    { id: "zaay", letter: "ز", referenceText: "زاي", modelText: "زَاي" },
    { id: "seen", letter: "س", referenceText: "سين", modelText: "سِين" },
    { id: "sheen", letter: "ش", referenceText: "شين", modelText: "شِين" },
    { id: "saad", letter: "ص", referenceText: "صاد", modelText: "صَاد" },
    { id: "daad", letter: "ض", referenceText: "ضاد", modelText: "ضَاد" },
    { id: "taa-heavy", letter: "ط", referenceText: "طاء", modelText: "طَاء" },
    { id: "zaa-heavy", letter: "ظ", referenceText: "ظاء", modelText: "ظَاء" },
    { id: "ayn", letter: "ع", referenceText: "عين", modelText: "عَيْن" },
    { id: "ghayn", letter: "غ", referenceText: "غين", modelText: "غَيْن" },
    { id: "faa", letter: "ف", referenceText: "فاء", modelText: "فَاء" },
    { id: "qaaf", letter: "ق", referenceText: "قاف", modelText: "قَاف" },
    { id: "kaaf", letter: "ك", referenceText: "كاف", modelText: "كَاف" },
    { id: "laam", letter: "ل", referenceText: "لام", modelText: "لَام" },
    { id: "meem", letter: "م", referenceText: "ميم", modelText: "مِيم" },
    { id: "noon", letter: "ن", referenceText: "نون", modelText: "نُون" },
    { id: "haa-final", letter: "ه", referenceText: "هاء", modelText: "هَاء" },
    { id: "waaw", letter: "و", referenceText: "واو", modelText: "وَاو" },
    { id: "yaa", letter: "ي", referenceText: "ياء", modelText: "يَاء" },
  ];