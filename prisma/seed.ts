// Deterministischer Seed: Arabischlernen für Deutschsprachige.
// Realistische Inhalte für alle Hauptflows. Ausführen: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { TEACHER_RANKS } from "../src/config/domain";
import type { CefrCode } from "../src/config/domain";

const db = new PrismaClient();

const daysAgo = (n: number, h = 12) => new Date(Date.now() - n * 86_400_000 + h * 3_600_000);
const daysAhead = (n: number, h = 17) => new Date(Date.now() + n * 86_400_000 - (23 - h) * 3_600_000);
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

interface QSpec {
  skill: "GRAMMAR" | "VOCABULARY" | "READING" | "LISTENING";
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  context?: string;
}
interface LessonSpec {
  title: string; // deutscher Lektionstitel
  titleDe: string; // arabisches Thema (Titelzeile)
  summary: string;
  objectives: string[];
  materials: Array<{ type: string; title: string; body?: string }>;
  quiz?: QSpec[];
  homework?: { title: string; instructions: string; writingPrompt: string };
}
interface ChapterSpec { title: string; titleDe: string; description: string; lessons: LessonSpec[] }

async function main() {
  console.log("Seeding Masaar – Arabisch lernen für Deutschsprachige…");
  await wipe();

  // ── RBAC ───────────────────────────────────────────────────────────────────
  const permissionRows = [
    ["curriculum_edit", "Niveaus, Kapitel, Lektionen und Quiz bearbeiten"],
    ["students_view", "Lernende einsehen"],
    ["students_manage", "Lernende sperren/anpassen"],
    ["teachers_view", "Lehrkräfte und Pipeline einsehen"],
    ["teachers_manage", "Onboarding voranbringen, Lehrkräfte sperren"],
    ["reports_view", "Meldungen und Beweismittel einsehen"],
    ["reports_decide", "Fälle entscheiden und schließen"],
    ["retakes_review", "Wiederholungsanfragen prüfen"],
    ["certificates_issue", "Zertifikate ausstellen"],
    ["certificates_revoke", "Zertifikate widerrufen"],
    ["payments_view", "Zahlungen und Auszahlungen einsehen"],
    ["payments_manage", "Rückerstattungen und Auszahlungen auslösen"],
    ["analytics_view", "Analytics-Dashboards einsehen"],
    ["roles_manage", "Rollen und Berechtigungen verwalten"],
    ["settings_manage", "Plattform-Einstellungen ändern"],
    ["moderation_evidence", "Vertrauliche Fallbeweismittel einsehen"],
  ] as const;
  const permissions = Object.fromEntries(
    await Promise.all(
      permissionRows.map(async ([key, description]) => [key, await db.permission.create({ data: { key, description } })] as const)
    )
  );
  const roleDefs: Array<[string, string, string[]]> = [
    ["SUPER_ADMIN", "Voller Plattformzugriff", permissionRows.map(([k]) => k)],
    ["ACADEMIC_ADMIN", "Curriculum, Zertifikate, Wiederholungen", ["curriculum_edit", "students_view", "teachers_view", "teachers_manage", "retakes_review", "certificates_issue", "certificates_revoke", "reports_view", "analytics_view"]],
    ["TEACHER_MANAGER", "Onboarding, Leistung, Wiederholungen", ["teachers_view", "teachers_manage", "reports_view", "retakes_review", "students_view"]],
    ["SUPPORT_ADMIN", "Support für Lernende", ["students_view"]],
    ["MODERATOR", "Meldungen & Untersuchungen", ["reports_view", "reports_decide", "moderation_evidence", "students_view", "teachers_view"]],
    ["FINANCE_ADMIN", "Zahlungen & Auszahlungen", ["payments_view", "payments_manage", "analytics_view"]],
    ["TEACHER", "Unterrichtet zugewiesene Lektionen", []],
    ["STUDENT", "Lernt auf dem strukturierten Pfad", []],
  ];
  for (const [key, name, perms] of roleDefs) {
    await db.role.create({
      data: { key: key as never, name, description: name, permissions: { create: perms.map((p) => ({ permissionId: permissions[p]!.id })) } },
    });
  }

  // ── Curriculum: Niveaus (CEFR bleibt erhalten) ─────────────────────────────
  const levelDefs: Array<{ code: CefrCode; title: string; description: string }> = [
    { code: "A1", title: "Grundlagen", description: "Arabische Schrift, Laute, Begrüßungen, Zahlen und erste Sätze." },
    { code: "A2", title: "Alltag", description: "Tagesablauf, Essen und Trinken, Einkaufen, Uhrzeit, Reisen und Wege." },
    { code: "B1", title: "Kommunikation", description: "Längere Gespräche, Vergangenheit und Zukunft, Meinungen, Alltagssituationen." },
    { code: "B2", title: "Fortgeschrittene Kommunikation", description: "Medien, Beruf und Studium, Kultur – komplexe Texte und Diskussionen." },
    { code: "C1", title: "Wissenschaft & Beruf", description: "Akademisches und berufliches Arabisch, nuancierter Ausdruck, Medienanalyse." },
    { code: "C2", title: "Beinahe muttersprachliche Beherrschung", description: "Klassische und moderne Texte, idiomatische Präzision, freies Diskutieren." },
  ];
  const levels: Record<string, { id: string }> = {};
  for (let i = 0; i < levelDefs.length; i++) {
    const l = levelDefs[i]!;
    levels[l.code] = await db.level.create({ data: { code: l.code, title: l.title, description: l.description, orderIndex: i + 1 } });
  }

  // ── B2 · Kapitel 1 · Lektion 3 (aktuelle Demo-Lektion) – 20-Fragen-Quiz ────
  const b2ch1l3Quiz: QSpec[] = [
    { skill: "GRAMMAR", prompt: "Welche Form bedeutet „die Universitäten“ (bestimmt, Plural)?", options: ["الْجَامِعَات", "جَامِعَاتٌ", "الْجَامِعَةُ", "فِي الْجَامِعَةِ"], correct: 0, explanation: "Bestimmter weiblicher Plural: der Artikel steht auf beiden Teilen – الْجَامِعَات." },
    { skill: "GRAMMAR", prompt: "Idafa (Anschlusskonstruktion): كِتَابُ ___ = „das Buch des Studenten“. Welche Endung/Form passt?", options: ["الطَّالِبِ", "طَالِبٌ", "الطَّالِبُ", "لِلطَّالِبِ"], correct: 0, explanation: "Das zweite Nomen der Idafa steht im Genitiv ohne Artikel: كِتَابُ الطَّالِبِ." },
    { skill: "GRAMMAR", prompt: "„Sie (Pl. f.) schreiben“ im Präsens heißt:", options: ["يَكْتُبْنَ", "كَتَبْنَ", "نَكْتُبُ", "تَكْتُبُ"], correct: 0, explanation: "3. Person Plural feminin Präsens: يَكْتُبْنَ (yaktubna)." },
    { skill: "GRAMMAR", prompt: "Welcher Satz ist ein Nominalsatz?", options: ["الْمَدِينَةُ كَبِيرَةٌ", "ذَهَبَ إِلَى السُّوقِ", "سَأَدْرُسُ غَدًا", "اُكْتُبْ لَوْ سَمَحْتَ"], correct: 0, explanation: "Ein Nominalsatz beginnt mit einem Nomen: الْمَدِينَةُ كَبِيرَةٌ (Die Stadt ist groß)." },
    { skill: "GRAMMAR", prompt: "Setze ein: أَدْرُسُ كَثِيرًا ___ أُرِيدُ النَّجَاحَ. („…, weil ich Erfolg will.“)", options: ["لِأَنَّنِي", "لَكِنْ", "أَوْ", "حَتَّى"], correct: 0, explanation: "لِأَنَّ = weil; danach folgt ein Akkusativsubjekt: لِأَنَّنِي أُرِيدُ …" },
    { skill: "GRAMMAR", prompt: "Der Dual „zwei Bücher“:", options: ["كِتَابَانِ", "كُتُبٌ", "الْكِتَابَةُ", "كَاتِبَانِ"], correct: 0, explanation: "Dual-Nominativ auf ـانِ: كِتَابَانِ. كُتُبٌ ist der gebrochene Plural." },
    { skill: "GRAMMAR", prompt: "Aktiv oder Passiv? بُنِيَ الْمَصْرَفُ عَامَ ١٩٦٠.", options: ["Passiv („wurde gebaut“)", "Aktiv („er baute“)", "Befehlsform", "Wunschform"], correct: 0, explanation: "Die Damma auf dem ersten Radikal (بُنِيَ) markiert das Passiv." },
    { skill: "GRAMMAR", prompt: "„Obwohl die Technologie nützlich ist…“ – welche Konjunktion?", options: ["رَغْمَ أَنَّ التِّقْنِيَةَ مُفِيدَة", "لِأَنَّ التِّقْنِيَةَ مُفِيدَة", "حَتَّى التِّقْنِيَة مُفِيدَة", "إِذَا التِّقْنِيَة مُفِيدَة"], correct: 0, explanation: "رَغْمَ أَنَّ = obwohl; danach Akkusativsubjekt." },
    { skill: "GRAMMAR", prompt: "Plural von هَذِهِ وَظِيفَةٌ جَدِيدَةٌ („dies ist eine neue Stelle“):", options: ["هَٰذِهِ وَظَائِفُ جَدِيدَةٌ", "هَٰذِهِ وَظِيفَاتٌ جَدِيدَاتٌ", "هَٰذَا وَظَائِفُ جَدِيدَة", "هَٰذِهِ وَظِيفَةٌ قَدِيمَةٌ"], correct: 0, explanation: "وَظِيفَة hat den gebrochenen Plural وَظَائِف; das Adjektiv bleibt im unbestimmten Singular (جَدِيدَةٌ)." },
    { skill: "GRAMMAR", prompt: "Verneinung der Vergangenheit von كَتَبْتُ الرِّسَالَةَ („ich schrieb nicht…“):", options: ["لَمْ أَكْتُبِ الرِّسَالَةَ", "مَا أَكْتُبُ الرِّسَالَة", "لَنْ كَتَبْتُ الرِّسَالَة", "لَا كَتَبْتُ الرِّسَالَة"], correct: 0, explanation: "Verneinte Vergangenheit = لَمْ + Apokopat (Jussiv): لَمْ أَكْتُبْ." },
    { skill: "VOCABULARY", prompt: "Was bedeutet وَظِيفَة؟", options: ["Stelle / Aufgabe", "Universität", "Zeitung", "Reise"], correct: 0, explanation: "وَظِيفَة = Stelle, Anstellung, Aufgabe." },
    { skill: "VOCABULARY", prompt: "„Gesellschaft / Firma“ heißt:", options: ["شَرِكَة", "مَدْرَسَة", "سُوق", "بَنْك"], correct: 0, explanation: "شَرِكَة = Firma, Gesellschaft (Plural: شَرِكَات)." },
    { skill: "VOCABULARY", prompt: "Das Gegenteil von صَعْبٌ (schwierig):", options: ["سَهْلٌ", "جَدِيدٌ", "كَبِيرٌ", "قَرِيبٌ"], correct: 0, explanation: "صَعْب ↔ سَهْل (schwierig ↔ leicht)." },
    { skill: "VOCABULARY", prompt: "„Ich lese die Zeitung jeden Morgen“ – Zeitung =", options: ["صَحِيفَة", "مِرْآة", "مَكْتَبَة", "رِسَالَة"], correct: 0, explanation: "صَحِيفَة = Zeitung." },
    { skill: "VOCABULARY", prompt: "Korrekte Kollokation für „eine Entscheidung treffen“:", options: ["اَتَّخَذَ قَرَارًا", "صَنَعَ فِكْرَةً", "شَرِبَ قَهْوَة", "أَكَلَ قَرَارًا"], correct: 0, explanation: "Feste Wendung: اَتَّخَذَ قَرَارًا (eine Entscheidung „nehmen“)." },
    { skill: "VOCABULARY", prompt: "تَخَصَّصَ فِي bedeutet:", options: ["sich spezialisieren auf", "sich bewerben bei", "sich erinnern an", "sich freuen über"], correct: 0, explanation: "تَخَصَّصَ فِي = sich spezialisieren auf (ein Fachgebiet)." },
    { skill: "READING", prompt: "Warum schreibt Muhammad diese Nachricht?",
      context: "Nachricht der Sprachschule:\n«عَزِيزِي الطَّالِب، نُقْلُ دَوْرَةِ الأَرْبِعَاءِ إِلَى الخَمِيسِ، السَّاعَة السَّادِسَة. يُرْجَى إِرْسَالُ تَأْكِيدٍ قَبْلَ الأَرْبِعَاءِ. مُحَمَّد»\n(Übersetzungshilfe: دَوْرَة = Kurs; يُرْجَى = es wird gebeten)",
      options: ["Um einen Kurs zu verschieben und eine Bestätigung zu erbitten", "Um den Kurs abzusagen", "Um zum Kurs einzuladen", "Um eine Rechnung zu schicken"], correct: 0,
      explanation: "Kerninfos: Verschiebung auf Donnerstag 18 Uhr + Bitte um Bestätigung bis Mittwoch." },
    { skill: "READING", prompt: "Bis wann muss die Bestätigung geschickt werden?",
      context: "«… يُرْجَى إِرْسَالُ تَأْكِيدٍ قَبْلَ الأَرْبِعَاءِ …»",
      options: ["vor Mittwoch", "bis Freitag", "erst nach Donnerstag", "nächste Woche"], correct: 0,
      explanation: "قَبْلَ الأَرْبِعَاءِ = vor Mittwoch." },
    { skill: "READING", prompt: "Was steht NICHT in der Kursbeschreibung?",
      context: "«دَوْرَة اللُّغَة العَرَبِيَّة: حَصْصَانِ فِي الأُسْبُوعِ، وَاجِبَاتٌ أُسْبُوعِيَّةٌ، شَهَادَةٌ فِي النِّهَايَةِ. لَا يُشْتَرَطُ مَعْرِفَةُ الحُرُوفِ.»",
      options: ["Ein Pflicht-Einstufungsgespräch", "Zwei Einheiten pro Woche", "Wöchentliche Hausaufgaben", "Ein Abschlusszertifikat"], correct: 0,
      explanation: "Ein Einstufungsgespräch wird nicht erwähnt – «لَا يُشْتَرَط» sagt sogar: Alphabetkenntnisse sind KEINE Voraussetzung." },
    { skill: "LISTENING", prompt: "Welche Aufgabe übernimmt Frau Khalil laut Durchsage?",
      context: "Transkript: «مُنْذُ اليَوْمِ تَتَوَلَّى الوَزِيرَةُ خَلِيلُ مُتَابَعَةَ الشَرِكَاتِ الدَّوْلِيَّةِ، وَيُسَاعِدُهَا السَّيِّدُ مُوسَى مُنْذُ شُهُورٍ.»",
      options: ["Sie verantwortet internationale Firmen", "Er unterstützt sie seit gestern", "Sie leitet eine Universität", "Er wurde gestern ernannt"], correct: 0,
      explanation: "تَتَوَلَّى = sie übernimmt; Objekt: الشَرِكَات الدَّوْلِيَّة (internationale Unternehmen). مُنْذُ شُهُور = seit Monaten (nicht: seit gestern)." },
  ];

  const b2: ChapterSpec[] = [
    {
      title: "Medien und Gesellschaft",
      titleDe: "الإعلام والمجتمع",
      description: "Nachrichten lesen, soziale Medien diskutieren, Werbung verstehen – die arabische Medienlandschaft.",
      lessons: [
        {
          title: "Nachrichten verstehen", titleDe: "فهم الأخبار",
          summary: "Nachrichtenformate, Schlagzeilen und Quellenangaben in arabischen Medien.",
          objectives: ["Hauptmeldung eines Artikels erkennen", "Quellenangaben verstehen", "Über Nachrichtenquellen sprechen"],
          materials: [
            { type: "reading", title: "Musterartikel: Lokalpolitik", body: "أَعْلَنَ عُمْدَةُ الْمَدِينَةِ أَنَّ مَشْرُوعَ النَّقْلِ الْعَامِّ سَيَبْدَأُ فِي الرَّبِيعِ.\n— Der Bürgermeister kündigte an, dass das Nahverkehrsprojekt im Frühjahr beginnt." },
            { type: "worksheet", title: "Nachrichten-Phrasen", body: "أَعْلَنَ … أنَّ = ankündigen, dass …\nمَصْدَرٌ مُطَّلِعٌ = informierte Quelle\nحَسَبَ التَّقْرِيرِ = laut Bericht" },
          ],
          quiz: [
            { skill: "GRAMMAR", prompt: "Quellenangabe: Laut Bericht ___ die Verhandlungen schwierig. – korrekt?", options: ["حَسَبَ التَّقْرِيرِ، المُفَاوَضَاتُ صَعْبَة", "التقرير سهل", "المفاوضات ذهبت", "لا تقرير"], correct: 0, explanation: "حَسَبَ التَّقْرِيرِ = laut Bericht – typische Nachrichtenformel." },
            { skill: "VOCABULARY", prompt: "„die Schlagzeile“ heißt:", options: ["العُنْوَانُ الرَّئِيسِيُّ", "الحَاشِيَة", "الدَّائِرَة", "الرِّوَايَة"], correct: 0, explanation: "العُنوان الرئيسي = Hauptüberschrift/Schlagzeile." },
            { skill: "GRAMMAR", prompt: "„Man munkelt, er kandidiere nächstes Jahr“ – indirekte Wiedergabe mit زَعَمَ؟", options: ["زَعَمَ أَنَّهُ سَيَتَرَشَّحُ السَّنَةَ القَادِمَة", "قال لا شيء", "ترشّح الآن", "لا انتخاب"], correct: 0, explanation: "زَعَمَ أنَّهُ سَـ… = er behauptet, er werde … (Zukunft in indirekter Rede)." },
            { skill: "READING", prompt: "Kernaussage des Textes?", context: "«تَسْتَخْدِمُ الْمَدِينَةُ طَاقَةَ الشَّمْسِ فِي نِصْفِ مَبَانِيهَا مُنْذُ عَامٍ.»", options: ["Die Stadt nutzt Solarenergie in der Hälfte ihrer Gebäude", "Strompreise steigen", "Kraftwerke werden geschlossen", "Ein Reaktor wird gebaut"], correct: 0, explanation: "طاقة الشمس = Solarenergie; نصف مبانيها = die Hälfte ihrer Gebäude." },
          ],
          homework: { title: "Nachrichtenzusammenfassung", instructions: "Fasse einen kurzen arabischen Nachrichtentext in 60–80 Wörtern auf Deutsch zusammen und notiere zwei arabische Schlüsselwörter mit Harakat.", writingPrompt: "In dem Artikel geht es um…\nSchlüsselwörter: … , …" },
        },
        {
          title: "Soziale Medien im Alltag", titleDe: "وسائل التواصل الاجتماعي",
          summary: "Gewohnheiten, Datenschutz und digitales Wohlbefinden auf Arabisch besprechen.",
          objectives: ["Vor- und Nachteile benennen", "Meinungen höflich formulieren", "Datenschutz-Vokabular nutzen"],
          materials: [{ type: "worksheet", title: "Diskussionsfragen", body: "كَمْ سَاعَةً تَقْضِيهَا يَوْمِيًّا فِي وَسَائِلِ التَّوَاصُلِ؟\nمَا رَأْيُكَ فِي حِمَايَةِ البَيَانَاتِ؟" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "„Viele ärgern sich über Werbung.“ – passendes Verb?", options: ["يَغْضَبُونَ مِنَ الإِعْلَانَات", "يَضْحَكُونَ مِنَ الإعلانات", "يَنَامُونَ عَنِ الإعلانات", "يَسْتَقِيمُونَ الإعلانات"], correct: 0, explanation: "يَغْضَبُ مِنْ = zürnen/ärgern über (mit من)." },
            { skill: "VOCABULARY", prompt: "„der Datenschutz“ heißt:", options: ["حِمَايَةُ البَيَانَات", "النَّسْخُ الاحْتِيَاطِيّ", "الرِّسَائِلُ المُزْعِجَة", "تَسْجِيلُ الخُرُوج"], correct: 0, explanation: "حماية البيانات = Datenschutz (wörtl.: Schutz der Daten)." },
            { skill: "GRAMMAR", prompt: "„Ohne mein Smartphone kann ich mir das Leben kaum ___.“", options: ["أَتَخَيَّل", "أُخَيِّل", "تَخَيَّلَ", "خَيَال"], correct: 0, explanation: "Präsens 1. Person Singular von تَخَيَّلَ: أَتَخَيَّل (ich stelle mir vor)." },
            { skill: "LISTENING", prompt: "Was nervt die Sprecherin?", context: "Transkript: «الَّذِي يُزْعِجُنِي فِعْلًا: أَتَصَفُّحُ عَشْرَ دَقَائِقَ فَأَرَى نَفْسَ الإِعْلَانَاتِ الخَمْسِ تَكْرَارًا.»", options: ["Sich wiederholende Werbung", "Langsames Internet", "Falschnachrichten", "Lange Videos"], correct: 0, explanation: "نفس الإعلانات … تكرارًa = dieselben Anzeigen immer wieder." },
          ],
          homework: { title: "Meinungsbeitrag", instructions: "Schreibe einen Forenkommentar (80–120 arabischen Wörtern, mit Harakat): Sollen Handys an Schulen verboten werden? Nutze mindestens zwei neue Vokabeln.", writingPrompt: "بِرَأْيِي …" },
        },
        {
          title: "Werbung und Konsum", titleDe: "الإعلان والاستهلاك", // aktuelle Demo-Lektion mit 20-Fragen-Quiz
          summary: "Werbesprache analysieren, Produkte vergleichen, Komparativ sicher bilden.",
          objectives: ["Werbestrategien erkennen", "Produkte vergleichen", "Komparativ/Superlativ korrekt verwenden"],
          materials: [{ type: "reading", title: "Werbeanzeigen (Transkripte)", body: "جَدِيد! خَصْمٌ مُزْدَوَجٌ هَذَا الأُسْبُوع!\nأَفْضَلُ جَوْدَة، أَسْعَارٌ أَقَلّ." }],
          quiz: b2ch1l3Quiz, // vollständiges 20-Fragen-Quiz der Demo-Lektion
          homework: { title: "Werbeanalyse", instructions: "Analysiere eine arabische Werbung: Zielgruppe, Botschaft, Spracheffekte (80–120 Wörter, Deutsch mit arabischen Zitaten).", writingPrompt: "Die Werbung richtet sich an…\nArabisches Originalzitat: …" },
        },
        {
          title: "Medienkompetenz und Quellen", titleDe: "الكفاية الإعلامية",
          summary: "Falschmeldungen erkennen, Quellen prüfen, Zweifel präzise äußern.",
          objectives: ["Quellen bewerten", "Zweifel sprachlich genau ausdrücken", "Wahrscheinlichkeit ausdrücken"],
          materials: [{ type: "worksheet", title: "Checkliste Quellencheck", body: "مَنِ الكَاتِبُ؟ – Wer schreibt?\nمَا الأَدِلَّةُ؟ – Welche Belege?\nهَلِ المَعْلُومَةُ حَدِيثَةٌ؟ – Ist die Info aktuell?" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "„Das kann doch nicht stimmen!“ – natürliche Formulierung?", options: ["لَا يُمْكِنُ أَنْ يَكُونَ هَذَا صَحِيحًا!", "هذا صحيح دائمًا", "ربما يكون صحيحًا فقط", "سيكون صحيحًا"], correct: 0, explanation: "لا يمكن أنْ + Präsensstamm drückt Unmöglichkeit aus." },
            { skill: "VOCABULARY", prompt: "„die Quelle“ heißt:", options: ["المَصْدَر", "العُنْوَان", "التَّعْلِيق", "الأَرْشِيف"], correct: 0, explanation: "المصدر = Quelle (grammatikalisch auch: Masdar)." },
            { skill: "GRAMMAR", prompt: "Empfehlung: Man sollte Nachrichten kritisch prüfen.", options: ["يَجِبُ التَّحَقُّقُ مِنَ الأَخْبَارِ بِشَكْلٍ نَقْدِيّ", "يُرِيدُ الأخبار", "يُحِبُّ النقد فقط", "يَتْرُكُ الأخبار"], correct: 0, explanation: "يجب + masdar = man soll/muss (Normformulierung)." },
            { skill: "READING", prompt: "Warum ist der Blogpost fragwürdig?", context: "«الْجَمِيعُ يعرف أنَّ دِرَاسَةً أثبتت ذلك قطعًا (المصدر غير معروف).»", options: ["Keine überprüfbare Quelle", "Zu kurz", "Altes Thema", "Falsche Sprache"], correct: 0, explanation: "المصدر غير معروف = Quelle unbekannt → nicht überprüfbar." },
          ],
          homework: { title: "Fact-Checking-Notiz", instructions: "Wähle eine Behauptung aus sozialen Medien und skizziere auf Deutsch (60–100 Wörter), wie du sie prüfen würdest. Nenne eine arabische Suchphrase.", writingPrompt: "Um diese Behauptung zu prüfen, würde ich…\nArabische Suchphrase: …" },
        },
      ],
    },
    {
      title: "Beruf und Studium",
      titleDe: "العمل والدراسة",
      description: "Bewerbung, Büroalltag, akademisches Arabisch und Fachtexte.",
      lessons: [
        {
          title: "Bewerbung und Lebenslauf", titleDe: "التقديم والسيرة الذاتية",
          summary: "Eine überzeugende arabische Bewerbung strukturieren.",
          objectives: ["Formelles Anschreiben verfassen", "Höflichkeitsregister nutzen", "Erfahrungen beschreiben"],
          materials: [{ type: "worksheet", title: "Anschreiben-Bausteine", body: "السَّيِّدَةُ المحترمة،\nأُقدِّمُ إلَيْكُمْ طلبِي للتقديم على وظيفةِ…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Sehr geehrte Frau Meyer – formelle arabische Anrede?", options: ["السَّيِّدة مَيْر المحترمة", "مرحبًا يا مَيْر", "سلام يا مَيْر", "إلى مَيْر"], correct: 0, explanation: "Formelle Anrede: الـ… المحترمة (die geehrte …)." },
            { skill: "VOCABULARY", prompt: "„der Lebenslauf“ heißt:", options: ["السِّيرة الذَّاتية", "خطاب التقديم", "شهادة الخبرة", "العقد"], correct: 0, explanation: "السيرة الذاتية = Lebenslauf." },
            { skill: "GRAMMAR", prompt: "Ich habe zwei Jahre im Vertrieb gearbeitet – korrekt?", options: ["عَمِلْتُ سَنَتَيْنِ فِي مجالِ البَيْع", "عملت على البيع", "من البيع عملت", "للبيعِ فقط"], correct: 0, explanation: "في مجالِ … = im Bereich … ." },
            { skill: "READING", prompt: "Was wird verlangt?", context: "«المُتَطلَّباتُ: مؤهلٌ منتَهٍ ومهاراتٌ لغويةٌ جيدة.»", options: ["Abgeschlossene Ausbildung + gute Sprachkenntnisse", "Nur ein Studium", "Muttersprache Arabisch", "Drei Referenzen"], correct: 0, explanation: "متطلبات = Anforderungen: مؤهل منتَهٍ + مهارات لغوية." },
          ],
          homework: { title: "Bewerbungsentwurf", instructions: "Verfasse eine kurze Bewerbungs-E-Mail (80–120 arabischen Wörter) für die Beispielanzeige.", writingPrompt: "السَّيِّدة المحترمة،\nأُقدِّمُ إلَيْكُمْ طلبي للتقديم على…" },
        },
        {
          title: "Besprechungen und Büroalltag", titleDe: "الاجتماعات ودوار المكتب",
          summary: "Meetings leiten, diplomatisch widersprechen, Beschlüsse fassen.",
          objectives: ["Tagesordnungspunkte vorstellen", "Diplomatisch widersprechen", "Beschlüsse zusammenfassen"],
          materials: [{ type: "worksheet", title: "Meeting-Phrasen", body: "أُودُ أنْ أُضِيفَ نقطةً…\nمع احترامِ رأيكِ، لكنّ…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Diplomatischer Widerspruch: „Ich stimme weitgehend zu, aber…“?", options: ["أتّفق معك إلى حدٍّ كبير، لكنّ…", "أنت مخطئ تمامًا", "لا أتكلم", "ربما غدًا"], correct: 0, explanation: "أتّفق معك إلى حدٍّ كبير، لكنّ… = ich stimme weitgehend zu, aber…" },
            { skill: "VOCABULARY", prompt: "„die Tagesordnung“ heißt:", options: ["جدول الأعمال", "محضر الاجتماع", "تصويت", "استراحة"], correct: 0, explanation: "جدول الأعمال = Tagesordnung." },
            { skill: "GRAMMAR", prompt: "Wir haben beschlossen, das Projekt zu verschieben – korrekt?", options: ["قرَّرنا أنْ يُؤَجَّلَ المشروع", "قررنا أن المشروع تأجيل", "لتأجيل أنه", "المشروع سيء"], correct: 0, explanation: "قرَّرنا أنْ + Konjunktivähnliche Form: أنْ يؤجَّل المشروع." },
            { skill: "LISTENING", prompt: "Was beschließt das Team?", context: "Transkript: «إذن نتَّفق: الحملة تبدأ في مارس، والميزانية دون تغيير.»", options: ["Kampagne startet im März", "Budget steigt", "Kampagne abgesagt", "Entscheidung vertagt"], correct: 0, explanation: "تبدأ في مارس = startet im März; Budget unverändert." },
          ],
          homework: { title: "Protokollübung", instructions: "Fasse das Beispieltreffen in fünf Stichpunkten zusammen (Deutsch mit arabischen Fachbegriffen).", writingPrompt: "Teilnehmer, Datum, Entscheidungen, Aufgaben, Verantwortliche…" },
        },
        {
          title: "Kommunikation am Arbeitsplatz", titleDe: "التواصل في العمل",
          summary: "E-Mail-Register, Telefonate, konstruktives Feedback.",
          objectives: ["Formell/informell unterscheiden", "Konstruktives Feedback geben", "Missverständnisse klären"],
          materials: [
            { type: "audio", title: "Telefonat mit dem IT-Support (Transkript)", body: "صباح الخير، لديّ مشكلة في تشغيل الجهاز منذ الصباح…" },
            { type: "slides", title: "Feedback-Formeln", body: "Positiv beginnen → Verbesserung vorschlagen → ermutigen\nأبدأ بالإيجابيات ← ثم الاقتراح ← ثم التشجيع" },
          ],
          quiz: [
            { skill: "GRAMMAR", prompt: "Höfliche Bitte im Büro: „Könnten Sie das bitte wiederholen?“", options: ["هل يمكن أن تعيد من فضلك؟", "كرر الآن!", "لم أعد", "سأعيد غدًا"], correct: 0, explanation: "هل يمكن أن + Stamm – besonders höflich." },
            { skill: "VOCABULARY", prompt: "„das Feedback“ heißt:", options: ["التغذية الراجعة", "الاجتماع", "الراتب", "الإجازة"], correct: 0, explanation: "التغذية الراجعة = Feedback (Rückmeldung)." },
            { skill: "GRAMMAR", prompt: "„Ich freue mich auf die Zusammenarbeit.“", options: ["أتشوق للعمل معكم", "أكره العمل", "عملت سابقًا", "لن أعمل"], correct: 0, explanation: "أتشوق لـ = ich freue mich auf." },
            { skill: "LISTENING", prompt: "Was wünscht die Anruferin?", context: "Transkript: «أريد تحديد موعد مقابلة يوم الثلاثاء إذا أمكن.»", options: ["Ein Interview am Dienstag", "Einen Urlaub", "Eine Gehaltserhöhung", "Neue Büromöbel"], correct: 0, explanation: "تحديد موعد مقابلة = Termin für ein Interview festlegen." },
          ],
          homework: {
            title: "Professionelle Feedback-Mail",
            instructions: "Du leitest ein kleines Team. Schreibe eine freundlich-professionelle E-Mail (100–140 arabischen Wörter, mit Harakat) an Kollegin Nadine: Wertschätzung, konkretes Problem (Reports oft zu spät), Lösungsvorschlag, ermutigender Schluss.",
            writingPrompt: "الموضوع: ملاحظة سريعة حول تقاريرك\n\nمرحبًا نادينة،\n…",
          },
        },
        {
          title: "Arbeitsrecht und Betriebskultur", titleDe: "قوانين العمل وبيئة الشركة",
          summary: "Verträge, Urlaubsanspruch, Betriebsrat – Wortschatz der arabischen Arbeitswelt.",
          objectives: ["Vertragsklauseln verstehen", "Rechte und Pflichten diskutieren", "Regeln mit مسdar-Strukturen formulieren"],
          materials: [{ type: "reading", title: "Arbeitsvertrag-Checkliste", body: "فترة التجربة، مدة الإشعار، حق الإجازة…" }],
          quiz: [
            { skill: "VOCABULARY", prompt: "„die Probezeit“ heißt:", options: ["فترة التجربة", "تحليل طبي", "مقابلة", "مدة الإشعار"], correct: 0, explanation: "فترة التجربة = Probezeit." },
            { skill: "GRAMMAR", prompt: "Überstunden müssen abgebaut werden – typische Normformulierung?", options: ["يجب تعويض ساعات العمل الإضافية", "يعوضونها كل يوم", "تعوض", "قد تعوَّضت سابقًا فقط"], correct: 0, explanation: "يجب + masdar (genitivisch): تعويض … – so stehen Regeln in Verträgen." },
            { skill: "GRAMMAR", prompt: "Der Betriebsrat wird einbezogen – Passiv Präsens?", options: ["يُؤخذ بمجلس العمل بعين الاعتبار", "أخذوه به", "خذ بالاعتبار!", "كان مأخوذًا فقط"], correct: 0, explanation: "يؤخذ به … بعين الاعتبار = wird berücksichtigt." },
            { skill: "READING", prompt: "Wie lang ist die Kündigungsfrist?", context: "«يمكن إنهاء العقد بمدة إشعار ثلاثة أشهر.»", options: ["drei Monate", "drei Wochen", "zum Monatsende", "sechs Monate"], correct: 0, explanation: "ثلاثة أشهر = drei Monate." },
          ],
          homework: { title: "Vertragsklauseln", instructions: "Erkläre zwei Klauseln des Beispielvertrags in eigenen Worten (Deutsch, mit arabischen Fachbegriffen).", writingPrompt: "Klausel 1 (فترة التجربة) bedeutet…" },
        },
      ],
    },
    {
      title: "Kultur und Geschichte",
      titleDe: "الثقافة والتاريخ",
      description: "Moderne Literatur, historische Texte, Sprichwörter und Dialekte im Vergleich.",
      lessons: [
        {
          title: "Moderne arabische Literatur", titleDe: "الأدب العربي الحديث",
          summary: "Kurzprosa und Poesie – von Darwīš bis zur Gegenwart – erschließen.",
          objectives: ["Metaphern deuten", "Literarisches Register erkennen", "Interpretationen begründen"],
          materials: [{ type: "reading", title: "Gedichtauszug (Darwīš)", body: "«على هذه الأرض ما يستحق الحياة»\n— Auf dieser Erde gibt es, was des Lebens wert ist." }],
          quiz: [
            { skill: "VOCABULARY", prompt: "„das Gedicht“ heißt:", options: ["القصيدة", "الرواية", "المقالة", "المسرحية"], correct: 0, explanation: "القصيدة = Gedicht." },
            { skill: "READING", prompt: "Wovon handelt die Zeile «على هذه الأرض ما يستحق الحياة»?", options: ["Von dem, was des Lebens wert ist", "Von einer Reise", "Von einem Markt", "Von einem Vertrag"], correct: 0, explanation: "ما يستحق الحياة = was des Lebens wert ist." },
            { skill: "GRAMMAR", prompt: "Relativsatz الكتاب الذي قرأتُه: welche Funktion hat das angehängte ـه?", options: ["Objekt-Resumptivpronomen", "Subjekt", "Possessiv 2. Person", "Nur Schönheit"], correct: 0, explanation: "Das ـه nimmt das Objekt wieder auf (resumptives Pronomen)." },
            { skill: "LISTENING", prompt: "Welchen Tonfall nennt der Referent zuerst?", context: "Transkript: «أولًا: نبرة الحنين، ثم الصورة البصرية القوية.»", options: ["Wehmut", "Ironie", "Wut", "Neutralität"], correct: 0, explanation: "نبرة الحنين = Ton der Wehmut (zuerst genannt)." },
          ],
          homework: { title: "Textinterpretation", instructions: "Interpretiere den Gedichtauszug in 90–130 Wörtern (Deutsch); zitiere zweimal arabisch.", writingPrompt: "In diesem Auszug bedeutet…\nZitat 1: …\nZitat 2: …" },
        },
        {
          title: "Historische Texte verstehen", titleDe: "فهم النصوص التاريخية",
          summary: "Klassische Formen, Datumsangaben und Chroniken lesen.",
          objectives: ["Klassische Wendungen erkennen", "Chronologien wiedergeben", "Akkusativ der Dauer nutzen"],
          materials: [{ type: "reading", title: "Chronikauszug (Ibn Battūta)", body: "«ثم انتقلت إلى مدينة دمشق، وأقامت فيها أشهرًا…»" }],
          quiz: [
            { skill: "VOCABULARY", prompt: "„die Stadt“ heißt:", options: ["المدينة", "القرية", "الحي", "الشارع"], correct: 0, explanation: "المدينة = die Stadt." },
            { skill: "GRAMMAR", prompt: "ثُمَّ am Satzanfang bedeutet:", options: ["danach / sodann", "deshalb", "aber", "damit"], correct: 0, explanation: "ثم = daraufhin/sodann (chronologisch)." },
            { skill: "READING", prompt: "Wie lange blieb der Reisende?", context: "«وأقامت فيها أشهرًا»", options: ["monatelang", "genau ein Jahr", "zwei Tage", "unbekannt"], correct: 0, explanation: "أقام … أشهرًا = er blieb monatelang (Akkusativ der Dauer)." },
            { skill: "LISTENING", prompt: "Was kommt nach dem Vortrag?", context: "Ansage: «بعد المحاضرة ستكون هناك أسئلة، ثم استراحة قصيرة.»", options: ["Fragen, dann Pause", "Pause, dann Fragen", "nur Pause", "sofort der nächste Vortrag"], correct: 0, explanation: "أسئلة ثم استراحة = Fragen, dann Pause." },
          ],
          homework: { title: "Zeitleiste", instructions: "Erstelle eine Zeitleiste mit fünf Stationen zur Reise Ibn Battūtas – Deutsch mit arabischen Ortsnamen.", writingPrompt: "1. Tanger — …" },
        },
        {
          title: "Sprichwörter und Redewendungen", titleDe: "الأمثال والتعبيرات",
          summary: "Kulturell geprägte Wendungen verstehen und situationsgerecht verwenden.",
          objectives: ["Sprichwörter deuten", "Deutsche Entsprechungen finden", "Register beachten"],
          materials: [{ type: "worksheet", title: "Top-Sprichwörter", body: "الصبر مفتاح الفرج. — Geduld öffnet jede Tür.\nالقرد في عين أمه غزال. — Jedes Kind ist den Eltern schön." }],
          quiz: [
            { skill: "VOCABULARY", prompt: "الصبر مفتاح الفرج wörtlich: „Geduld ist der Schlüssel ___“.", options: ["der Erleichterung", "des Hauses", "des Buches", "des Marktes"], correct: 0, explanation: "الفرج = Erleichterung/Rettung; Bild: Geduld öffnet." },
            { skill: "GRAMMAR", prompt: "Im Sprichwort القرد في عين أمه غزال ist غزال das:", options: ["Prädikat (Nominalsatz)", "Subjekt", "Genitivattribut", "Imperativ"], correct: 0, explanation: "Thema in … Prädikat = Nominalsatz-Struktur." },
            { skill: "VOCABULARY", prompt: "Welche Wendung passt zu „zum Schluss“ in einer Rede?", options: ["وفي ختام", "في البداية", "بالمناسبة", "على فكرة"], correct: 0, explanation: "وفي ختام = zum Abschluss." },
            { skill: "READING", prompt: "Sinngemäße Bedeutung von: Der Mensch steht auf der Stufe seines Ehrgeizes (المرء على قدر همته)?", options: ["Menschen erreichen, wozu ihr Ehrgeiz reicht", "Männer reisen viel", "Alle sind gleich", "Hochmut fällt"], correct: 0, explanation: "همة = Ehrgeiz/Ambition – klassische Maxime." },
          ],
          homework: { title: "Sprichwort-Miniessay", instructions: "Wähle ein arabisches Sprichwort, erkläre es und finde eine deutsche Entsprechung (80–120 Wörter).", writingPrompt: "Das Sprichwort … bedeutet…\nDeutsche Entsprechung: …" },
        },
        {
          title: "Dialekte im Vergleich", titleDe: "اللهجات بالمقارنة",
          summary: "Ägyptisch, Levantinisch und Golf-Arabisch neben Hocharabisch einordnen.",
          objectives: ["Dialektmerkmale hören", "Register situationsgerecht wählen", "Unterschiede erklären"],
          materials: [{ type: "worksheet", title: "Vergleichstabelle", body: "Hocharabisch: ماذا تفعل الآن؟\nÄgyptisch: بتعمل إيه دلوقتي؟\nLevantinisch: شو عم تعمل هلّق؟" }],
          quiz: [
            { skill: "LISTENING", prompt: "بتعمل إيه؟ gehört zu welchem Dialekt?", options: ["Ägyptisch", "Marokkanisch", "Klassisch", "Golf-Arabisch"], correct: 0, explanation: "بـ-Präfix + إيه = charakteristisch ägyptisch." },
            { skill: "VOCABULARY", prompt: "شو („was“) ist typisch für:", options: ["Levantinisches Arabisch", "Hocharabisch", "Tunesisch", "Omanisches Arabisch"], correct: 0, explanation: "شو statt ماذا = levantinisch." },
            { skill: "GRAMMAR", prompt: "In welchem Kontext ist Hocharabisch (فصحى) die richtige Wahl?", options: ["Nachrichtenmeldung", "Chat mit Freunden", "Plaudern auf der Familienfeier", "Comedy-Sketch"], correct: 0, explanation: "Nachrichten/Schriftliches → فصحى." },
            { skill: "LISTENING", prompt: "Welche Aussage stimmt laut Transkript?", context: "Transkript: «الفصحى مفهومة من المغرب إلى العراق، لكن اللهجات تختلف كثيرًا بين البلدان.»", options: ["فصحى wird überall verstanden, Dialekte unterscheiden sich stark", "Alle Dialekte sind identisch", "فصحى versteht niemand", "Es gibt nur drei Dialekte"], correct: 0, explanation: "مفهومة من المغرب إلى العراق + تختلف كثيرًا." },
          ],
          homework: { title: "Dialekt-Steckbrief", instructions: "Wähle einen arabischen Dialekt und stelle ihn kurz vor (80–120 Wörter): Verbreitung, Besonderheiten, ein Vergleichsbeispiel mit Hocharabisch.", writingPrompt: "Der Dialekt … wird gesprochen in…" },
        },
      ],
    },
  ];

  function minimalLessons(themeTitle: string, n: number): LessonSpec[] {
    return Array.from({ length: n }, (_, i) => ({
      title: `${themeTitle} — Einheit ${i + 1}`,
      titleDe: `${themeTitle} ${i + 1}`,
      summary: "Wiederholungseinheit des vorherigen Niveaus.",
      objectives: ["Kernstrukturen festigen", "Wortschatz erweitern"],
      materials: [],
    }));
  }
  const a1: ChapterSpec[] = [
    {
      title: "Das arabische Alphabet",
      titleDe: "الحروف العربية",
      description: "Die 28 Buchstaben, ihre Formen und Laute – das Fundament des Arabischen.",
      lessons: [
        {
          title: "Die ersten Buchstaben", titleDe: "الحروف الأولى",
          summary: "Alif, Bāʾ, Tāʾ, Thāʾ erkennen, aussprechen und schreiben.",
          objectives: ["Die ersten vier Buchstaben erkennen", "Grundlaute korrekt aussprechen", "Isolierte Formen schreiben"],
          materials: [{ type: "worksheet", title: "Schreibübungen (arabisch)", body: "ا ← ب ← ت ← ث\nأَ بَ تَ ثَ" }],
          quiz: [
            { skill: "VOCABULARY", prompt: "Welcher Buchstabe ist das? ب", options: ["Bāʾ", "Nūn", "Yāʾ", "Mīm"], correct: 0, explanation: "ب = Bāʾ, gesprochen wie ‚b'." },
            { skill: "LISTENING", prompt: "Welcher Laut passt zu ت؟", options: ["t (weich)", "d", "s (emphatisch)", "kh"], correct: 0, explanation: "ت = weiches t." },
            { skill: "GRAMMAR", prompt: "Arabisch wird geschrieben von …", options: ["rechts nach links", "links nach rechts", "oben nach unten", "beliebig"], correct: 0, explanation: "Arabisch verläuft immer rechtsnachlinks." },
            { skill: "READING", prompt: "Welches Wort enthält den Buchstaben ب?", options: ["بَاب (Tür)", "مَاء (Wasser)", "نُور (Licht)", "قَلْب (Herz)"], correct: 0, explanation: "بَاب beginnt mit ب." },
          ],
          homework: { title: "Schreibübung", instructions: "Schreibe die vier Buchstaben ا ب ت ث jeweils fünfmal – von Hand oder digital (arabische Tastatur).", writingPrompt: "ا ب ت ث\n…" },
        },
        {
          title: "Buchstabenformen", titleDe: "أشكال الحروف",
          summary: "Anfangs-, Mittel-, End- und isolierte Form verstehen.",
          objectives: ["Vier Positionen jeder Form unterscheiden", "Verbundene Wörter lesen", "Eigene Namen umschriftlich erkennen"],
          materials: [{ type: "worksheet", title: "Formentabelle", body: "بـ ـبـ ـب ب\nBeispiel: بَاب = بـ + ـا + ـب" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Wie viele Positionsformen hat ein verbindender Buchstabe wie ب؟", options: ["vier", "zwei", "eine", "sechs"], correct: 0, explanation: "Anfangs-, Mittel-, End- und isolierte Form." },
            { skill: "VOCABULARY", prompt: "Welcher Buchstabe VERBINDET nicht nach links?", options: ["د", "ب", "ت", "ن"], correct: 0, explanation: "د (und ا ر ز و …) verbinden nur nach rechts." },
            { skill: "READING", prompt: "Lies: بِنْت – was bedeutet es?", options: ["Mädchen / Tochter", "Sohn", "Haus", "Tür"], correct: 0, explanation: "بِنْت = Mädchen/Tochter." },
            { skill: "LISTENING", prompt: "Welches Wort hörst du: كِتَاب؟", options: ["Buch", "Stuhl", "Fenster", "Tisch"], correct: 0, explanation: "كِتَاب = Buch." },
          ],
          homework: { title: "Formen-Übung", instructions: "Zerlege drei arabische Wörter aus der Lektion in ihre Buchstabenformen.", writingPrompt: "بَاب = …\n…" },
        },
        {
          title: "Kurze und lange Vokale", titleDe: "الحركات والمدود",
          summary: "Harakat (Fatha/Kasra/Damma) und Langvokale unterscheiden die Bedeutung!",
          objectives: ["Die drei Harakat sicher lesen", "Langvokale von Kurzen unterscheiden", "Minimale Wortpaare hören"],
          materials: [{ type: "worksheet", title: "Minimalpaare", body: "كَتَبَ (er schrieb) ↔ كَتْب\nجَلَسَ (er saß)\nبَاب (Tür) ↔ بْ" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Was bewirken die drei Zeichen ـَ ـُ ـِ im Arabischen?", options: ["Kurzvokale markieren", "Satzzeichen", "Frage-Wörter", "Plural"], correct: 0, explanation: "Fatha/Damma/Kasra = kurze Vokale a/u/i." },
            { skill: "LISTENING", prompt: "Unterschied قَلْ / قَالْ – welcher Vokal ist lang?", options: ["ا in قَالْ", "keiner", "beide", "unhörbar"], correct: 0, explanation: "Alif = Langvokal ā." },
            { skill: "VOCABULARY", prompt: "Was bedeutet شُكْرًا؟", options: ["Danke", "Bitte", "Tschüss", "Entschuldigung"], correct: 0, explanation: "شكرًا = Danke." },
            { skill: "READING", prompt: "Welches Wort hat eine Damma?", options: ["كُتُب", "كِتَاب", "سَمَك", "بَاب"], correct: 0, explanation: "كُتُب trägt zwei Dammas." },
          ],
          homework: { title: "Harakat-Diktat", instructions: "Vokalisiere fünf kurze Wörter mit Harakat (per arabischer Tastatur).", writingPrompt: "كتب → كَتَبَ\n…" },
        },
        {
          title: "Begrüßungen und Vorstellen", titleDe: "التحيات والتعريف",
          summary: "مرحبا، السلام عليكم، اسمي… – erste Gespräche führen.",
          objectives: ["Sich begrüßen", "Sich vorstellen", "Nach dem Befinden fragen"],
          materials: [{ type: "dialogue", title: "Erstes Gespräch", body: "السلام عليكم! – Wa ʿalaykum as-salām!\nمَا اسْمُكَ؟ – Ismī Lēnā." }],
          quiz: [
            { skill: "VOCABULARY", prompt: "„Ich heiße…“ auf Arabisch:", options: ["اسْمِي …", "أنا في…", "هذا…", "من أنت؟"], correct: 0, explanation: "اسمي … = ich heiße … ." },
            { skill: "GRAMMAR", prompt: "Antwort auf السلام عليكم؟", options: ["وعليكم السلام", "شكرًا", "أفعل", "لا"], correct: 0, explanation: "Standarderwidung: وعليكم السلام." },
            { skill: "VOCABULARY", prompt: "كَيْفَ الحَال؟ bedeutet:", options: ["Wie geht's?", "Woher kommst du?", "Was machst du?", "Wann kommen wir?"], correct: 0, explanation: "كيف الحال = Wie geht es dir/Ihnen?" },
            { skill: "LISTENING", prompt: "Jemand sagt مساء الخير – passt dazu:", options: ["Guten Abend", "Guten Morgen", "Auf Wiedersehen", "Prost"], correct: 0, explanation: "مساء الخير = guten Abend." },
          ],
          homework: { title: "Kurzes Selbstporträt", instructions: "Stelle dich auf Arabisch vor (3–4 Sätze, mit Harakat): Name, Herkunft, Sprachen.", writingPrompt: "اسمي …\nأنا من ألمانيا.\n…" },
        },
      ],
    },
    {
      title: "Erste Wörter und Zahlen",
      titleDe: "أول الكلمات والأرقام",
      description: "Zahlen, Länder, Nationalitäten, Familie und häufige Fragen.",
      lessons: minimalLessons("Erste Wörter", 4),
    },
    {
      title: "Erste Sätze",
      titleDe: "أول الجمل",
      description: "Nominalsätze, einfache Fragen, häufige Wörter.",
      lessons: minimalLessons("Erste Sätze", 4),
    },
  ];

  const a2: ChapterSpec[] = [
    { title: "Tagesablauf", titleDe: "اليوم الدراسي", description: "Rückblick A2.", lessons: minimalLessons("Tagesablauf", 2) },
    { title: "Einkaufen & Essen", titleDe: "التسوق والطعام", description: "Rückblick A2.", lessons: minimalLessons("Einkaufen", 2) },
    { title: "Unterwegs", titleDe: "في الطريق", description: "Rückblick A2.", lessons: minimalLessons("Reisen", 2) },
  ];
  const b1: ChapterSpec[] = [
    { title: "Alltagssituationen", titleDe: "مواقف الحياة اليومية", description: "Rückblick B1.", lessons: minimalLessons("Alltag", 2) },
    { title: "Erzählen & Berichten", titleDe: "الحكي والوصف", description: "Rückblick B1.", lessons: minimalLessons("Erzählen", 2) },
    { title: "Meinungen", titleDe: "الآراء", description: "Rückblick B1.", lessons: minimalLessons("Meinungen", 2) },
  ];

  async function attachQuiz(ownerType: "LESSON" | "CHAPTER_EXAM" | "LEVEL_EXAM", lessonId: string | null, specs: QSpec[], passScore: number) {
    const quiz = await db.quiz.create({ data: { ownerType, lessonId, passScore } });
    for (let i = 0; i < specs.length; i++) {
      const q = specs[i]!;
      await db.question.create({
        data: {
          quizId: quiz.id, skill: q.skill, prompt: q.prompt, context: q.context ?? null,
          explanation: q.explanation, points: 1, orderIndex: i + 1,
          options: { create: q.options.map((text, oi) => ({ text, isCorrect: oi === q.correct, orderIndex: oi })) },
        },
      });
    }
    return quiz;
  }

  async function createCurriculum(code: CefrCode, chapters: ChapterSpec[], withAssessments: boolean) {
    const levelId = levels[code]!.id;
    const createdChapters: Array<{ id: string; lessons: Array<{ id: string }> }> = [];
    for (let ci = 0; ci < chapters.length; ci++) {
      const c = chapters[ci]!;
      const chapter = await db.chapter.create({
        data: { levelId, title: c.title, titleDe: c.titleDe, description: c.description, orderIndex: ci + 1 },
      });
      const createdLessons: Array<{ id: string }> = [];
      for (let li = 0; li < c.lessons.length; li++) {
        const l = c.lessons[li]!;
        const lesson = await db.lesson.create({
          data: {
            chapterId: chapter.id,
            title: l.title, titleDe: l.titleDe, summary: l.summary,
            durationMinutes: 50, orderIndex: li + 1, requiresHomework: true,
            objectives: { create: l.objectives.map((text, i) => ({ text, orderIndex: i })) },
            materials: { create: l.materials.map((m, i) => ({ type: m.type, title: m.title, body: m.body ?? null, orderIndex: i })) },
          },
        });
        createdLessons.push({ id: lesson.id });
        if (withAssessments && l.quiz?.length) await attachQuiz("LESSON", lesson.id, l.quiz, 70);
        if (withAssessments && l.homework) {
          await db.homework.create({
            data: {
              lessonId: lesson.id, title: l.homework.title,
              instructions: l.homework.instructions, writingPrompt: l.homework.writingPrompt,
              exercises: [
                { id: "ex1", prompt: "Übersetze ins Arabische (mit Harakat): „Danke schön!“", sampleAnswer: "شُكْرًا جَزِيلًا" },
                { id: "ex2", prompt: "Bilde einen Nominalsatz mit مَدِينَة (Stadt) und جَمِيلَة (schön).", sampleAnswer: "الْمَدِينَةُ جَمِيلَةٌ" },
              ],
              maxScore: 100,
            },
          });
        }
      }
      if (withAssessments) {
        const examQs: QSpec[] = c.title === "Medien und Gesellschaft"
          ? [
              { skill: "GRAMMAR", prompt: "„Dieses Angebot ist günstiger als das andere.“ – korrekter Komparativ?", options: ["أَرْخَصُ مِنْ", "الأَرْخَصُ", "رَخِيصٌ جِدًّا", "مِثْلُ الرَّخِيص"], correct: 0, explanation: "Komparativ im أفعل-Muster + مِنْ." },
              { skill: "VOCABULARY", prompt: "„der Rabatt“ heißt:", options: ["خَصْم", "إِيصَال", "مَارِكَة", "رَفّ"], correct: 0, explanation: "خصم = Rabatt." },
              { skill: "GRAMMAR", prompt: "Logisch korrekt: „Kaufen Sie jetzt, ___ das Angebot endet!“", options: ["قَبْلَ أَنْ يَنْتَهِيَ العَرْض", "بَعْدَ انْتِهَائه", "بِدُونِ عَرْض", "مَعَ العَرْض"], correct: 0, explanation: "قبل أنْ = bevor … ." },
              { skill: "READING", prompt: "Welcher Appell FEHLT in dieser Umfrage?", context: "«اسْتطلاع الرأي: العملاء يريدون الشحنة السريعة والأأسعار المناسبة.»", options: ["Umweltappell", "Geschwindigkeit", "Preis", "Bequemlichkeit"], correct: 0, explanation: "Umwelt wird nicht genannt." },
              { skill: "GRAMMAR", prompt: `Thema ${c.titleDe}: Der Bericht muss bis Freitag fertiggestellt werden – typische Normformulierung?`, options: ["يَجِبُ إنجازُ التقريرِ قبل الجمعة", "أنجزوا التقرير!", "التقرير جميل", "لم يُنجز بعد"], correct: 0, explanation: "يجب + masdar." },
              { skill: "VOCABULARY", prompt: `Welches Wort gehört thematisch zu ${c.title}?`, options: ["Wort aus dem Kapitelwortschatz", "الزَّرافة", "النَّحلة", "السَّحاب"], correct: 0, explanation: "Themenwort." },
              { skill: "GRAMMAR", prompt: "Formeller Vorschlag: „Man könnte ein Treffen vereinbaren.“", options: ["يُمكن أنْ نتَّفق على اجتماع", "لا اجتماع", "كان الاجتماع", "متى الاجتماع؟"], correct: 0, explanation: "يمكن أنْ – höflich-neutral." },
              { skill: "READING", prompt: "Kernaussage?", context: `Kurztext zu ${c.titleDe}: التَّطْوِير إيجابيٌّ في الإجمال، وإن كان بقيود.`, options: ["Positiv mit Einschränkungen", "Negativ", "Neutral ohne Wertung", "Unklar"], correct: 0, explanation: "إيجابي … وإن كان بقيود." },
              { skill: "LISTENING", prompt: "Was wird angekündigt?", context: "Transkript: «في نهاية الوحدة سيكون هناك اختبار قصير.»", options: ["Ein kurzer Test", "Ein Feiertag", "Ein Buch", "Nichts"], correct: 0, explanation: "اختبار قصير." },
              { skill: "GRAMMAR", prompt: "Höfliche Bitte: Könnten Sie das erläutern?", options: ["هَلْ من الممكن أنْ توضِّح؟", "وضِّح الآن!", "لا توضح", "شرحتُ"], correct: 0, explanation: "هل من الممكن أنْ – höflich." },
            ]
          : [
          { skill: "GRAMMAR", prompt: `Thema ${c.titleDe}: Der Bericht muss bis Freitag fertiggestellt werden – typische Normformulierung?`, options: ["يَجِبُ إنجازُ التقريرِ قبل الجمعة", "أنجزوا التقرير!", "التقرير جميل", "لم يُنجز بعد"], correct: 0, explanation: "يجب + masdar = verbindliche Regelformulierung." },
          { skill: "VOCABULARY", prompt: `Welches Wort gehört thematisch zu ${c.title}?`, options: ["Wort aus dem Kapitelwortschatz", "الزَّرافة", "النَّحلة", "السَّحاب"], correct: 0, explanation: "Themenwort aus dem Kapitel." },
          { skill: "GRAMMAR", prompt: "Formeller Vorschlag: „Man könnte ein Treffen vereinbaren.“", options: ["يُمكن أنْ نتَّفق على اجتماع", "لا اجتماع", "كان الاجتماع", "متى الاجتماع؟"], correct: 0, explanation: "يمكن أنْ + Präsensstamm – höflich-neutral." },
          { skill: "READING", prompt: "Kernaussage?", context: `Kurztext zu ${c.titleDe}: التَّطْوِير إيجابيٌّ في الإجمال، وإن كان بقيود.`, options: ["Positiv mit Einschränkungen", "Negativ", "Neutral ohne Wertung", "Unklar"], correct: 0, explanation: "إيجابي … وإن كان بقيود = positiv, wenn auch mit Einschränkungen." },
          { skill: "LISTENING", prompt: "Was wird angekündigt?", context: "Transkript: «في نهاية الوحدة سيكون هناك اختبار قصير.»", options: ["Ein kurzer Test", "Ein Feiertag", "Ein Buch", "Nichts"], correct: 0, explanation: "اختبار قصير = kurzer Test." },
          { skill: "GRAMMAR", prompt: "Höfliche Bitte: Könnten Sie das erläutern?", options: ["هَلْ من الممكن أنْ توضِّح؟", "وضِّح الآن!", "لا توضح", "شرحتُ"], correct: 0, explanation: "هل من الممكن أنْ … – besonders höflich." },
        ];
        const examQuiz = await attachQuiz("CHAPTER_EXAM", null, examQs, 70);
        await db.chapterExam.create({ data: { chapterId: chapter.id, quizId: examQuiz.id, passScore: 70 } });
      }
      createdChapters.push({ id: chapter.id, lessons: createdLessons });
    }
    if (withAssessments) {
      const finalQs: QSpec[] = [
        { skill: "GRAMMAR", prompt: "Er hätte das Problem früher melden müssen.", options: ["كان عليه أنْ يبلِّغ عن المشكلة مبكرًا", "سيبلّغ غدًا", "يبلّغ دائمًا", "لا يبلّغ"], correct: 0, explanation: "كان عليه أنْ + Stamm = hätte … sollen/müssen." },
        { skill: "VOCABULARY", prompt: "„die Voraussetzung / Bedingung“ heißt:", options: ["الشرط", "التأمين", "التوقيع", "الفاتورة"], correct: 0, explanation: "الشرط = Bedingung/Voraussetzung." },
        { skill: "GRAMMAR", prompt: "Es wurde diskutiert, ob das Budget erhöht wird.", options: ["نوقش ما إذا ستُرفع الميزانية", "نوقشت ميزانية جميلة", "رفعوا الميزانية قطعًا", "لا نقاش"], correct: 0, explanation: "Indirekte Frage mit ما إذا / هل." },
        { skill: "READING", prompt: "Tonfall des Textes?", context: "«التدابير نجحت جزئيًّا — الاختراق يبدو مختلفًا.»", options: ["Kritisch-skeptisch", "Begeistert", "Rein sachlich", "Humorvoll"], correct: 0, explanation: "جزئيًّa + Kontrast im zweiten Satz = kritisch-skeptisch." },
        { skill: "GRAMMAR", prompt: "Haben Sie den Vertrag bereits unterschrieben?", options: ["هل وقَّعت العقد بعدُ؟", "ستوقّع غدًا؟", "من وقّع؟", "لا عقد"], correct: 0, explanation: "Perfekt + بعدُ = bereits/schon." },
        { skill: "LISTENING", prompt: "Was folgt auf die Präsentation?", context: "Ansage: «بعد العرض ستكون هناك أسئلة، ثم ننتقل للفترة.»", options: ["Fragen, dann Pause", "Pause, dann Fragen", "Nur Pause", "Sofort nächster Redner"], correct: 0, explanation: "أسئلة ثم فترة = Fragen, dann Pause." },
        { skill: "GRAMMAR", prompt: "Ich arbeite seit drei Jahren in diesem Team.", options: ["أعمل في هذا الفريق منذ ثلاث سنوات", "عملت قبل ثلاث سنوات فقط", "سأعمل ثلاث سنوات", "لا أعمل هنا"], correct: 0, explanation: "Dauer bis jetzt: منذ + Zeitangabe." },
        { skill: "VOCABULARY", prompt: "Gegenteil von „die Mehrheit“ (الأغلبية):", options: ["الأقلية", "البطولة", "الرسالة", "الكثرة"], correct: 0, explanation: "الأغلبية ↔ الأقلية (Mehrheit ↔ Minderheit)." },
        { skill: "GRAMMAR", prompt: "Der Vorschlag wurde abgelehnt.", options: ["رُفِضَ الاقتراح", "رفضوا اقتراحًا يومًا", "اقتراحٌ مرفوضٌ دائمًا فقط", "سيقترح"], correct: 0, explanation: "Passiv: رُفِضَ (Damma/Kasra-Folge im Stamm)." },
        { skill: "READING", prompt: "Worum geht es primär?", context: "Text über Homeoffice: الإنتاجية والتواصل والجانب القانوني بالمقارنة.", options: ["Remote-Arbeit im Überblick", "Büromöbel", "Nur Pendelzeiten", "Firmengeschichte"], correct: 0, explanation: "Homeoffice-Themen." },
        { skill: "GRAMMAR", prompt: "Je öfter man übt, desto leichter wird es.", options: ["كلّما تدرّبت أكثر أصبح الأمر أسهل", "تدريب واحد كافٍ", "التمرين صعب دائمًا", "لا تمارين"], correct: 0, explanation: "كلّما-Korrelation für je…desto." },
        { skill: "VOCABULARY", prompt: "„vereinbaren“ ≈ ", options: ["رتّب موعدًا / اتّفق على", "رفض نهائيًا", "ألغى للأبد", "تجاهل"], correct: 0, explanation: "رتّب/اتفق على = arrange/agree on." },
      ];
      const finalQuiz = await attachQuiz("LEVEL_EXAM", null, finalQs, 70);
      await db.levelExam.create({ data: { levelId, quizId: finalQuiz.id, passScore: 70, proctoringRequired: true } });
    }
    return createdChapters;
  }

  // Historie: A2 → B1 abgeschlossen; A1 & B2 vollständige Curricula; C1/C2 Shells
  const b2Chapters = await createCurriculum("B2", b2, true);
  const b1Chapters = await createCurriculum("B1", b1, true);
  const a2Chapters = await createCurriculum("A2", a2, true);
  const a1Chapters = await createCurriculum("A1", a1, true);

  // ── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo1234!", 10);
  async function mkUser(u: { name: string; email: string; roleType: Parameters<typeof db.user.create>[0]["data"]["roleType"]; color: string }) {
    return db.user.create({ data: { name: u.name, email: u.email, passwordHash, roleType: u.roleType, avatarColor: u.color } });
  }

  // Lernende (Deutschsprachige, die Arabisch lernen) – E-Mails bleiben kompatibel zur Doku
  const lena = await mkUser({ name: "Lena Schmidt", email: "lena.schmidt@demo.deutschpath.dev", roleType: "STUDENT", color: "#4338CA" });
  const max = await mkUser({ name: "Max Weber", email: "max.weber@demo.deutschpath.dev", roleType: "STUDENT", color: "#0F766E" });
  const jonas = await mkUser({ name: "Jonas Brandt", email: "jonas.brandt@demo.deutschpath.dev", roleType: "STUDENT", color: "#B45309" });

  await db.studentProfile.createMany({
    data: [
      { userId: lena.id, ageRange: "25–34", country: "Deutschland", nativeLanguage: "Deutsch", learningGoal: "Familie und Freunde", expectedLevel: "A1", preferredStudyTimes: "3–5 Std. pro Woche", studyPreference: "balanced", alphabetFamiliarity: "basic", onboardedAt: daysAgo(220) },
      { userId: max.id, ageRange: "18–24", country: "Österreich", nativeLanguage: "Deutsch", learningGoal: "Studium", expectedLevel: "A2", preferredStudyTimes: "6–10 Std. pro Woche", studyPreference: "focused", alphabetFamiliarity: "basic", onboardedAt: daysAgo(60) },
      { userId: jonas.id, ageRange: "35–44", country: "Schweiz", nativeLanguage: "Deutsch", learningGoal: "Beruf", expectedLevel: "A1", preferredStudyTimes: "1–2 Std. pro Woche", studyPreference: "relaxed", alphabetFamiliarity: "none", onboardedAt: daysAgo(20) },
    ],
  });

  // Arabisch-Lehrkräfte (8 genehmigt + 1 Pipeline-Bewerber)
  const teacherSpecs = [
    { name: "Omar El-Sayed", email: "omar.elsayed@demo.deutschpath.dev", color: "#4338CA", rank: "SENIOR", headline: "Arabischlehrer aus Kairo – 12 Jahre Erfahrung mit deutschsprachigen Lernenden", bio: "Ich unterrichte Modernes Hocharabisch mit Schwerpunkt Medien und Alltag. Meine Lernenden bereite ich strukturiert auf Gespräche, Lesetexte und Prüfungen vor – geduldig, mit echtem Material.", years: 12, certification: "Al-Azhar Arabic Teaching Diploma · DAAD-zertifiziert", rating: 4.9, ratingCount: 214, lessons: 1240, responseMin: 15, online: true, specialties: ["Modernes Hocharabisch", "Konversation"], langs: ["Arabisch (Muttersprache)", "Deutsch (fließend)", "Englisch"], cancellationRate: 2, quality: 93, hourly: 3400 },
    { name: "Rana Khalil", email: "rana.khalil@demo.deutschpath.dev", color: "#0F766E", rank: "EXPERT", headline: "Expertin für akademisches Arabisch und Literatur (Beirut)", bio: "Master in Angewandter Arabistik. Ich mache komplexe Grammatik greifbar und wecke Lust auf arabische Literatur.", years: 15, certification: "MA Arabic Linguistics · zertifizierte Prüferin", rating: 4.8, ratingCount: 187, lessons: 980, responseMin: 25, online: true, specialties: ["Modernes Hocharabisch", "Lesen & Schreiben"], langs: ["Arabisch (Muttersprache)", "Deutsch (gut)", "Französisch"], cancellationRate: 3, quality: 90, hourly: 3800 },
    { name: "Markus Vogel", email: "markus.vogel@demo.deutschpath.dev", color: "#B45309", rank: "ADVANCED", headline: "Strukturierter Grammatikcoach bis B2", bio: "Systematisch zur Sicherheit: klare Lernpfade, viele Wiederholungen, wenig Frust.", years: 7, certification: "COTAFOL (Teaching Arabic as a Foreign Language)", rating: 4.7, ratingCount: 121, lessons: 640, responseMin: 45, online: false, specialties: ["Grammatik", "Arabisch für Anfänger"], langs: ["Deutsch (Muttersprache)", "Arabisch (C1)"], cancellationRate: 5, quality: 86, hourly: 2900 },
    { name: "Julia Hartmann", email: "julia.hartmann@demo.deutschpath.dev", color: "#BE185D", rank: "INTERMEDIATE", headline: "Freundliche Begleitung für den Einstieg – Alphabet & Aussprache", bio: "Geduld und kleine Erfolge machen beim Arabischlernen den Unterschied.", years: 4, certification: "M.A. Arabistik · DaA-Zusatzzertifizierung", rating: 4.6, ratingCount: 88, lessons: 310, responseMin: 30, online: true, specialties: ["Arabisch für Anfänger", "Aussprache"], langs: ["Deutsch (Muttersprache)", "Arabisch (B2)"], cancellationRate: 4, quality: 84, hourly: 2500 },
    { name: "Tobias Richter", email: "tobias.richter@demo.deutschpath.dev", color: "#374151", rank: "JUNIOR", headline: "Motivierender Tutor für A1–A2", bio: "Ich bringe frische Energie in jede Stunde und feiere jeden Fortschritt.", years: 1, certification: "B.A. Orientalistik · TAFAL-Grundzertifikat", rating: 4.3, ratingCount: 31, lessons: 85, responseMin: 60, online: true, specialties: ["Arabisch für Anfänger"], langs: ["Deutsch (Muttersprache)", "Arabisch (B1)"], cancellationRate: 8, quality: 78, hourly: 1900 },
    { name: "Layla Haddad", email: "layla.haddad@demo.deutschpath.dev", color: "#6D28D9", rank: "SENIOR", headline: "Senior-Lehrkraft für Prüfungsvorbereitung (B1–C1)", bio: "Prüfungserfahrung aus über 1.000 Unterrichtsstunden – ich weiß, worauf es ankommt.", years: 11, certification: "Al-Azhar Diploma · telc Arabic Prüferin", rating: 4.9, ratingCount: 198, lessons: 1105, responseMin: 20, online: false, specialties: ["Lesen & Schreiben", "Konversation"], langs: ["Arabisch (Muttersprache)", "Deutsch (fließend)"], cancellationRate: 2, quality: 92, hourly: 3200 },
    { name: "Karim Nassar", email: "karim.nassar@demo.deutschpath.dev", color: "#047857", rank: "ADVANCED", headline: "Konversations-Trainer – Sprechen ab Tag eins", bio: "Sprechen von Anfang an – mit Korrekturen, die weiterbringen.", years: 6, certification: "BA Arabic Studies · Teaching Certificate (Damaskus)", rating: 4.2, ratingCount: 76, lessons: 420, responseMin: 90, online: false, specialties: ["Konversation", "Levantinisches Arabisch"], langs: ["Arabisch (Muttersprache)", "Deutsch (gut)"], cancellationRate: 12, quality: 71, hourly: 2700 },
    { name: "Samira Othman", email: "samira.othman@demo.deutschpath.dev", color: "#A16207", rank: "INTERMEDIATE", headline: "Alltagsarabisch für Reisende und Neuinteressierte", bio: "Arabisch für den Alltag: Begrüßungen, Einkaufen, Smalltalk – nah am Ägyptischen Dialekt.", years: 5, certification: "BA Arabic & Islamic Studies", rating: 4.4, ratingCount: 64, lessons: 265, responseMin: 40, online: false, specialties: ["Ägyptischer Dialekt", "Arabisch für Anfänger"], langs: ["Arabisch (Muttersprache)", "Englisch", "Deutsch (Grundkenntnisse)"], cancellationRate: 6, quality: 82, hourly: 2400 },
  ] as const;

  const teachers: Array<{ userId: string; profileId: string; name: string }> = [];
  for (const t of teacherSpecs) {
    const user = await mkUser({ name: t.name, email: t.email, roleType: "TEACHER", color: t.color });
    const profile = await db.teacherProfile.create({
      data: {
        userId: user.id, rank: t.rank, headline: t.headline, bio: t.bio,
        yearsExperience: t.years, certification: t.certification,
        responseTimeMinutes: t.responseMin, hourlyRateCents: t.hourly,
        languages: [...t.langs], specialties: [...t.specialties],
        isOnline: t.online, onlineSince: t.online ? daysAgo(0, 3) : null,
        qualityScore: t.quality,
        qualityState: t.quality >= 80 ? "GOOD_STANDING" : t.quality >= 70 ? "WARNING" : "UNDER_REVIEW",
        completedLessons: t.lessons, cancellationRatePct: t.cancellationRate,
        onboardingStage: "APPROVED", approvedAt: daysAgo(400),
      },
    });
    await db.teacherQualification.create({ data: { teacherId: profile.id, maxLevel: TEACHER_RANKS[t.rank].maxLevel } });
    for (let wd = 0; wd < 5; wd++) {
      await db.teacherAvailability.create({ data: { teacherId: profile.id, weekday: wd, startMinute: 540, endMinute: 1140 } });
    }
    teachers.push({ userId: user.id, profileId: profile.id, name: t.name });
  }
  const byName = (n: string) => teachers.find((t) => t.name.startsWith(n))!;
  const omar = byName("Omar");
  const rana = byName("Rana");
  const layla = byName("Layla");
  const karim = byName("Karim");
  const julia = byName("Julia");
  const tobias = byName("Tobias");

  // Pipeline-Bewerber
  const felix = await mkUser({ name: "Felix Braun", email: "felix.braun@demo.deutschpath.dev", roleType: "TEACHER", color: "#713F12" });
  await db.teacherProfile.create({
    data: {
      userId: felix.id, rank: "INTERMEDIATE", headline: "Bewerber – Arabist mit Tutoriungerfahrung",
      bio: "Bewerbung als Arabisch-Lehrkraft für Anfänger.", yearsExperience: 2,
      certification: "M.A. Arabistik (Nachweise in Prüfung)",
      responseTimeMinutes: 60, hourlyRateCents: 2000, languages: ["Deutsch (Muttersprache)", "Arabisch (C1)"],
      specialties: ["Arabisch für Anfänger"], onboardingStage: "DOCUMENT_VERIFICATION", qualityScore: 85,
    },
  });

  // Admins
  const superAdmin = await mkUser({ name: "Dr. Katharina Wolf", email: "admin@demo.deutschpath.dev", roleType: "SUPER_ADMIN", color: "#1E1B4B" });
  const academicAdmin = await mkUser({ name: "Prof. Jonas Adler", email: "academic@demo.deutschpath.dev", roleType: "ACADEMIC_ADMIN", color: "#312E81" });
  const moderator = await mkUser({ name: "Miriam Falk", email: "moderator@demo.deutschpath.dev", roleType: "MODERATOR", color: "#9F1239" });
  const manager = await mkUser({ name: "Daniel Senf", email: "manager@demo.deutschpath.dev", roleType: "TEACHER_MANAGER", color: "#065F46" });
  await mkUser({ name: "Sara Lorenz", email: "support@demo.deutschpath.dev", roleType: "SUPPORT_ADMIN", color: "#92400E" });
  await mkUser({ name: "Peter Sturm", email: "finance@demo.deutschpath.dev", roleType: "FINANCE_ADMIN", color: "#164E63" });

  // ── Lena-Lernstand (B2 · Kapitel 1 · Lektion 3) ────────────────────────────
  const b1Id = levels.B1!.id, b2Id = levels.B2!.id, a2Id = levels.A2!.id;
  await db.enrollment.create({ data: { studentId: lena.id, levelId: a2Id, status: "COMPLETED", startedAt: daysAgo(300), completedAt: daysAgo(220) } });
  await db.enrollment.create({ data: { studentId: lena.id, levelId: b1Id, status: "COMPLETED", startedAt: daysAgo(220), completedAt: daysAgo(95) } });
  await db.enrollment.create({ data: { studentId: lena.id, levelId: b2Id, startedAt: daysAgo(40) } });
  await db.enrollment.create({ data: { studentId: max.id, levelId: a2Id, startedAt: daysAgo(55) } });
  await db.enrollment.create({ data: { studentId: jonas.id, levelId: levels.A1!.id, startedAt: daysAgo(18) } });

  async function markLevelDone(chapters: Array<{ lessons: Array<{ id: string }> }>, levelCode: CefrCode, percent: number, xpBase: number) {
    for (const ch of chapters) {
      for (const l of ch.lessons) {
        await db.lessonProgress.create({
          data: { studentId: lena.id, lessonId: l.id, status: "COMPLETED", attendanceComplete: true, quizBestScore: 88, quizPassed: true, homeworkSubmitted: true, unlockedAt: daysAgo(200), completedAt: daysAgo(150) },
        });
      }
    }
    const ces = await db.chapterExam.findMany({ where: { chapter: { level: { code: levelCode } } }, include: { chapter: true } });
    for (const ce of ces) {
      await db.examAttempt.create({ data: { kind: "CHAPTER", studentId: lena.id, chapterExamId: ce.id, status: "PASSED", score: 86, passed: true, decidedAt: daysAgo(140) } });
    }
    const le = await db.levelExam.findUnique({ where: { levelId: levels[levelCode]!.id } });
    if (le) {
      const attempt = await db.examAttempt.create({
        data: { kind: "LEVEL_FINAL", studentId: lena.id, levelExamId: le.id, status: "PASSED", score: percent, passed: true, decidedAt: daysAgo(95), proctoringChecks: { identity: "verified-demo", recording: "not-stored-demo" } },
      });
      if (levelCode === "B1") {
        const serialB1 = "CERT-839293";
        const cert = await db.certificate.create({
          data: { serial: serialB1, studentId: lena.id, levelId: b1Id, score: 84, issuedAt: daysAgo(94), expiresAt: daysAgo(-1095), status: "VALID", examAttemptId: attempt.id, verificationHash: hash(`${serialB1}|Lena Schmidt|B1|84`) },
        });
        await db.examAttempt.update({ where: { id: attempt.id }, data: { certificateId: cert.id } });
      }
    }
    await db.studentProgress.create({
      data: { studentId: lena.id, levelCode, completionPercent: percent, xp: xpBase, streakDays: 12, lastStudyDate: daysAgo(1) },
    });
  }
  await markLevelDone(a2Chapters, "A2", 100, 900);
  await markLevelDone(b1Chapters, "B1", 100, 1500);

  // B2: Kapitel-1-Lektionen 1+2 abgeschlossen; Lektion 3 läuft (Teilnahme ✓, Quiz/Hausaufgaben offen)
  const b2c1 = b2Chapters[0]!;
  const [b2l1, b2l2, b2l3] = b2c1.lessons;
  await db.lessonProgress.create({ data: { studentId: lena.id, lessonId: b2l1!.id, status: "COMPLETED", attendanceComplete: true, quizBestScore: 92, quizPassed: true, homeworkSubmitted: true, unlockedAt: daysAgo(40), completedAt: daysAgo(34) } });
  await db.lessonProgress.create({ data: { studentId: lena.id, lessonId: b2l2!.id, status: "COMPLETED", attendanceComplete: true, quizBestScore: 84, quizPassed: true, homeworkSubmitted: true, unlockedAt: daysAgo(34), completedAt: daysAgo(27) } });
  await db.lessonProgress.create({ data: { studentId: lena.id, lessonId: b2l3!.id, status: "IN_PROGRESS", attendanceComplete: true, quizBestScore: 45, quizPassed: false, homeworkSubmitted: false, unlockedAt: daysAgo(27) } });
  await db.studentProgress.upsert({
    where: { studentId_levelCode: { studentId: lena.id, levelCode: "B2" } },
    create: { studentId: lena.id, levelCode: "B2", completionPercent: 22, xp: 700, streakDays: 4, lastStudyDate: daysAgo(1) },
    update: { completionPercent: 22, xp: 700, streakDays: 4, lastStudyDate: daysAgo(1) },
  });

  for (const [skill, score] of [["READING", 74], ["LISTENING", 68], ["WRITING", 58], ["SPEAKING", 62], ["GRAMMAR", 66], ["VOCABULARY", 71]] as Array<[string, number]>) {
    await db.skillScore.create({ data: { studentId: lena.id, skill: skill as never, score } });
  }
  for (const [skill, score] of [["READING", 41], ["LISTENING", 38], ["WRITING", 30], ["SPEAKING", 33], ["GRAMMAR", 36], ["VOCABULARY", 40]] as Array<[string, number]>) {
    await db.skillScore.create({ data: { studentId: max.id, skill: skill as never, score } });
  }

  // ── Buchungen, Sitzungen, Bewertungen ──────────────────────────────────────
  async function mkBooking(b: {
    studentId: string; teacherId: string; lessonId: string; mode: "INSTANT" | "SCHEDULED";
    status: "SCHEDULED" | "COMPLETED" | "CANCELLED_BY_TEACHER" | "NO_SHOW" | "IN_PROGRESS" | "CANCELLED_BY_STUDENT";
    scheduledAt: Date; withSession?: boolean;
  }) {
    const booking = await db.booking.create({
      data: {
        studentId: b.studentId, teacherId: b.teacherId, lessonId: b.lessonId,
        mode: b.mode, status: b.status, scheduledAt: b.scheduledAt,
        durationMinutes: 50, priceCents: 2900,
      },
    });
    if (b.withSession) {
      const session = await db.liveSession.create({
        data: { bookingId: booking.id, provider: "demo", roomUrl: `/classroom/${booking.id}`, demoMode: true, startedAt: b.scheduledAt, endedAt: new Date(b.scheduledAt.getTime() + 50 * 60000), recordingConsentStudent: true, recordingConsentTeacher: true },
      });
      await db.attendanceEvent.createMany({
        data: [
          { sessionId: session.id, actorId: b.studentId, type: "JOINED", at: b.scheduledAt },
          { sessionId: session.id, actorId: b.teacherId, type: "JOINED", at: b.scheduledAt },
          { sessionId: session.id, actorId: b.studentId, type: "MARKED_PRESENT", at: b.scheduledAt },
          { sessionId: session.id, actorId: b.teacherId, type: "COMPLETED", at: new Date(b.scheduledAt.getTime() + 50 * 60000) },
        ],
      });
    }
    return booking;
  }

  const bk1 = await mkBooking({ studentId: lena.id, teacherId: rana.userId, lessonId: b2l1!.id, mode: "SCHEDULED", status: "COMPLETED", scheduledAt: daysAgo(38), withSession: true });
  await db.teacherRating.create({ data: { bookingId: bk1.id, studentId: lena.id, teacherId: rana.userId, overall: 5, explanation: 5, languageClarity: 5, punctuality: 5, interaction: 5, patience: 5, technicalQuality: 5, comment: "Sehr strukturierte Stunde, tolle Erklärung der Idafa!", createdAt: daysAgo(38, 14) } });
  const bk2 = await mkBooking({ studentId: lena.id, teacherId: omar.userId, lessonId: b2l2!.id, mode: "INSTANT", status: "COMPLETED", scheduledAt: daysAgo(31), withSession: true });
  await db.teacherRating.create({ data: { bookingId: bk2.id, studentId: lena.id, teacherId: omar.userId, overall: 4, explanation: 5, languageClarity: 4, punctuality: 4, interaction: 4, patience: 4, technicalQuality: 4, comment: "Groartige Nachrichtenphrasen; am Ende etwas schnell.", createdAt: daysAgo(31, 15) } });
  const bk3 = await mkBooking({ studentId: lena.id, teacherId: karim.userId, lessonId: b2l3!.id, mode: "SCHEDULED", status: "NO_SHOW", scheduledAt: daysAgo(2) });
  await mkBooking({ studentId: lena.id, teacherId: omar.userId, lessonId: b2l3!.id, mode: "SCHEDULED", status: "SCHEDULED", scheduledAt: daysAhead(1, 17) });
  await mkBooking({ studentId: max.id, teacherId: julia.userId, lessonId: a2Chapters[0]!.lessons[0]!.id, mode: "SCHEDULED", status: "SCHEDULED", scheduledAt: daysAhead(2, 10) });

  // Historie für Admin-Metriken
  for (let i = 0; i < 14; i++) {
    const t = teachers[i % 6];
    const s = [lena.id, max.id, jonas.id][i % 3]!;
    await mkBooking({
      studentId: s, teacherId: t!.userId, lessonId: b2l1!.id, mode: i % 2 ? "INSTANT" : "SCHEDULED",
      status: i % 7 === 3 ? "CANCELLED_BY_STUDENT" : "COMPLETED",
      scheduledAt: daysAgo(3 + i * 2), withSession: i % 7 !== 3,
    });
  }

  // Interne Notizen (nur für Lehrkräfte sichtbar)
  await db.teacherNote.create({
    data: { authorId: omar.userId, studentId: lena.id, bookingId: bk2.id, body: "Lena verwechselt noch Idafa mit zirkumpositionaler Genitiv-Umschreibung („das Buch des Studenten“ vs „das Buch von dem Studenten“). Nächstes Mal: kurze Wiederholung + fünf Übungssätze. Aussprache des 'ain (ع) weiter üben.", createdAt: daysAgo(31, 16) },
  });
  await db.teacherNote.create({
    data: { authorId: rana.userId, studentId: lena.id, bookingId: bk1.id, body: "Sehr motiviert, starkes Leseverständnis. Ziel: schriftliche Strukturen (Nominalstil) ausbauen.", createdAt: daysAgo(38, 15) },
  });

  // Favoriten
  await db.favoriteTeacher.createMany({
    data: [
      { studentId: lena.id, teacherId: omar.userId },
      { studentId: lena.id, teacherId: rana.userId },
      { studentId: max.id, teacherId: julia.userId },
    ],
  });

  // ── Moderationsfälle ───────────────────────────────────────────────────────
  const caseOpen = await db.reportCase.create({
    data: {
      caseId: "RPT-48213", openedByStudentId: lena.id, teacherId: karim.userId, bookingId: bk3.id,
      reason: "MISSED_OR_SHORTENED_LESSON",
      description: "Die Lehrkraft ist der Unterrichtsstunde überhaupt nicht beigetreten. Ich habe 25 Minuten im Klassenzimmer gewartet – ohne vorherige Nachricht.",
      status: "OPEN",
      evidence: {
        create: [
          { kind: "ATTENDANCE_RECORD", content: `Lernende JOINED 17:00. Lehrkraft: kein Beitritt innerhalb von 30 Min. (Buchung ${bk3.id}).`, meta: {} },
          { kind: "CHAT_LOG", content: "[17:04] Lena: Sind Sie da?\n[17:12] Lena: Ich warte noch…\n(keine Antwort)", meta: {} },
        ],
      },
      actions: { create: { actorId: lena.id, action: "CASE_OPENED", note: "Meldung durch die Lernende erstellt", createdAt: daysAgo(2, 18) } },
      createdAt: daysAgo(2, 18),
    },
  });
  void caseOpen;
  const caseReview = await db.reportCase.create({
    data: {
      caseId: "RPT-51902", openedByStudentId: max.id, teacherId: tobias.userId,
      reason: "UNPREPARED_TEACHER",
      description: "Der Tutor wirkte unvorbereitet und las die meisten Lösungen direkt vom Lösungsblatt ab.",
      status: "UNDER_REVIEW",
      teacherResponse: "Ich hatte technische Probleme mit den Materialien und musste spontan auf die Lösungen zurückgreifen. Das werde ich künftig anders vorbereiten.",
      evidence: { create: { kind: "OTHER", content: "Screenshot-Hinweis der Lernenden (im Demo-Build nicht gespeichert)", meta: {} } },
      actions: {
        create: [
          { actorId: max.id, action: "CASE_OPENED", createdAt: daysAgo(6) },
          { actorId: moderator.id, action: "STATUS_CHANGED", note: "In Prüfung; Stellungnahme der Lehrkraft angefordert", createdAt: daysAgo(4) },
          { actorId: tobias.userId, action: "TEACHER_RESPONSE", note: "Stellungnahme eingegangen", createdAt: daysAgo(3) },
        ],
      },
      createdAt: daysAgo(6),
    },
  });
  void caseReview;
  await db.reportCase.create({
    data: {
      caseId: "RPT-39877", openedByStudentId: jonas.id, teacherId: karim.userId,
      reason: "INAPPROPRIATE_CONDUCT",
      description: "Wiederholt zu spät und meine Fragen wurden während der Stunde übergangen.",
      status: "CLOSED",
      decision: "Verwarnung an die Lehrkraft; keine Guthaben-Rückerstattung (Unterricht fand statt).",
      decisionById: moderator.id, resolvedAt: daysAgo(20), closedAt: daysAgo(20),
      actions: {
        create: [
          { actorId: jonas.id, action: "CASE_OPENED", createdAt: daysAgo(25) },
          { actorId: karim.userId, action: "TEACHER_RESPONSE", note: "Entschuldigung; Terminproblem genannt", createdAt: daysAgo(23) },
          { actorId: moderator.id, action: "DECISION_RECORDED", note: "Verwarnung erteilt", createdAt: daysAgo(20) },
          { actorId: moderator.id, action: "CASE_CLOSED", createdAt: daysAgo(20) },
        ],
      },
      createdAt: daysAgo(25),
    },
  });

  // Ausstehende Wiederholungsanfrage (No-Show von Karim)
  await db.retakeRequest.create({
    data: {
      requestId: "RTK-73112", studentId: lena.id, teacherId: karim.userId, bookingId: bk3.id,
      lessonId: b2l3!.id, reason: "Die Lehrkraft ist nie erschienen. Ich möchte diese Lektion mit einer anderen Lehrkraft wiederholen.",
      status: "PENDING",
    },
  });

  // ── Vokabeln (Arabisch ↔ Deutsch) ──────────────────────────────────────────
  const vocabB2 = [
    ["وَظِيفَة", "Stelle / Aufgabe", "حَصَلْتُ على وَظِيفَةٍ جَدِيدَةٍ فِي شَرِكَة.", "Ich habe eine neue Stelle in einer Firma bekommen.", "Nomen, feminin"],
    ["شَرِكَة", "Firma / Gesellschaft", "تَعْمَلُ أُمِّي فِي شَرِكَةٍ كَبِيرَة.", "Meine Mutter arbeitet in einer großen Firma.", "Nomen, feminin"],
    ["الْعُنْوَان الرَّئِيسِيّ", "Schlagzeile", "قَرَأْتُ العُنْوَانَ الرَّئِيسِيَّ فِي الصَّحِيفَة.", "Ich habe die Schlagzeile in der Zeitung gelesen.", "Nomen-Phrase"],
    ["حِمَايَةُ البَيَانَات", "Datenschutz", "حِمَايَةُ البَيَانَاتِ مُهِمَّةٌ جِدًّا.", "Datenschutz ist sehr wichtig.", "Nomen-Phrase"],
    ["المَصْدَر", "Quelle", "المَصْدَرُ غَيْرُ مَعْرُوفٍ.", "Die Quelle ist unbekannt.", "Nomen, maskulin"],
    ["خَصْم", "Rabatt", "هُنَاكَ خَصْمٌ خَمْسِينَ بِالْمِئَة.", "Es gibt 50 % Rabatt.", "Nomen, maskulin"],
    ["فترة التجربة", "Probezeit", "الفترة التجريبية سَتَةُ أشْهُر.", "Die Probezeit beträgt sechs Monate.", "Nomen-Phrase"],
    ["سَهْل", "leicht", "الامْتِحَانُ سَهْلٌ بِنِسْبَةٍ إلَيْهِ.", "Die Prüfung ist für ihn leicht.", "Adjektiv"],
    ["صَعْب", "schwierig", "العربية صَعْبَةٌ فِي البِدايةِ فقط.", "Arabisch ist nur am Anfang schwierig.", "Adjektiv"],
    ["اَتَّخَذَ قَرَارًا", "eine Entscheidung treffen", "اتَّخذَ المديرُ قرارًا صعبًا.", "Der Manager traf eine schwierige Entscheidung.", "Verb + Objekt"],
    ["تَخَصَّصَ في", "sich spezialisieren auf", "تخصَّصت في الأدب العربي الحديث.", "Ich habe mich auf moderne arabische Literatur spezialisiert.", "Verb (V.)"],
    ["الصبر مفتاح الفرج", "Geduld öffnet jede Tür (Sprichwort)", "يقولون دائمًا: الصبر مفتاح الفرج.", "Sie sagen immer: Geduld öffnet jede Tür.", "Sprichwort"],
  ] as const;
  const vocabB1 = [
    ["مَرْحَبًا", "Hallo!", "مرحبًا! كيف حالك اليوم؟", "Hallo! Wie geht es dir heute?", "Zwischenruf"],
    ["شُكْرًا", "Danke", "شكرًا على الهدية الجميلة.", "Danke für das schöne Geschenk.", "Zwischenruf"],
    ["كِتَاب", "Buch", "هذا كتاب عن تاريخ العرب.", "Das ist ein Buch über die Geschichte der Araber.", "Nomen, maskulin"],
    ["طَالِب", "Student", "ابني طالب في الجامعة.", "Mein Sohn ist Student an der Universität.", "Nomen, maskulin"],
    ["مَدِينَة", "Stadt", "دمشق مدينة قديمة وجميلة.", "Damaskus ist eine alte und schöne Stadt.", "Nomen, feminin"],
    ["جَمِيل", "schön", "الخط العربي جميل جدًا.", "Arabische Kalligrafie ist sehr schön.", "Adjektiv"],
  ] as const;

  const vocabItems: Record<string, string> = {};
  const allVocab = [...vocabB2, ...vocabB1];
  for (let vi = 0; vi < allVocab.length; vi++) {
    const [word, tr, exTarget, exTrans, pos] = allVocab[vi]!;
    const item = await db.vocabularyItem.create({
      data: { word, translation: tr, exampleTarget: exTarget, exampleTranslation: exTrans, partOfSpeech: pos, levelCode: vi >= vocabB2.length ? "B1" : "B2" },
    });
    vocabItems[word] = item.id;
  }
  // Wiederholungsplan per Index in allVocab ([Index, Box, Tage bis fällig])
  const reviewPlan: Array<[number, number, number]> = [
    [0, 3, 0], [1, 2, 0], [4, 1, 0], [10, 2, 0],
    [3, 4, 1], [5, 3, 2], [6, 2, 1], [7, 1, 3],
    [8, 3, 4], [9, 1, 2], [2, 2, 5], [12, 3, 1],
    [13, 1, 0], [14, 2, 6], [15, 4, 3], [16, 3, 2],
    [17, 2, 1],
  ];
  for (const [idx, box, dueIn] of reviewPlan) {
    await db.studentVocabularyReview.create({
      data: {
        studentId: lena.id, itemId: allVocab[idx] ? vocabItems[allVocab[idx]![0]]! : "", box,
        intervalDays: [0, 1, 2, 4, 8, 16][box] ?? 1,
        dueAt: daysAgo(-dueIn, 9), lastReviewedAt: dueIn === 0 ? daysAgo(box) : daysAgo(box + 1),
      },
    });
  }
  for (const idx of [12, 14, 16]) {
    await db.studentVocabularyReview.create({
      data: { studentId: max.id, itemId: vocabItems[allVocab[idx]![0]]!, box: 1, intervalDays: 1, dueAt: daysAgo(0, 8) },
    });
  }

  // ── Abrechnung ─────────────────────────────────────────────────────────────
  await db.package.createMany({
    data: [
      { name: "Lernen Plus", kind: "SUBSCRIPTION", priceCents: 2900, credits: 4, description: "4 Live-Einheiten pro Monat + unbegrenztes Selbststudium.", active: true },
      { name: "Intensiv", kind: "SUBSCRIPTION", priceCents: 7900, credits: 12, description: "12 Live-Einheiten pro Monat, bevorzugte Terminplanung.", active: true },
      { name: "Guthaben-Paket 5", kind: "LESSON_CREDITS", priceCents: 6500, credits: 5, description: "Fünf Unterrichtsguthaben, 6 Monate gültig.", active: true },
      { name: "B2 komplett", kind: "LEVEL_PACKAGE", priceCents: 19900, credits: 16, description: "Kompletter B2-Lernweg: alle Live-Einheiten + Prüfungen + Zertifikat.", active: true },
    ],
  });
  const wallet = await db.wallet.create({ data: { studentId: lena.id } });
  const ledgerPlan: Array<[number, string]> = [
    [3, "SIGNUP_BONUS"], [-1, "LESSON_BOOKING"], [-1, "LESSON_BOOKING"], [+1, "PACKAGE_PURCHASE"], [-1, "LESSON_BOOKING"],
  ];
  let bal = 0;
  let li = 0;
  for (const [delta, reason] of ledgerPlan) {
    bal += delta;
    await db.creditLedger.create({
      data: { walletId: wallet.id, delta, balanceAfter: bal, reason: reason as never, refType: reason === "LESSON_BOOKING" ? "booking" : "package", idempotencyKey: `seed-${li++}`, createdAt: daysAgo(li * 5) },
    });
  }
  await db.wallet.create({ data: { studentId: max.id } });
  await db.subscription.create({
    data: { studentId: lena.id, planName: "Lernen Plus", status: "ACTIVE", monthlyPriceCents: 2900, periodStart: daysAgo(10), periodEnd: daysAhead(20) },
  });
  await db.payment.createMany({
    data: [
      { studentId: lena.id, amountCents: 2900, status: "PAID", provider: "demo", reference: "PAY-100241", description: "Lernen Plus – monatlich", createdAt: daysAgo(40) },
      { studentId: lena.id, amountCents: 6500, status: "PAID", provider: "demo", reference: "PAY-100512", description: "Guthaben-Paket 5", createdAt: daysAgo(12) },
      { studentId: max.id, amountCents: 2900, status: "PAID", provider: "demo", reference: "PAY-100633", description: "Lernen Plus – monatlich", createdAt: daysAgo(30) },
    ],
  });
  await db.teacherPayout.createMany({
    data: [
      { teacherId: omar.userId, amountCents: 23000, status: "PENDING", periodStart: daysAgo(30), periodEnd: daysAgo(1) },
      { teacherId: rana.userId, amountCents: 18400, status: "PAID", periodStart: daysAgo(60), periodEnd: daysAgo(31), paidAt: daysAgo(30) },
    ],
  });

  // ── Benachrichtigungen ─────────────────────────────────────────────────────
  await db.notificationPreference.createMany({ data: [{ userId: lena.id }, { userId: max.id }] });
  await db.notification.createMany({
    data: [
      { userId: lena.id, type: "lesson_reminder", titleKey: `Live-Unterricht morgen um 17:00 bei Omar El-Sayed`, link: "/student/schedule" },
      { userId: lena.id, type: "vocabulary", titleKey: "5 Wörter sind heute zur Wiederholung fällig", link: "/student/vocabulary" },
      { userId: lena.id, type: "quiz_graded", titleKey: "Dein Quiz-Versuch: 45% – wiederhole die Themen und versuche es erneut", link: "/student", readAt: daysAgo(1) },
      { userId: lena.id, type: "homework_feedback", titleKey: "Omar El-Sayed hat „Protokollübung“ korrigiert", link: "/student/homework", readAt: daysAgo(20) },
      { userId: lena.id, type: "system", titleKey: "Zertifikat ausgestellt: B1 (CERT-839293)", link: "/verify/CERT-839293", readAt: daysAgo(90) },
      { userId: omar.userId, type: "booking", titleKey: "Neue geplante Unterrichtsstunde: Lena Schmidt – Kommunikation am Arbeitsplatz", link: "/teacher/upcoming" },
      { userId: moderator.id, type: "report_update", titleKey: "Fall RPT-48213 eröffnet", link: "/admin/reports" },
      { userId: manager.id, type: "system", titleKey: "Wiederholungsanfrage RTK-73112 wartet auf Prüfung", link: "/admin/retakes" },
    ],
  });

  // ── Audit-Log ──────────────────────────────────────────────────────────────
  await db.auditLog.createMany({
    data: [
      { actorId: academicAdmin.id, action: "certificate.issued", entityType: "certificate", entityId: "CERT-839293", meta: { level: "B1", score: 84 }, createdAt: daysAgo(94) },
      { actorId: moderator.id, action: "report.closed", entityType: "report_case", entityId: "RPT-39877", meta: { decision: "Verwarnung" }, createdAt: daysAgo(20) },
      { actorId: superAdmin.id, action: "role.updated", entityType: "user", entityId: manager.id, meta: { role: "TEACHER_MANAGER" }, createdAt: daysAgo(50) },
    ],
  });

  console.log("Seed fertig.");
  console.log("Demo-Konten (Passwort demo1234!):");
  console.log("  Lernende : lena.schmidt@demo.deutschpath.dev");
  console.log("  Lehrkraft: omar.elsayed@demo.deutschpath.dev");
  console.log("  Admin    : admin@demo.deutschpath.dev");
}

async function wipe() {
  const tables = [
    "AiMessage", "AuditLog", "StudentVocabularyReview", "VocabularyItem", "NotificationPreference",
    "Notification", "TeacherPayout", "Payment", "CreditLedger", "Wallet", "Package", "Subscription",
    "RetakeRequest", "CaseAction", "CaseEvidence", "ReportCase", "HomeworkFeedback", "HomeworkSubmission",
    "Homework", "Certificate", "ExamAttempt", "LevelExam", "ChapterExam", "QuizAnswer", "QuizAttempt",
    "QuestionOption", "Question", "Quiz", "TeacherRating", "TeacherNote", "AttendanceEvent", "LiveSession",
    "Booking", "SkillScore", "LessonProgress", "StudentProgress", "Enrollment", "LearningMaterial",
    "LessonObjective", "Lesson", "Chapter", "Level", "FavoriteTeacher", "TeacherAvailability",
    "TeacherQualification", "TeacherProfile", "StudentProfile", "User", "RolePermission", "Permission", "Role",
  ];
  await db.$executeRawUnsafe(`TRUNCATE TABLE "${tables.map((t) => t.replace(/"/g, "")).join('","')}" CASCADE`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
