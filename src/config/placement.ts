// Concise sample placement test — demo scoring logic is transparent:
// correctCount maps to PLACEMENT_THRESHOLDS to suggest a CEFR level.
export interface PlacementQuestion {
  id: string;
  levelProbe: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  { id: "p1", levelProbe: "A1", prompt: "Ich ___ Anna.", options: ["bin", "bist", "ist", "sind"], correctIndex: 0 },
  { id: "p2", levelProbe: "A1", prompt: "___ heißt du?", options: ["Wo", "Wie", "Wer", "Wann"], correctIndex: 1 },
  { id: "p3", levelProbe: "A1", prompt: "Das ist ___ Buch.", options: ["ein", "eine", "einen", "einem"], correctIndex: 0 },
  { id: "p4", levelProbe: "A2", prompt: "Gestern ___ ich ins Kino gegangen.", options: ["habe", "bin", "war", "hatte"], correctIndex: 1 },
  { id: "p5", levelProbe: "A2", prompt: "Kannst du mir bitte helfen? Ich ___ nicht weiter.", options: ["komme", "kommt", "kommst", "kommen"], correctIndex: 0 },
  { id: "p6", levelProbe: "A2", prompt: "Wir fahren ___ Wochenende an den See.", options: ["nächsten", "nächstes", "nächster", "nächste"], correctIndex: 1 },
  { id: "p7", levelProbe: "A2", prompt: "Er hat ___ Kaffee bestellt.", options: ["einen", "ein", "eine", "einem"], correctIndex: 0 },
  { id: "p8", levelProbe: "B1", prompt: "Wenn ich mehr Zeit ___, würde ich reisen.", options: ["hätte", "habe", "haben", "hatte"], correctIndex: 0 },
  { id: "p9", levelProbe: "B1", prompt: "Der Brief, ___ gestern kam, ist wichtig.", options: ["der", "den", "dem", "dessen"], correctIndex: 0 },
  { id: "p10", levelProbe: "B1", prompt: "Das Auto wird gerade ___.", options: ["repariert", "reparieren", "reparierte", "repariert werden"], correctIndex: 0 },
  { id: "p11", levelProbe: "B1", prompt: "Ich freue mich ___ die Einladung.", options: ["über", "auf", "für", "an"], correctIndex: 0 },
  { id: "p12", levelProbe: "B2", prompt: "___ der hohen Kosten wurde das Projekt verschoben.", options: ["Infolge", "Trotz", "Während", "Laut"], correctIndex: 0 },
  { id: "p13", levelProbe: "B2", prompt: "Sie hat das ___ , ohne zu zögern.", options: ["getan", "tun", "tat", "tue"], correctIndex: 0 },
  { id: "p14", levelProbe: "B2", prompt: "Man munkelt, er ___ nächstes Jahr kandidieren.", options: ["werde", "wird", "würde", "will"], correctIndex: 0 },
  { id: "p15", levelProbe: "B2", prompt: "Das ist eine ___ Entscheidung.", options: ["weitreichende", "weitreichend", "weit reichende", "weitreichenden"], correctIndex: 0 },
  { id: "p16", levelProbe: "C1", prompt: "___ man es auch dreht und wendet — die Zahlen sprechen für sich.", options: ["Wie", "Was", "Auch wenn", "Obwohl"], correctIndex: 0 },
];
