// Einstufungstest: Arabisch für Deutschsprachige.
// Transparente Demo-Wertung: Anzahl richtiger Antworten → PLACEMENT_THRESHOLDS → Niveauvorschlag.
export interface PlacementQuestion {
  id: string;
  levelProbe: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  /** "rtl" rendert die Optionen als arabische RTL-Inseln. */
  optionDir?: "rtl" | "ltr";
}

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  { id: "p1", levelProbe: "A1", prompt: "Wie heißt dieser Buchstabe? ب", options: ["Bāʾ (ب)", "Nūn (ن)", "Tāʾ (ت)", "Yāʾ (ي)"], correctIndex: 0 },
  { id: "p2", levelProbe: "A1", prompt: "Wovon ist die Rede?", optionDir: "rtl", options: ["Buch", "Stadt", "Haus", "Wasser"], correctIndex: 2 },
  { id: "p3", levelProbe: "A1", prompt: "Was bedeutet diese Begrüßung? مَرْحَبًا", options: ["Auf Wiedersehen", "Hallo!", "Danke", "Gute Nacht"], correctIndex: 1 },
  { id: "p4", levelProbe: "A1", prompt: "Wie viele Buchstaben hat das arabische Alphabet?", options: ["26", "28", "30", "32"], correctIndex: 1 },
  { id: "p5", levelProbe: "A2", prompt: "Was bedeutet شُكْرًا؟", options: ["Bitte schön", "Entschuldigung", "Danke", "Gern geschehen"], correctIndex: 2, optionDir: "rtl" },
  { id: "p6", levelProbe: "A2", prompt: "Welches Wort ist eine Zahl?", optionDir: "rtl", options: ["كِتَاب", "ثَلَاثَة", "مَدِينَة", "طَالِب"], correctIndex: 1 },
  { id: "p7", levelProbe: "A2", prompt: "أَنَا طَالِب – Was passt sinngemäß?", optionDir: "rtl", options: ["Ich bin Student.", "Er arbeitet viel.", "Sie wohnt in Kairo.", "Wir reisen morgen."], correctIndex: 0 },
  { id: "p8", levelProbe: "A2", prompt: "Welcher Buchstabe ist ein Langvokal-Träger in قَالَ؟", options: ["ق", "ا", "ل", "keiner"], correctIndex: 1 },
  { id: "p9", levelProbe: "B1", prompt: "ذَهَبْتُ إِلَى السُّوقِ – Welche Zeitform liegt vor?", optionDir: "rtl", options: ["Vergangenheit (ich ging)", "Gegenwart", "Zukunft", "Befehlsform"], correctIndex: 0 },
  { id: "p10", levelProbe: "B1", prompt: "Was bedeutet هَلْ تَتَكَلَّمُ إِنْجِلِيزِيًّا؟", options: ["Sprichst du Englisch?", "Wo wohnst du?", "Wie geht es dir?", "Was machst du?"], correctIndex: 0 },
  { id: "p11", levelProbe: "B1", prompt: "Welche Form ist richtig: „ich schreibe“?", optionDir: "rtl", options: ["أَكْتُب", "أَكْتُبُ", "كَتَبْتُ", "سَيَكْتُب"], correctIndex: 1 },
  { id: "p12", levelProbe: "B1", prompt: "In der Idafa (Anschlusskonstruktion) كِتَابُ الطَّالِبِ steht das zweite Nomen im …", options: ["Genitiv ohne Artikel", "Nominativ mit Artikel", "Akkusativ", "Dual"], correctIndex: 0 },
  { id: "p13", levelProbe: "B2", prompt: "سَيَذْهَبُونَ غَدًا – Welche Zeit und Person?", options: ["Zukunft, 3. Pl.", "Vergangenheit, 3. Sg.", "Gegenwart, 1. Pl.", "Befehl, 2. Pl."], correctIndex: 0 },
  { id: "p14", levelProbe: "B2", prompt: "Was drückt لامِ الْمَصْدَرِيَّة في «لِتَحْسُنَ حَيَاتُكَ» aus?", options: ["Zweck / Folge", "Bedingung", "Grund der Vergangenheit", "Einräumung"], correctIndex: 0 },
  { id: "p15", levelProbe: "B2", prompt: "Welches Wort ist ein Sammelbegriff für „Menschen“?", optionDir: "rtl", options: ["النَّاس", "الرِّجَال", "النِّسَاء", "الأَوْلَاد"], correctIndex: 0 },
  { id: "p16", levelProbe: "C1", prompt: "In journalistischen Texten wird häufig … verwendet.", options: ["Passiv und Nominalstil", "nur Verbalsätze", "Umgangssprache", "Wiederholung des Subjekts"], correctIndex: 0 },
];
