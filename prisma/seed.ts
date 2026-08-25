// Deterministic seed: realistic German content sufficient for every main flow.
// Run: npm run db:seed   (also wired into `prisma migrate dev` via package.json)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomInt } from "node:crypto";
import {
  TEACHER_RANKS,
  ONBOARDING_STAGES,
} from "../src/config/domain";
import type { CefrCode } from "../src/config/domain";

const db = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────
const now = () => new Date();
const daysAgo = (n: number, h = 12) => new Date(Date.now() - n * 86_400_000 + h * 3_600_000);
const daysAhead = (n: number, h = 17) => new Date(Date.now() + n * 86_400_000 - (23 - h) * 3_600_000);
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const serial = (p: string, n?: number) => `${p}-${n ?? randomInt(10000, 99999)}`;

interface QSpec {
  skill: "GRAMMAR" | "VOCABULARY" | "READING" | "LISTENING";
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  context?: string;
}

async function main() {
  console.log("Seeding DeutschPath…");
  await wipe();

  // ── RBAC ───────────────────────────────────────────────────────────────────
  const permissionRows = [
    ["curriculum_edit", "Edit levels, chapters, lessons and quizzes"],
    ["students_view", "View students"],
    ["students_manage", "Suspend/adjust students"],
    ["teachers_view", "View teachers and pipeline"],
    ["teachers_manage", "Advance onboarding, suspend teachers"],
    ["reports_view", "View report cases and evidence"],
    ["reports_decide", "Decide and close report cases"],
    ["retakes_review", "Approve/reject retake requests"],
    ["certificates_issue", "Issue certificates"],
    ["certificates_revoke", "Revoke certificates"],
    ["payments_view", "View payments and payouts"],
    ["payments_manage", "Trigger refunds and payouts"],
    ["analytics_view", "View analytics dashboards"],
    ["roles_manage", "Manage roles and permissions"],
    ["settings_manage", "Change platform settings"],
    ["moderation_evidence", "Access confidential case evidence"],
  ] as const;
  const permissions = Object.fromEntries(
    await Promise.all(
      permissionRows.map(async ([key, description]) => [key, await db.permission.create({ data: { key, description } })] as const)
    )
  );
  const roleDefs: Array<[string, string, string[]]> = [
    ["SUPER_ADMIN", "Full platform access", permissionRows.map(([k]) => k)],
    ["ACADEMIC_ADMIN", "Curriculum, certificates, retakes", ["curriculum_edit", "students_view", "teachers_view", "teachers_manage", "retakes_review", "certificates_issue", "certificates_revoke", "reports_view", "analytics_view"]],
    ["TEACHER_MANAGER", "Onboarding, performance, retakes", ["teachers_view", "teachers_manage", "reports_view", "retakes_review", "students_view"]],
    ["SUPPORT_ADMIN", "Student support", ["students_view"]],
    ["MODERATOR", "Reports & investigations", ["reports_view", "reports_decide", "moderation_evidence", "students_view", "teachers_view"]],
    ["FINANCE_ADMIN", "Payments & payouts", ["payments_view", "payments_manage", "analytics_view"]],
    ["TEACHER", "Teaches assigned lessons", []],
    ["STUDENT", "Learns on the structured path", []],
  ];
  for (const [key, name, perms] of roleDefs) {
    await db.role.create({
      data: {
        key: key as never,
        name,
        description: name,
        permissions: { create: perms.map((p) => ({ permissionId: permissions[p]!.id })) },
      },
    });
  }

  // ── Curriculum ─────────────────────────────────────────────────────────────
  const levelDefs: Array<{ code: CefrCode; title: string; description: string }> = [
    { code: "A1", title: "Beginner Foundations", description: "First steps: introductions, numbers, everyday objects and simple sentences." },
    { code: "A2", title: "Elementary Communication", description: "Cope with routine situations: shopping, appointments, short descriptions." },
    { code: "B1", title: "Independent Everyday Life", description: "Express opinions, handle travel and work situations, understand main points." },
    { code: "B2", title: "Upper-Intermediate Fluency", description: "Discuss complex topics, argue a position, work and study in German." },
    { code: "C1", title: "Advanced Academic & Professional", description: "Flexible, nuanced German for demanding professional and academic contexts." },
    { code: "C2", title: "Mastery & Near-Native Nuance", description: "Understand virtually everything and express yourself spontaneously, precisely." },
  ];
  const levels: Record<string, { id: string }> = {};
  for (let i = 0; i < levelDefs.length; i++) {
    const l = levelDefs[i]!;
    levels[l.code] = await db.level.create({
      data: { code: l.code, title: l.title, description: l.description, orderIndex: i + 1 },
    });
  }

  interface ChapterSpec { title: string; titleDe: string; description: string; lessons: LessonSpec[] }
  interface LessonSpec {
    title: string; titleDe: string; summary: string;
    objectives: string[];
    materials: Array<{ type: string; title: string; body?: string }>;
    quiz?: QSpec[];
    homework?: { title: string; instructions: string; writingPrompt: string };
  }

  const b2ch1l3Quiz: QSpec[] = [
    { skill: "GRAMMAR", prompt: "___ der hohen Arbeitslosigkeit sind Fachkräfte in der IT gesucht.", options: ["Trotz", "Infolge", "Während", "Laut"], correct: 1, explanation: "„infolge + Genitiv“ drückt eine Ursache aus: „because of“. „trotz“ wäre ein Gegensatz." },
    { skill: "GRAMMAR", prompt: "Der Chef hat versprochen, die Gehälter ___ erhöhen.", options: ["zu", "um zu", "an zu", "für zum"], correct: 0, explanation: "Bei trennbaren Verben mit Modalverb-Infinitiv steht „zu“ zwischen Präfix und Verb: „versprochen, … zu erhöhen“." },
    { skill: "GRAMMAR", prompt: "Man sollte diese Entscheidung ___.", options: ["überdenken", "über denkt", "überdenkend", "übergedacht"], correct: 0, explanation: "Modalverben stehen mit dem Infinitiv am Ende des Satzes." },
    { skill: "GRAMMAR", prompt: "Könnten Sie das bitte wiederholen? – Höfliche Bitte mit ___.", options: ["Konjunktiv II", "Imperfekt", "Passiv", "Imperativ"], correct: 0, explanation: "„könnten“ ist Konjunktiv II von „können“ und macht die Frage höflich." },
    { skill: "GRAMMAR", prompt: "Die Ergebnisse ___ gestern veröffentlicht.", options: ["wurden", "worden", "werden", "würden"], correct: 0, explanation: "Passiv Präteritum: wurden + Partizip II." },
    { skill: "GRAMMAR", prompt: "__ man die Zahlen genau analysiert, erkennt man den Trend.", options: ["Wenn", "Obwohl", "Denn", "Deshalb"], correct: 0, explanation: "Bedingungssatz mit „wenn“, Verb an Satzende." },
    { skill: "GRAMMAR", prompt: "Sie arbeitet seit 2020 bei uns und ___ nie eine Frist verpasst.", options: ["hat", "ist", "wird", "hatte"], correct: 0, explanation: "Perfekt mit „haben“ bei transitiven Verben." },
    { skill: "GRAMMAR", prompt: "Der Bericht, ___ ich gestern gelesen habe, war sehr informativ.", options: ["den", "dem", "der", "dessen"], correct: 0, explanation: "Relativpronomen Akkusativ maskulin: „den Bericht lesen“." },
    { skill: "GRAMMAR", prompt: "Ich freue mich ___ Ihr Interesse an unserer Stelle.", options: ["über", "auf", "für", "an"], correct: 0, explanation: "„sich freuen über + Akkusativ“ bei etwas Konkretem im Verlauf." },
    { skill: "GRAMMAR", prompt: "Die Schulung findet ___ Montag statt.", options: ["am", "im", "zum", "ab dem"], correct: 0, explanation: "Temporalangaben mit Wochentagen: „am Montag“." },
    { skill: "VOCABULARY", prompt: "Was bedeutet „die Frist“?", options: ["deadline", "frame", "trust", "fresh air"], correct: 0, explanation: "„die Frist“ = deadline / time limit." },
    { skill: "VOCABULARY", prompt: "Ein Synonym für „der Arbeitgeber“ ist ___.", options: ["die Firma, die Personal stellt", "der Angestellte", "die Bewerbung", "der Lebenslauf"], correct: 0, explanation: "Arbeitgeber = employer; Arbeitnehmer = employee." },
    { skill: "VOCABULARY", prompt: "„eine Besprechung abhalten“ bedeutet ___.", options: ["hold a meeting", "stop a meeting", "cancel a shift", "postpone a task"], correct: 0, explanation: "„abhalten“ hier = veranstalten/durchführen." },
    { skill: "VOCABULARY", prompt: "Welches Wort passt? „Sie wurde wegen ihrer ___ Arbeit gelobt.“", options: ["sorgfältige", "sorgfältig", "sorgfältiger", "sorgsamsten"], correct: 0, explanation: "Adjektivdeklination nach „ihrer“ (Genitiv feminin): sorgfältige Arbeit." },
    { skill: "VOCABULARY", prompt: "„das Gehalt“ bezeichnet ___.", options: ["monthly salary", "contract length", "holiday days", "job title"], correct: 0, explanation: "Gehalt = (monatliches) Gehalt/Salary." },
    { skill: "READING", prompt: "Warum schreibt Herr Baumann die E-Mail?", context: "E-Mail: „Liebe Kolleginnen und Kollegen, aufgrund eines Termins beim Kunden verschiebe ich die heutige Besprechung auf Donnerstag, 14 Uhr. Bitte senden Sie mir Ihre Folien bis Mittwochabend. Viele Grüße, M. Baumann“", options: ["To postpone a meeting and request slides", "To cancel the client meeting", "To invite the team to a customer event", "To apply for internal training"], correct: 0, explanation: "Zentrale Infos: Verschiebung auf Donnerstag + Folien bis Mittwochabend." },
    { skill: "READING", prompt: "Bis wann müssen die Folien geschickt werden?", context: "E-Mail: „…Bitte senden Sie mir Ihre Folien bis Mittwochabend…“", options: ["Wednesday evening", "Thursday noon", "Immediately", "Friday"], correct: 0, explanation: "Explizit genannt: bis Mittwochabend." },
    { skill: "READING", prompt: "Was steht in der Stellenanzeige NICHT?", context: "Anzeige: „Wir suchen eine*n Kaufmann/-frau für Büromanagement. Wir bieten: flexible Arbeitszeiten, 30 Urlaubstage, Weiterbildungsbudget. Voraussetzung: abgeschlossene Ausbildung.“", options: ["Ein Firmenauto", "Flexible Arbeitszeiten", "30 Urlaubstage", "Weiterbildungsbudget"], correct: 0, explanation: "Firmenauto wird nicht erwähnt." },
    { skill: "LISTENING", prompt: "Welche Aufgabe übernimmt Frau Klein laut Ansage?", context: "Transkript: „Guten Tag, hier ist die Zentrale. Ab heute ist Frau Klein zuständig für die Betreuung unserer Geschäftspartner im Ausland. Herr Moser unterstützt sie ab Januar.“", options: ["Betreuung internationaler Partner", "Support ab Januar", "Leitung der Zentrale", "Buchhaltung"], correct: 0, explanation: "Frau Klein ist „zuständig für die Betreuung der Geschäftspartner im Ausland“; Moser hilft ab Januar." },
    { skill: "LISTENING", prompt: "Wann beginnt Herr Moser seine Unterstützung?", context: "Transkript: „…Herr Moser unterstützt sie ab Januar.“", options: ["Ab Januar", "Ab heute", "Ab Dezember", "Datum unbekannt"], correct: 0, explanation: "Explizit „ab Januar“." },
  ];

  // Compact banks reused for other lessons/exams (theme-matched).
  const mkBank = (theme: QSpec[]): QSpec[] => theme;

  const b2: ChapterSpec[] = [
    {
      title: "Arbeitswelt",
      titleDe: "Arbeitswelt",
      description: "Bewerbung, Meetings, Kommunikation am Arbeitsplatz und Arbeitsrecht — die Sprache des Berufslebens.",
      lessons: [
        {
          title: "Applications and CVs", titleDe: "Bewerbung und Lebenslauf",
          summary: "Structure a convincing German application: Anschreiben, Lebenslauf, Zeugnisse.",
          objectives: ["Write a formal Anschreiben", "Use polite register for applications", "Describe experience with Perfekt/Präteritum"],
          materials: [{ type: "worksheet", title: "Phrases for your Anschreiben", body: "Sehr geehrte Damen und Herren,\n\nmit großem Interesse habe ich Ihre Stellenausschreibung gelesen…" }, { type: "reading", title: "Sample job posting: Bürokaufmann/frau", body: "Wir suchen eine*n Kaufmann/-frau für Büromanagement…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Sehr geehrte Frau Meyer, ___ ich mich bei Ihnen bewerben.", options: ["möchte", "möchte gern", "will gern", "mag"], correct: 0, explanation: "Höflich-neutral: „möchte mich bewerben“." },
            { skill: "VOCABULARY", prompt: "„der Lebenslauf“ heißt auf Englisch ___.", options: ["CV / résumé", "cover letter", "reference", "contract"], correct: 0, explanation: "Lebenslauf = CV." },
            { skill: "GRAMMAR", prompt: "Ich habe zwei Jahre ___ Vertrieb gearbeitet.", options: ["im", "am", "in dem", "zum"], correct: 0, explanation: "Bereiche: „im Vertrieb“." },
            { skill: "READING", prompt: "Was wird verlangt?", context: "„Voraussetzung: abgeschlossene Ausbildung und sehr gute Deutschkenntnisse (B2).“", options: ["Completed training + B2 German", "University degree only", "Native German", "Three references"], correct: 0, explanation: "Beides explizit genannt." },
          ],
          homework: { title: "Your Anschreiben draft", instructions: "Write a short application email (80–120 words) for the sample posting.", writingPrompt: "Sehr geehrte Damen und Herren,\n\n…" },
        },
        {
          title: "Meetings and Discussions", titleDe: "Besprechungen und Meetings",
          summary: "Lead and participate in meetings: agenda, agreeing, disagreeing politely.",
          objectives: ["Present an agenda item", "Agree/disagree diplomatically", "Summarise decisions"],
          materials: [{ type: "worksheet", title: "Meeting phrases", body: "Ich möchte gerne zu Punkt 2 etwas ergänzen…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Ich bin ___ Ihrer Meinung, aber…", options: ["nicht ganz", "nicht ganze", "kein", "nichts"], correct: 0, explanation: "Diplomatischer Widerspruch: „nicht ganz deiner Meinung“." },
            { skill: "VOCABULARY", prompt: "„die Tagesordnung“ = ", options: ["agenda", "minutes", "vote", "break"], correct: 0, explanation: "Tagesordnung = agenda." },
            { skill: "GRAMMAR", prompt: "Wir haben beschlossen, ___ Projekt zu verschieben.", options: ["das", "dass", "dem", "des"], correct: 0, explanation: "Artikel „das Projekt“, nicht Konjunktion „dass“." },
            { skill: "LISTENING", prompt: "Was entscheidet das Team?", context: "Transkript: „Also, dann halten wir fest: Kampagne startet im März, Budget bleibt unverändert.“", options: ["Campaign starts in March", "Budget increases", "Campaign cancelled", "Decision postponed"], correct: 0, explanation: "Zusammenfassung: Start im März." },
          ],
          homework: { title: "Meeting minutes exercise", instructions: "Summarise the sample meeting in 5 bullet points.", writingPrompt: "Teilnehmer, Datum, Entscheidungen, Aufgaben, Verantwortliche…" },
        },
        {
          title: "Workplace Communication", titleDe: "Kommunikation am Arbeitsplatz",
          summary: "Email register, phone calls, giving and receiving feedback professionally.",
          objectives: ["Distinguish formal/informal workplace registers", "Give constructive feedback", "Handle misunderstandings politely"],
          materials: [{ type: "audio", title: "Listening: phone call with IT support (transcript)", body: "Guten Tag, mein Rechner startet seit heute Morgen nicht mehr…" }, { type: "slides", title: "Feedback formulas", body: "Positiv beginnen → Verbesserung vorschlagen → ermutigen" }],
          quiz: b2ch1l3Quiz,
          homework: {
            title: "Professional feedback email",
            instructions: "You lead a small team. Write a friendly but professional email (100–140 words) giving feedback to a colleague whose reports are often late. Include: appreciation, the concrete problem, a proposed solution, and an encouraging closing.",
            writingPrompt: "Betreff: Kurzes Feedback zu deinen Reports\n\nHallo Nadine,\n\n…" ,
          },
        },
        {
          title: "Employment Law and Workplace Culture", titleDe: "Arbeitsrecht und Betriebsklima",
          summary: "Contracts, vacation rights, works councils — key vocabulary of German work culture.",
          objectives: ["Understand contract clauses", "Discuss rights and duties", "Use passive constructions for rules"],
          materials: [{ type: "reading", title: "Extract: Arbeitsvertrag checklist", body: "Probezeit, Kündigungsfrist, Urlaubsanspruch…" }],
          quiz: [
            { skill: "VOCABULARY", prompt: "„die Probezeit“ bedeutet ___.", options: ["probation period", "drug test", "interview", "notice period"], correct: 0, explanation: "Probezeit = probation period." },
            { skill: "GRAMMAR", prompt: "Überstunden müssen ___ werden.", options: ["abgebaut", "abbauen", "abzubauen sein", "abbaubar"], correct: 0, explanation: "Passiv: müssen + Partizip II + werden." },
            { skill: "GRAMMAR", prompt: "Der Betriebsrat wird bei wichtigen Entscheidungen ___.", options: ["einbezogen", "einbeziehen", "einbezog", "einbezogen worden sei"], correct: 0, explanation: "Zustandspassiv Präsens." },
            { skill: "READING", prompt: "Wie lang ist die Kündigungsfrist?", context: "„Das Arbeitsverhältnis kann mit einer Frist von drei Monaten zum Quartalsende gekündigt werden.“", options: ["Three months to quarter end", "Three weeks", "End of month", "Six months"], correct: 0, explanation: "Explizit drei Monate zum Quartalsende." },
          ],
          homework: { title: "Contract clauses", instructions: "Explain two clauses of the sample contract in your own words.", writingPrompt: "Clause 1 means that…" },
        },
      ],
    },
    {
      title: "Media and Society",
      titleDe: "Medien und Gesellschaft",
      description: "Nachrichten, soziale Medien, Werbung und Medienkompetenz in der öffentlichen Diskussion.",
      lessons: [
        {
          title: "News and Press", titleDe: "Nachrichten und Presse",
          summary: "Understand news formats and reported speech in journalism.",
          objectives: ["Identify main message of articles", "Use Konjunktiv I for reporting", "Discuss media reliability"],
          materials: [{ type: "reading", title: "Sample article: Lokalpolitik", body: "Der Bürgermeister kündigte an, dass…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Der Sprecher sagte, die Verhandlungen ___ schwierig.", options: ["seien", "sind", "waren", "wären immer"], correct: 0, explanation: "Konjunktiv I für indirekte Rede." },
            { skill: "VOCABULARY", prompt: "„die Schlagzeile“ = ", options: ["headline", "footnote", "editor", "issue"], correct: 0, explanation: "Schlagzeile = headline." },
            { skill: "GRAMMAR", prompt: "Laut Umfrage ___ 60 % der Befragten dafür.", options: ["sei", "sind", "war", "wird"], correct: 0, explanation: "Indirekte Rede: Konjunktiv I „sei“." },
            { skill: "READING", prompt: "Was ist die Hauptmeldung?", context: "Artikel: „Die Stadtwerke planen, bis 2030 komplett auf Ökostrom umzustellen.“", options: ["Utility plans green transition by 2030", "Prices rise in 2030", "Utility closes", "Coal plant opens"], correct: 0, explanation: "Umstellung auf Ökostrom bis 2030." },
          ],
          homework: { title: "News summary", instructions: "Summarise a short news article in 60–80 words using reported speech.", writingPrompt: "In dem Artikel geht es um…" },
        },
        {
          title: "Social Media in Daily Life", titleDe: "Soziale Medien im Alltag",
          summary: "Talk about habits, privacy and digital wellbeing.",
          objectives: ["Discuss pros/cons", "Use reflexive verbs for opinions", "Understand colloquial written German"],
          materials: [{ type: "worksheet", title: "Discussion prompts", body: "Wie viel Zeit verbringst du täglich in sozialen Netzwerken?" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Ich kann mir ___ Leben ohne Smartphone kaum vorstellen.", options: ["ein", "einen", "einem", "eines"], correct: 0, explanation: "vorstellen + Akkusativ: sich ein Leben vorstellen." },
            { skill: "VOCABULARY", prompt: "„der Datenschutz“ = ", options: ["data protection", "backup", "spam", "logout"], correct: 0, explanation: "Datenschutz = data protection." },
            { skill: "GRAMMAR", prompt: "Viele Leute ärgern ___ über Werbung.", options: ["sich", "ihnen", "ihre", "sich selbst"], correct: 0, explanation: "Reflexivpronomen Nominativ 3.Pl.: sich." },
            { skill: "LISTENING", prompt: "Was nervt die Sprecherin?", context: "Transkript: „Was mich wirklich stört: Man scrollt zehn Minuten und sieht dieselben fünf Werbeanzeigen.“", options: ["Repeated ads", "Slow internet", "Fake news", "Long videos"], correct: 0, explanation: "„dieselben fünf Werbeanzeigen“." },
          ],
          homework: { title: "Opinion post", instructions: "Write a forum comment (80–120 words): Should phones be banned in schools?", writingPrompt: "Meiner Meinung nach…" },
        },
        {
          title: "Advertising and Consumption", titleDe: "Werbung und Konsum",
          summary: "Analyse advertising language and consumer trends.",
          objectives: ["Recognise persuasive techniques", "Compare products", "Use comparative/superlative correctly"],
          materials: [{ type: "reading", title: "Three print ads (transcripts)", body: "Jetzt neu! Doppelter Rabatt…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Dieses Angebot ist ___ als das andere.", options: ["günstiger", "günstigste", "am günstigsten", "so günstig"], correct: 0, explanation: "Komparativ mit „als“." },
            { skill: "VOCABULARY", prompt: "„der Rabatt“ ≈ ", options: ["discount", "receipt", "brand", "shelf"], correct: 0, explanation: "Rabatt = discount." },
            { skill: "GRAMMAR", prompt: "Kaufen Sie jetzt, ___ das Angebot endet!", options: ["bevor", "solange", "sobald", "bis"], correct: 2, explanation: "„sobald“ = as soon as." },
            { skill: "READING", prompt: "Welcher Appell fehlt in dieser Anzeige?", context: "„Umfrage zeigt: Kunden wollen vor allem schnellen Versand.“", options: ["Environmental appeal", "Speed", "Price", "Convenience"], correct: 0, explanation: "Nicht genannt; Speed/Preis/Bequemlichkeit kommen vor oder sind impliziert." },
          ],
          homework: { title: "Ad analysis", instructions: "Analyse one ad: target group, message, techniques (80–120 words).", writingPrompt: "Die Werbung richtet sich an…" },
        },
        {
          title: "Media Literacy", titleDe: "Medienkompetenz",
          summary: "Spot misinformation, check sources, discuss responsibly.",
          objectives: ["Evaluate sources", "Express doubt precisely", "Use modal verbs for probability"],
          materials: [{ type: "worksheet", title: "Source-check checklist", body: "Wer schreibt? Welche Belege? Wie aktuell?" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Das ___ doch nicht stimmen!", options: ["kann", "darf nicht wahr", "müsste", "wollte"], correct: 0, explanation: "„kann doch nicht stimmen“ = disbelief." },
            { skill: "VOCABULARY", prompt: "„die Quelle“ = ", options: ["source", "headline", "comment", "archive"], correct: 0, explanation: "Quelle = source." },
            { skill: "GRAMMAR", prompt: "Man ___ Nachrichten immer kritisch prüfen.", options: ["sollte", "will", "mag", "lässt"], correct: 0, explanation: "Empfehlung mit „sollte“." },
            { skill: "READING", prompt: "Warum ist der Artikel fragwürdig?", context: "Blogpost: „Alle wissen, dass… Studien beweisen das definitiv (Quelle unbekannt).“", options: ["No verifiable source", "Too short", "Old topic", "Wrong language"], correct: 0, explanation: "Quelle unbekannt → nicht überprüfbar." },
          ],
          homework: { title: "Fact-check memo", instructions: "Pick a claim and outline how you would verify it (60–100 words).", writingPrompt: "Um diese Behauptung zu prüfen, würde ich…" },
        },
      ],
    },
    {
      title: "Environment and Future",
      titleDe: "Umwelt und Zukunft",
      description: "Klimawandel, Energiewende, Mobilität und Verantwortung — Diskussionen über morgen.",
      lessons: [
        {
          title: "Climate Change in Everyday Life", titleDe: "Klimawandel im Alltag",
          summary: "Everyday causes/effects and personal footprint.",
          objectives: ["Describe environmental changes", "Use „weil/obwohl“ fluently", "Quantify with statistics language"],
          materials: [{ type: "reading", title: "Infografik transcript: CO₂ pro Haushalt", body: "Heizung 40 %, Mobilität 30 %…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Ich fahre weniger Auto, ___ ich CO₂ sparen möchte.", options: ["weil", "obwohl", "deshalb", "trotzdem"], correct: 0, explanation: "Kausalsatz mit weil, Verb Ende." },
            { skill: "VOCABULARY", prompt: "„der Stromverbrauch“ = ", options: ["electricity consumption", "water bill", "traffic jam", "power cut"], correct: 0, explanation: "Stromverbrauch = electricity usage." },
            { skill: "GRAMMAR", prompt: "___ es letztes Jahr sehr trocken war, blieben viele Flüsse flach.", options: ["Da", "Als ob", "Denn deshalb", "Sodass"], correct: 0, explanation: "„da“ = kausal, Nebensatz." },
            { skill: "READING", prompt: "Was verbraucht laut Grafik am meisten?", context: "Infografik: Heizung 40 %, Mobilität 30 %, Strom 20 %, Sonstiges 10 %.", options: ["Heating", "Mobility", "Electricity", "Other"], correct: 0, explanation: "Heizung 40 %." },
          ],
          homework: { title: "My footprint", instructions: "Describe three habits you could change (80–120 words).", writingPrompt: "Erstens könnte ich…" },
        },
        {
          title: "Renewable Energy", titleDe: "Erneuerbare Energien",
          summary: "Wind, solar, grids — technology vocabulary and debates.",
          objectives: ["Explain how technologies work", "Argue advantages/disadvantages", "Passive voice for processes"],
          materials: [{ type: "reading", title: "Text: Windenergie an Land", body: "Eine Windkraftanlage wandelt kinetische Energie um…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Solarstrom wird ___ Sonnenlicht erzeugt.", options: ["aus", "von dem", "mit das", "an"], correct: 0, explanation: "hergestellt/erzeugt aus + Dativ (Materialquelle)." },
            { skill: "VOCABULARY", prompt: "„die Windkraftanlage“ = ", options: ["wind turbine", "solar panel", "power line", "dam"], correct: 0, explanation: "Windkraftanlage = wind turbine." },
            { skill: "GRAMMAR", prompt: "Der Strom ___ in Batterien gespeichert.", options: ["wird", "worden ist", "ward", "wolle"], correct: 0, explanation: "Passiv Präsens: wird gespeichert." },
            { skill: "LISTENING", prompt: "Welchen Vorteil nennt der Referent zuerst?", context: "Transkript: „Der große Vorteil: Windstrom kostet keine Brennstoffe. Allerdings brauchen wir mehr Netze.“", options: ["No fuel costs", "More grids needed", "Cheap turbines", "Silent operation"], correct: 0, explanation: "„kostet keine Brennstoffe“ zuerst genannt." },
          ],
          homework: { title: "Technology explainer", instructions: "Explain one renewable technology simply (80–120 words).", writingPrompt: "Eine Windkraftanlage funktioniert so:" },
        },
        {
          title: "Future Mobility", titleDe: "Mobilität der Zukunft",
          summary: "Trains, e-cars, cycling cities — comparing transport futures.",
          objectives: ["Compare transport options", "Use future tenses/Futur I", "Discuss urban planning basics"],
          materials: [{ type: "worksheet", title: "Debate cards: Auto-freie Innenstadt?", body: "Pro: weniger Lärm… Contra: Handel leidet…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Bis 2040 ___ alle Bus elektrisch fahren.", options: ["werden", "wollen dass", "werden zu", "würden haben"], correct: 0, explanation: "Futur I: werden + Infinitiv." },
            { skill: "VOCABULARY", prompt: "„der Nahverkehr“ = ", options: ["local public transport", "long-haul flight", "car sharing", "highway"], correct: 0, explanation: "ÖPNV/Nahverkehr = local transport." },
            { skill: "GRAMMAR", prompt: "Man ___ mehr Radwege bauen.", options: ["müsste", "musste", "musse", "gemusst"], correct: 0, explanation: "Konjunktiv II für Empfehlungen." },
            { skill: "READING", prompt: "Was fordert der Text?", context: "Lesetext: „Der Stadtverband fordert ein Tempolimit von 30 km/h in der Innenstadt.“", options: ["30 km/h city limit", "New ring road", "Cheaper parking", "Bus ban"], correct: 0, explanation: "Tempolimit 30." },
          ],
          homework: { title: "City of the future", instructions: "Describe mobility in your ideal city (90–130 words).", writingPrompt: "In meiner Ideastadt gibt es…" },
        },
        {
          title: "Responsibility and Sustainability", titleDe: "Verantwortung und Nachhaltigkeit",
          summary: "Corporate responsibility, personal choices, persuasive discussion.",
          objectives: ["Weigh arguments", "Use „je…desto“", "Conclude formally"],
          materials: [{ type: "reading", title: "Op-ed excerpt: Verantwortung der Unternehmen", body: "Nachhaltigkeit beginnt nicht im Regal, sondern in der Lieferkette…" }],
          quiz: [
            { skill: "GRAMMAR", prompt: "Je mehr Menschen recyceln, ___ besser die Bilanz.", options: ["desto", "so", "als", "wie"], correct: 0, explanation: "je + Komparativ, desto + Komparativ." },
            { skill: "VOCABULARY", prompt: "„nachhaltig“ ≈ ", options: ["sustainable", "temporary", "cheap", "efficient"], correct: 0, explanation: "nachhaltig = sustainable." },
            { skill: "GRAMMAR", prompt: "Zusammenfassend ___ sagen, dass jeder Beitrag zählt.", options: ["lässt sich", "sich lässt", "lassen sich", "gelassen"], correct: 0, explanation: "„es lässt sich sagen“ = impersonal passive alternative." },
            { skill: "READING", prompt: "Wo setzt der Text an?", context: "„Nachhaltigkeit beginnt nicht im Regal, sondern in der Lieferkette.“", options: ["Supply chain", "Shops", "Consumers only", "Marketing"], correct: 0, explanation: "Lieferkette explizit." },
          ],
          homework: { title: "Mini essay", instructions: "Argue who bears most responsibility for sustainability: companies, politics, or individuals (120–150 words).", writingPrompt: "Aus meiner Sicht trägt… die größte Verantwortung, weil…" },
        },
      ],
    },
  ];

  // Minimal past levels (completed history for Lena) + shells for future ones.
  function minimalLessons(themeTitle: string, n: number): LessonSpec[] {
    return Array.from({ length: n }, (_, i) => ({
      title: `${themeTitle} — Unit ${i + 1}`,
      titleDe: `${themeTitle}, Einheit ${i + 1}`,
      summary: "Consolidation unit of the previous level.",
      objectives: ["Review core structures", "Extend vocabulary"],
      materials: [],
    }));
  }
  const b1: ChapterSpec[] = [
    { title: "Travel & Directions", titleDe: "Unterwegs", description: "Past level recap.", lessons: minimalLessons("Unterwegs", 2) },
    { title: "Health & Appointments", titleDe: "Gesundheit", description: "Past level recap.", lessons: minimalLessons("Gesundheit", 2) },
    { title: "Opinions & Discussion", titleDe: "Meinungen", description: "Past level recap.", lessons: minimalLessons("Meinungen", 2) },
  ];
  const a2: ChapterSpec[] = [
    { title: "Daily Routines", titleDe: "Alltag", description: "Past level recap.", lessons: minimalLessons("Alltag", 2) },
    { title: "Shopping & Food", titleDe: "Einkaufen", description: "Past level recap.", lessons: minimalLessons("Einkaufen", 2) },
  ];

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
        if (withAssessments && l.quiz?.length && li === 2 && ci === 0 && code === "B2") {
          // Full 20-question quiz only for the current lesson (B2 · Ch1 · L3).
          await attachQuiz("LESSON", lesson.id, l.quiz, 70);
        } else if (withAssessments && l.quiz?.length) {
          await attachQuiz("LESSON", lesson.id, l.quiz, 70);
        }
        if (withAssessments && l.homework) {
          await db.homework.create({
            data: {
              lessonId: lesson.id, title: l.homework.title,
              instructions: l.homework.instructions, writingPrompt: l.homework.writingPrompt,
              exercises: [
                { id: "ex1", prompt: "Complete: „Ich würde gern an der Schulung ___ (teilnehmen).“", sampleAnswer: "teilnehmen" },
                { id: "ex2", prompt: "Rewrite in the passive: „Der Manager prüft die Angebote.“", sampleAnswer: "Die Angebote werden (vom Manager) geprüft." },
              ],
              maxScore: 100,
            },
          });
        }
      }
      if (withAssessments) {
        // Chapter exam bank (shared style, 6 questions each)
        const examQs: QSpec[] = [
          { skill: "GRAMMAR", prompt: `Thema ${c.titleDe}: Der Bericht muss bis Freitag ___.`, options: ["fertiggestellt werden", "fertigstellen", "fertiggestellt worden", "fertigzustellen haben"], correct: 0, explanation: "Passiv mit Modalverb." },
          { skill: "VOCABULARY", prompt: `Welches Wort gehört zum Thema ${c.title}?`, options: [`die ${c.titleDe.split(" ")[0]}sfrage`, "die Schraube", "die Wiese", "der Zopf"], correct: 0, explanation: "Themenwort." },
          { skill: "GRAMMAR", prompt: "Formeller Vorschlag: Man ___ ein gemeinsames Treffen vereinbaren.", options: ["könnte", "konnte", "kann nur", "dürfte kaum"], correct: 0, explanation: "Konjunktiv II höflich." },
          { skill: "READING", prompt: "Kernaussage?", context: `Kurztext zum Kapitel ${c.titleDe}: Die Entwicklung wird insgesamt positiv bewertet, wenn auch mit Einschränkungen.`, options: ["Positiv mit Vorbehalten", "Negativ", "Neutral ohne Bewertung", "Unklar"], correct: 0, explanation: "„positiv, wenn auch mit Einschränkungen“." },
          { skill: "LISTENING", prompt: "Was wird angekündigt?", context: "Transkript: „Am Ende der Einheit erwartet Sie ein kurzer Test.“", options: ["A short test", "A holiday", "A book", "Nothing"], correct: 0, explanation: "kurzer Test angekündigt." },
          { skill: "GRAMMAR", prompt: "___ Sie bitte den Punkt noch einmal erläutern?", options: ["Könnten", "Kannten", "Werden", "Haben"], correct: 0, explanation: "Höfliche Bitte, Konjunktiv II." },
        ];
        const examQuiz = await attachQuiz("CHAPTER_EXAM", null, examQs, 70);
        await db.chapterExam.create({ data: { chapterId: chapter.id, quizId: examQuiz.id, passScore: 70 } });
      }
      createdChapters.push({ id: chapter.id, lessons: createdLessons });
    }
    if (withAssessments) {
      const finalQs: QSpec[] = [
        { skill: "GRAMMAR", prompt: "Abschlussprüfung: Er hätte das Problem früher melden ___.", options: ["müssen", "gemusst", "musste", "müssen haben"], correct: 0, explanation: "Modalverb-Infinitiv im Perfekt: hätte … melden müssen." },
        { skill: "VOCABULARY", prompt: "„die Voraussetzung“ = ", options: ["requirement", "assumption about money", "insurance", "signature"], correct: 0, explanation: "Voraussetzung = requirement/prerequisite." },
        { skill: "GRAMMAR", prompt: "Es wurde diskutiert, ___ das Budget erhöht werden soll.", options: ["ob", "um", "dass zu", "für dass"], correct: 0, explanation: "indirekte Frage mit „ob“." },
        { skill: "READING", prompt: "Tonfall des Textes?", context: "„Die Maßnahmen greifen teilweise — ein Durchbruch sieht anders aus.“", options: ["Critical-sceptical", "Enthusiastic", "Purely factual", "Humorous"], correct: 0, explanation: "kritisch-skeptisch." },
        { skill: "GRAMMAR", prompt: "___ Sie den Vertrag bereits unterschrieben?", options: ["Haben", "Sind", "Werden", "Gingen"], correct: 0, explanation: "Perfekt mit haben." },
        { skill: "LISTENING", prompt: "Was folgt auf die Präsentation?", context: "Ansage: „Nach der Präsentation haben Sie Zeit für Fragen, danach machen wir eine Pause.“", options: ["Q&A then break", "Break then Q&A", "Only break", "Next speaker immediately"], correct: 0, explanation: "Fragen → Pause." },
        { skill: "GRAMMAR", prompt: "Ich arbeite ___ drei Jahren in diesem Team.", options: ["seit", "vor", "für", "ab"], correct: 0, explanation: "Dauer bis jetzt: seit + Dativ." },
        { skill: "VOCABULARY", prompt: "Opposite of „die Mehrheit“:", options: ["die Minderheit", "die Meisterschaft", "die Mitteilung", "die Mehrzahl"], correct: 0, explanation: "Mehrheit ↔ Minderheit." },
        { skill: "GRAMMAR", prompt: "Der Vorschlag wurde ___.", options: ["abgelehnt", "ablehnen", "ablehnend", "abgelehnt werden"], correct: 0, explanation: "Zustandspassiv: wurde abgelehnt." },
        { skill: "READING", prompt: "Worum geht es primär?", context: "Text über Homeoffice: Produktivität, Kommunikation und Rechtliches im Vergleich.", options: ["Remote work overview", "Office furniture", "Commute times only", "Company history"], correct: 0, explanation: "Homeoffice-Themen." },
        { skill: "GRAMMAR", prompt: "Je öfter man übt, ___ leichter fällt es.", options: ["desto", "so wie", "als dass", "wie sehr"], correct: 0, explanation: "je … desto." },
        { skill: "VOCABULARY", prompt: "„vereinbaren“ ≈ ", options: ["arrange", "refuse", "cancel forever", "ignore"], correct: 0, explanation: "vereinbaren = arrange/agree on." },
      ];
      const finalQuiz = await attachQuiz("LEVEL_EXAM", null, finalQs, 70);
      await db.levelExam.create({ data: { levelId, quizId: finalQuiz.id, passScore: 70, proctoringRequired: true } });
    }
    return createdChapters;
  }

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

  const b2Chapters = await createCurriculum("B2", b2, true);
  const b1Chapters = await createCurriculum("B1", b1, true);
  const a2Chapters = await createCurriculum("A2", a2, true);

  // ── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo1234!", 10);

  async function mkUser(u: { name: string; email: string; roleType: Parameters<typeof db.user.create>[0]["data"]["roleType"]; color: string }) {
    return db.user.create({ data: { name: u.name, email: u.email, passwordHash, roleType: u.roleType, avatarColor: u.color } });
  }

  // Students
  const lena = await mkUser({ name: "Lena Schmidt", email: "lena.schmidt@demo.deutschpath.dev", roleType: "STUDENT", color: "#4338CA" });
  const max = await mkUser({ name: "Max Weber", email: "max.weber@demo.deutschpath.dev", roleType: "STUDENT", color: "#0F766E" });
  const amira = await mkUser({ name: "Amira Khalil", email: "amira.khalil@demo.deutschpath.dev", roleType: "STUDENT", color: "#B45309" });

  await db.studentProfile.createMany({
    data: [
      { userId: lena.id, ageRange: "25–34", country: "Germany", nativeLanguage: "English", learningGoal: "Work & career", expectedLevel: "B1", preferredStudyTimes: "Evenings", studyPreference: "balanced", onboardedAt: daysAgo(220) },
      { userId: max.id, ageRange: "18–24", country: "Poland", nativeLanguage: "Polish", learningGoal: "University studies", expectedLevel: "A2", preferredStudyTimes: "Afternoons", studyPreference: "focused", onboardedAt: daysAgo(60) },
      { userId: amira.id, ageRange: "35–44", country: "Egypt", nativeLanguage: "Arabic", learningGoal: "Everyday life in Germany", expectedLevel: "A1", preferredStudyTimes: "Mornings", studyPreference: "relaxed", onboardedAt: daysAgo(20) },
    ],
  });

  // Teachers (9 incl. pipeline applicant)
  const teacherSpecs = [
    { name: "Stefan Brinkmann", email: "stefan.brinkmann@demo.deutschpath.dev", color: "#4338CA", rank: "SENIOR", headline: "Business-German specialist with 12 years of classroom and corporate experience", bio: "Ich unterrichte Deutsch als Fremdsprache mit Schwerpunkt Beruf und Wirtschaft. Meine Studierenden bereite ich gezielt auf Meetings, Präsentationen und Prüfungen vor — strukturiert, geduldig und mit viel echtem Material.", years: 12, certification: "Goethe-Zertifikat C2 · DaF-Prüferin/Erfahrung", rating: 4.9, ratingCount: 214, lessons: 1240, responseMin: 15, online: true, specialties: ["Business German", "Exam preparation"], langs: ["German (native)", "English"], cancellationRate: 2, quality: 93, hourly: 3400 },
    { name: "Aylin Kaya", email: "aylin.kaya@demo.deutschpath.dev", color: "#0F766E", rank: "EXPERT", headline: "Expert trainer for academic and medical German", bio: "Promovierte Linguistin, spezialisiert auf akademisches Schreiben und medizinisches Deutsch. Ich liebe es, komplexe Grammatik greifbar zu machen.", years: 15, certification: "telc C2 · DaZ-Trainerin", rating: 4.8, ratingCount: 187, lessons: 980, responseMin: 25, online: true, specialties: ["Academic writing", "Medical German"], langs: ["German (native)", "Turkish", "English"], cancellationRate: 3, quality: 90, hourly: 3800 },
    { name: "Markus Vogel", email: "markus.vogel@demo.deutschpath.dev", color: "#B45309", rank: "ADVANCED", headline: "Structured grammar coach up to B2", bio: "Systematisch zur Sicherheit: Ich arbeite mit klaren Lernpfaden und vielen Wiederholungen.", years: 7, certification: "Goethe-Zertifikat C2", rating: 4.7, ratingCount: 121, lessons: 640, responseMin: 45, online: false, specialties: ["Grammar coaching"], langs: ["German (native)", "English", "Spanish"], cancellationRate: 5, quality: 86, hourly: 2900 },
    { name: "Julia Hartmann", email: "julia.hartmann@demo.deutschpath.dev", color: "#BE185D", rank: "INTERMEDIATE", headline: "Friendly guide for beginners through B1", bio: "Geduld und Mut machen den Unterschied: kleine Erfolge, große Wirkung.", years: 4, certification: "Goethe-Zertifikat C1", rating: 4.6, ratingCount: 88, lessons: 310, responseMin: 30, online: true, specialties: ["Beginner courses", "Conversation"], langs: ["German (native)", "English"], cancellationRate: 4, quality: 84, hourly: 2500 },
    { name: "Tobias Richter", email: "tobias.richter@demo.deutschpath.dev", color: "#374151", rank: "JUNIOR", headline: "Motivating tutor for A1–A2 learners", bio: "Ich bringe frische Energie in jede Stunde und feiere jeden Fortschritt.", years: 1, certification: "Goethe-Zertifikat C1", rating: 4.3, ratingCount: 31, lessons: 85, responseMin: 60, online: true, specialties: ["Beginner courses"], langs: ["German (native)", "English"], cancellationRate: 8, quality: 78, hourly: 1900 },
    { name: "Elena Petrova", email: "elena.petrova@demo.deutschpath.dev", color: "#6D28D9", rank: "SENIOR", headline: "Senior instructor for exam preparation (B1–C1)", bio: "Prüfungserfahrung aus über 1.000 Unterrichtsstunden — ich weiß, worauf es ankommt.", years: 11, certification: "Goethe-Zertifikat C2 · telc-Prüferin", rating: 4.9, ratingCount: 198, lessons: 1105, responseMin: 20, online: false, specialties: ["Exam preparation"], langs: ["Russian", "German", "English"], cancellationRate: 2, quality: 92, hourly: 3200 },
    { name: "Karim Haddad", email: "karim.haddad@demo.deutschpath.dev", color: "#047857", rank: "ADVANCED", headline: "Conversation-focused trainer", bio: "Sprechen von Tag eins — mit Korrekturen, die weiterbringen.", years: 6, certification: "Goethe-Zertifikat C2", rating: 4.2, ratingCount: 76, lessons: 420, responseMin: 90, online: false, specialties: ["Conversation", "Pronunciation"], langs: ["Arabic", "German", "English"], cancellationRate: 12, quality: 71, hourly: 2700 },
    { name: "Sabine Neumann", email: "sabine.neumann@demo.deutschpath.dev", color: "#A16207", rank: "INTERMEDIATE", headline: "Everyday-German coach for newcomers", bio: "Deutsch für den Alltag: Behörden, Arztbesuche, Nachbarschaft.", years: 5, certification: "Goethe-Zertifikat C1", rating: 4.4, ratingCount: 64, lessons: 265, responseMin: 40, online: false, specialties: ["Beginner courses", "Integration"], langs: ["German (native)", "English"], cancellationRate: 6, quality: 82, hourly: 2400 },
  ] as const;

  const teachers: Array<{ userId: string; profileId: string; name: string; rank: string }> = [];
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
    teachers.push({ userId: user.id, profileId: profile.id, name: t.name, rank: t.rank });
  }
  const byName = (n: string) => teachers.find((t) => t.name.startsWith(n))!;
  const stefan = byName("Stefan");
  const aylin = byName("Aylin");
  const elena = byName("Elena");
  const karim = byName("Karim");
  const julia = byName("Julia");
  const tobias = byName("Tobias");

  // Applicant in onboarding pipeline
  const felix = await mkUser({ name: "Felix Braun", email: "felix.braun@demo.deutschpath.dev", roleType: "TEACHER", color: "#713F12" });
  await db.teacherProfile.create({
    data: {
      userId: felix.id, rank: "INTERMEDIATE", headline: "Applicant — native speaker with tutoring background",
      bio: "Bewerbung als Deutsch-Trainer für Anfänger.", yearsExperience: 2,
      certification: "Goethe-Zertifikat C1 (pending verification)",
      responseTimeMinutes: 60, hourlyRateCents: 2000, languages: ["German (native)", "English"],
      specialties: ["Beginner courses"], onboardingStage: "DOCUMENT_VERIFICATION", qualityScore: 85,
    },
  });

  // Admins
  const superAdmin = await mkUser({ name: "Dr. Katharina Wolf", email: "admin@demo.deutschpath.dev", roleType: "SUPER_ADMIN", color: "#1E1B4B" });
  const academicAdmin = await mkUser({ name: "Prof. Jonas Adler", email: "academic@demo.deutschpath.dev", roleType: "ACADEMIC_ADMIN", color: "#312E81" });
  const moderator = await mkUser({ name: "Miriam Falk", email: "moderator@demo.deutschpath.dev", roleType: "MODERATOR", color: "#9F1239" });
  const manager = await mkUser({ name: "Daniel Senf", email: "manager@demo.deutschpath.dev", roleType: "TEACHER_MANAGER", color: "#065F46" });
  await mkUser({ name: "Sara Lorenz", email: "support@demo.deutschpath.dev", roleType: "SUPPORT_ADMIN", color: "#92400E" });
  await mkUser({ name: "Peter Sturm", email: "finance@demo.deutschpath.dev", roleType: "FINANCE_ADMIN", color: "#164E63" });

  // ── Lena's learning state ──────────────────────────────────────────────────
  const b1Id = levels.B1!.id, b2Id = levels.B2!.id, a2Id = levels.A2!.id;
  await db.enrollment.create({ data: { studentId: lena.id, levelId: a2Id, status: "COMPLETED", startedAt: daysAgo(300), completedAt: daysAgo(220) } });
  await db.enrollment.create({ data: { studentId: lena.id, levelId: b1Id, status: "COMPLETED", startedAt: daysAgo(220), completedAt: daysAgo(95) } });
  await db.enrollment.create({ data: { studentId: lena.id, levelId: b2Id, startedAt: daysAgo(40) } });
  await db.enrollment.create({ data: { studentId: max.id, levelId: a2Id, startedAt: daysAgo(55) } });
  await db.enrollment.create({ data: { studentId: amira.id, levelId: levels.A1!.id, startedAt: daysAgo(18) } });

  // A2/B1/B2 lesson progress for Lena
  async function markLevelDone(chapters: Array<{ lessons: Array<{ id: string }> }>, levelCode: CefrCode, percent: number, xpBase: number) {
    for (const ch of chapters) {
      for (const l of ch.lessons) {
        await db.lessonProgress.create({
          data: {
            studentId: lena.id, lessonId: l.id, status: "COMPLETED",
            attendanceComplete: true, quizBestScore: 88, quizPassed: true, homeworkSubmitted: true,
            unlockedAt: daysAgo(200), completedAt: daysAgo(150),
          },
        });
      }
    }
    // pass all chapter exams + final
    const ces = await db.chapterExam.findMany({ where: { chapter: { level: { code: levelCode } } }, include: { chapter: true } });
    for (const ce of ces) {
      await db.examAttempt.create({
        data: { kind: "CHAPTER", studentId: lena.id, chapterExamId: ce.id, status: "PASSED", score: 86, passed: true, decidedAt: daysAgo(140) },
      });
    }
    const le = await db.levelExam.findUnique({ where: { levelId: levels[levelCode]!.id } });
    if (le) {
      const attempt = await db.examAttempt.create({
        data: { kind: "LEVEL_FINAL", studentId: lena.id, levelExamId: le.id, status: "PASSED", score: percent, passed: true, decidedAt: daysAgo(95), proctoringChecks: { identity: "verified-demo", recording: "not-stored-demo" } },
      });
      if (levelCode === "B1") {
        const serialB1 = "CERT-839293";
        await db.certificate.create({
          data: {
            serial: serialB1, studentId: lena.id, levelId: b1Id, score: 84,
            issuedAt: daysAgo(94), expiresAt: daysAgo(-1095),
            status: "VALID", examAttemptId: attempt.id,
            verificationHash: hash(`${serialB1}|Lena Schmidt|B1|84`),
          },
        });
        attempt.certificateId = (await db.certificate.findUniqueOrThrow({ where: { serial: serialB1 } })).id;
        await db.examAttempt.update({ where: { id: attempt.id }, data: { certificateId: attempt.certificateId } });
      }
    }
    await db.studentProgress.create({
      data: { studentId: lena.id, levelCode, completionPercent: percent, xp: xpBase, streakDays: 12, lastStudyDate: daysAgo(1) },
    });
  }
  await markLevelDone(a2Chapters, "A2", 100, 900);
  await markLevelDone(b1Chapters, "B1", 100, 1500);

  // B2: ch1 L1+L2 completed, L3 in progress (attendance done, quiz+homework open)
  const b2c1 = b2Chapters[0]!;
  const [b2l1, b2l2, b2l3] = b2c1.lessons;
  await db.lessonProgress.create({
    data: { studentId: lena.id, lessonId: b2l1!.id, status: "COMPLETED", attendanceComplete: true, quizBestScore: 92, quizPassed: true, homeworkSubmitted: true, unlockedAt: daysAgo(40), completedAt: daysAgo(34) },
  });
  await db.lessonProgress.create({
    data: { studentId: lena.id, lessonId: b2l2!.id, status: "COMPLETED", attendanceComplete: true, quizBestScore: 84, quizPassed: true, homeworkSubmitted: true, unlockedAt: daysAgo(34), completedAt: daysAgo(27) },
  });
  await db.lessonProgress.create({
    data: { studentId: lena.id, lessonId: b2l3!.id, status: "IN_PROGRESS", attendanceComplete: true, quizBestScore: 45, quizPassed: false, homeworkSubmitted: false, unlockedAt: daysAgo(27) },
  });
  await db.studentProgress.upsert({
    where: { studentId_levelCode: { studentId: lena.id, levelCode: "B2" } },
    create: { studentId: lena.id, levelCode: "B2", completionPercent: 22, xp: 700, streakDays: 4, lastStudyDate: daysAgo(1) },
    update: { completionPercent: 22, xp: 700, streakDays: 4, lastStudyDate: daysAgo(1) },
  });

  // Skill scores
  const skills: Array<[string, number]> = [["READING", 74], ["LISTENING", 68], ["WRITING", 58], ["SPEAKING", 62], ["GRAMMAR", 66], ["VOCABULARY", 71]];
  for (const [skill, score] of skills) {
    await db.skillScore.create({ data: { studentId: lena.id, skill: skill as never, score } });
  }
  for (const [skill, score] of [["READING", 41], ["LISTENING", 38], ["WRITING", 30], ["SPEAKING", 33], ["GRAMMAR", 36], ["VOCABULARY", 40]] as Array<[string, number]>) {
    await db.skillScore.create({ data: { studentId: max.id, skill: skill as never, score } });
  }

  // ── Bookings, sessions, ratings ────────────────────────────────────────────
  async function mkBooking(b: {
    studentId: string; teacherId: string; lessonId: string; mode: "INSTANT" | "SCHEDULED";
    status: "SCHEDULED" | "COMPLETED" | "CANCELLED_BY_TEACHER" | "NO_SHOW" | "IN_PROGRESS" | "CANCELLED_BY_STUDENT";
    scheduledAt: Date; priceCents?: number; withSession?: boolean;
  }) {
    const booking = await db.booking.create({
      data: {
        studentId: b.studentId, teacherId: b.teacherId, lessonId: b.lessonId,
        mode: b.mode, status: b.status, scheduledAt: b.scheduledAt,
        durationMinutes: 50, priceCents: b.priceCents ?? 2900,
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

  const bk1 = await mkBooking({ studentId: lena.id, teacherId: elena.userId, lessonId: b2l1!.id, mode: "SCHEDULED", status: "COMPLETED", scheduledAt: daysAgo(38), withSession: true });
  await db.teacherRating.create({
    data: { bookingId: bk1.id, studentId: lena.id, teacherId: elena.userId, overall: 5, explanation: 5, languageClarity: 5, punctuality: 5, interaction: 5, patience: 5, technicalQuality: 5, comment: "Sehr strukturierte Stunde, tolle Prüfungstipps!", createdAt: daysAgo(38, 14) },
  });
  const bk2 = await mkBooking({ studentId: lena.id, teacherId: stefan.userId, lessonId: b2l2!.id, mode: "INSTANT", status: "COMPLETED", scheduledAt: daysAgo(31), withSession: true });
  await db.teacherRating.create({
    data: { bookingId: bk2.id, studentId: lena.id, teacherId: stefan.userId, overall: 4, explanation: 5, languageClarity: 4, punctuality: 4, interaction: 4, patience: 4, technicalQuality: 4, comment: "Great meeting phrases; slightly fast at the end.", createdAt: daysAgo(31, 15) },
  });
  const bk3 = await mkBooking({ studentId: lena.id, teacherId: karim.userId, lessonId: b2l3!.id, mode: "SCHEDULED", status: "NO_SHOW", scheduledAt: daysAgo(2) });
  const bkUpcoming = await mkBooking({ studentId: lena.id, teacherId: stefan.userId, lessonId: b2l3!.id, mode: "SCHEDULED", status: "SCHEDULED", scheduledAt: daysAhead(1, 17) });
  const bkMax = await mkBooking({ studentId: max.id, teacherId: julia.userId, lessonId: a2Chapters[0]!.lessons[0]!.id, mode: "SCHEDULED", status: "SCHEDULED", scheduledAt: daysAhead(2, 10) });

  // Extra completed history for admin metrics (other students, past months)
  for (let i = 0; i < 14; i++) {
    const t = teachers[i % 6];
    const s = [lena.id, max.id, amira.id][i % 3]!;
    await mkBooking({
      studentId: s, teacherId: t!.userId, lessonId: b2l1!.id, mode: i % 2 ? "INSTANT" : "SCHEDULED",
      status: i % 7 === 3 ? "CANCELLED_BY_STUDENT" : "COMPLETED",
      scheduledAt: daysAgo(3 + i * 2), withSession: i % 7 !== 3,
    });
  }

  // Internal notes (private to teachers)
  await db.teacherNote.create({
    data: { authorId: stefan.userId, studentId: lena.id, bookingId: bk2.id, body: "Lena verwechselt noch Dativ/Akkusativ nach Wechselpräpositionen („in dem Meeting“ vs „ins Meeting“). Nächstes Mal: kurze Wiederholung + 5 Übungssätze. Aussprache von „höflich“ üben.", createdAt: daysAgo(31, 16) },
  });
  await db.teacherNote.create({
    data: { authorId: elena.userId, studentId: lena.id, bookingId: bk1.id, body: "Sehr motiviert, starkes Leseverständnis. Ziel: schriftliche Strukturen (Nominalstil) ausbauen.", createdAt: daysAgo(38, 15) },
  });

  // Favorites
  await db.favoriteTeacher.create({ data: { studentId: lena.id, teacherId: stefan.userId } });
  await db.favoriteTeacher.create({ data: { studentId: lena.id, teacherId: elena.userId } });
  await db.favoriteTeacher.create({ data: { studentId: max.id, teacherId: julia.userId } });

  // ── Moderation cases ───────────────────────────────────────────────────────
  const caseOpen = await db.reportCase.create({
    data: {
      caseId: "RPT-48213", openedByStudentId: lena.id, teacherId: karim.userId, bookingId: bk3.id,
      reason: "MISSED_OR_SHORTENED_LESSON",
      description: "The teacher did not join the session at all. I waited 25 minutes in the classroom. No message beforehand.",
      status: "OPEN",
      evidence: {
        create: [
          { kind: "ATTENDANCE_RECORD", content: "Student JOINED 17:00. Teacher: no join event recorded within 30 min.", meta: { booking: bk3.id } },
          { kind: "CHAT_LOG", content: "[17:04] Lena: Are you joining?\n[17:12] Lena: Still waiting…\n(no reply)", meta: {} },
        ],
      },
      actions: { create: { actorId: lena.id, action: "CASE_OPENED", note: "Automatic case creation from lesson complaint", createdAt: daysAgo(2, 18) } },
      createdAt: daysAgo(2, 18),
    },
  });
  const caseReview = await db.reportCase.create({
    data: {
      caseId: "RPT-51902", openedByStudentId: max.id, teacherId: tobias.userId, bookingId: bkMax.id,
      reason: "UNPREPARED_TEACHER",
      description: "The tutor seemed unprepared and read most answers directly from the solution sheet.",
      status: "UNDER_REVIEW",
      teacherResponse: "Ich hatte technische Probleme mit den Materialien und musste spontan auf die Lösungen zurückgreifen. Das werde ich künftig anders vorbereiten.",
      evidence: { create: { kind: "OTHER", content: "Student submitted screenshot placeholder (not stored in demo)", meta: {} } },
      actions: {
        create: [
          { actorId: max.id, action: "CASE_OPENED", createdAt: daysAgo(6) },
          { actorId: moderator.id, action: "STATUS_CHANGED", note: "Moved to UNDER_REVIEW, awaiting teacher statement deadline", createdAt: daysAgo(4) },
          { actorId: tobias.userId, action: "TEACHER_RESPONSE", note: "Statement received", createdAt: daysAgo(3) },
        ],
      },
      createdAt: daysAgo(6),
    },
  });
  await db.reportCase.create({
    data: {
      caseId: "RPT-39877", openedByStudentId: amira.id, teacherId: karim.userId,
      reason: "INAPPROPRIATE_CONDUCT",
      description: "Repeatedly late and dismissed my questions during the lesson.",
      status: "CLOSED",
      decision: "Warning issued to teacher; no credit refund (lesson was delivered).",
      decisionById: moderator.id, resolvedAt: daysAgo(20), closedAt: daysAgo(20),
      actions: {
        create: [
          { actorId: amira.id, action: "CASE_OPENED", createdAt: daysAgo(25) },
          { actorId: karim.userId, action: "TEACHER_RESPONSE", note: "Apologised; cited scheduling conflict", createdAt: daysAgo(23) },
          { actorId: moderator.id, action: "DECISION_RECORDED", note: "Warning issued", createdAt: daysAgo(20) },
          { actorId: moderator.id, action: "CASE_CLOSED", createdAt: daysAgo(20) },
        ],
      },
      createdAt: daysAgo(25),
    },
  });

  // Pending retake request (linked to Karim no-show booking)
  const rtq = b2l3!.id;
  await db.retakeRequest.create({
    data: {
      requestId: "RTK-73112", studentId: lena.id, teacherId: karim.userId, bookingId: bk3.id,
      lessonId: rtq, reason: "Teacher never showed up. I would like to repeat this lesson with another teacher.",
      status: "PENDING",
    },
  });

  // ── Vocabulary ─────────────────────────────────────────────────────────────
  const vocabB2 = [
    ["die Bewerbung", "application", "Ich habe heute meine Bewerbung geschickt.", "I sent my application today.", "noun, feminine"],
    ["die Frist", "deadline", "Die Frist läuft am Freitag ab.", "The deadline expires on Friday.", "noun, feminine"],
    ["das Gehalt", "salary", "Das Gehalt wird monatlich überwiesen.", "The salary is paid monthly.", "noun, neuter"],
    ["der Arbeitsvertrag", "employment contract", "Ich habe den Arbeitsvertrag unterschrieben.", "I signed the employment contract.", "noun, masculine"],
    ["die Besprechung", "meeting", "Die Besprechung beginnt um 9 Uhr.", "The meeting starts at 9.", "noun, feminine"],
    ["der Kollege", "colleague", "Mein Kollege unterstützt mich bei dem Projekt.", "My colleague supports me on the project.", "noun, masculine"],
    ["die Überstunden", "overtime", "Diese Woche muss ich Überstunden machen.", "This week I have to work overtime.", "noun, plural"],
    ["kündigen", "to resign / terminate", "Sie hat ihre Stelle gekündigt.", "She resigned from her position.", "verb"],
    ["die Ausbildung", "vocational training", "Er macht eine Ausbildung zum Kaufmann.", "He is doing vocational training as a clerk.", "noun, feminine"],
    ["verlässlich", "reliable", "Sie ist eine verlässliche Mitarbeiterin.", "She is a reliable colleague.", "adjective"],
    ["die Fristverlängerung", "extension of deadline", "Ich beantrage eine Fristverlängerung.", "I am applying for a deadline extension.", "noun, feminine"],
    ["zuständig", "responsible (for)", "Frau Klein ist für die Kunden zuständig.", "Ms. Klein is responsible for the customers.", "adjective"],
    ["der Fortschritt", "progress", "Wir machen gute Fortschritte.", "We are making good progress.", "noun, masculine"],
    ["die Herausforderung", "challenge", "Das ist eine echte Herausforderung.", "That is a real challenge.", "noun, feminine"],
    ["vereinbaren", "to arrange", "Können wir einen Termin vereinbaren?", "Can we arrange an appointment?", "verb"],
    ["die Erfahrung", "experience", "Sie hat viel Erfahrung im Vertrieb.", "She has a lot of experience in sales.", "noun, feminine"],
  ] as const;
  const vocabB1 = [
    ["der Termin", "appointment", "Ich habe morgen einen Termin beim Arzt.", "I have a doctor's appointment tomorrow.", "noun, masculine"],
    ["das Formular", "form", "Bitte füllen Sie das Formular aus.", "Please fill out the form.", "noun, neuter"],
    ["die Rechnung", "bill / invoice", "Die Rechnung kommt per Post.", "The invoice comes by mail.", "noun, feminine"],
    ["der Vorschlag", "suggestion", "Das ist ein guter Vorschlag.", "That is a good suggestion.", "noun, masculine"],
    ["sich entschuldigen", "to apologise", "Ich möchte mich entschuldigen.", "I would like to apologise.", "verb, reflexive"],
    ["die Umgebung", "surroundings", "Die Umgebung ist sehr ruhig.", "The surroundings are very quiet.", "noun, feminine"],
  ] as const;

  const vocabItems: Record<string, string> = {};
  const allVocab = [...vocabB2, ...vocabB1];
  for (let vi = 0; vi < allVocab.length; vi++) {
    const [word, tr, exDe, exEn, pos] = allVocab[vi]!;
    const item = await db.vocabularyItem.create({
      data: { word, translationEn: tr, exampleDe: exDe, exampleEn: exEn, partOfSpeech: pos, levelCode: vi >= vocabB2.length ? "B1" : "B2" },
    });
    vocabItems[word] = item.id;
  }
  const reviewPlan: Array<[string, number, number]> = [
    // [word, box, daysUntilDue]
    ["die Bewerbung", 3, 0], ["die Frist", 2, 0], ["das Gehalt", 1, 0], ["vereinbaren", 2, 0],
    ["die Besprechung", 4, 1], ["der Kollege", 3, 2], ["die Überstunden", 2, 1], ["kündigen", 1, 3],
    ["die Ausbildung", 3, 4], ["verlässlich", 1, 2], ["die Fristverlängerung", 2, 5], ["zuständig", 3, 1],
    ["der Fortschritt", 1, 0], ["die Herausforderung", 2, 6], ["die Erfahrung", 4, 3], ["der Termin", 3, 2],
    ["das Formular", 2, 1], ["die Rechnung", 1, 4], ["der Vorschlag", 2, 3],
  ];
  for (const [word, box, dueIn] of reviewPlan) {
    await db.studentVocabularyReview.create({
      data: {
        studentId: lena.id, itemId: vocabItems[word]!, box,
        intervalDays: [0, 1, 2, 4, 8, 16][box] ?? 1,
        dueAt: daysAgo(-dueIn, 9), lastReviewedAt: dueIn === 0 ? daysAgo(box) : daysAgo(box + 1),
      },
    });
  }
  for (const word of ["der Termin", "das Formular", "die Rechnung"]) {
    await db.studentVocabularyReview.create({
      data: { studentId: max.id, itemId: vocabItems[word]!, box: 1, intervalDays: 1, dueAt: daysAgo(0, 8) },
    });
  }

  // ── Billing ────────────────────────────────────────────────────────────────
  await db.package.createMany({
    data: [
      { name: "Learning Plus", kind: "SUBSCRIPTION", priceCents: 2900, credits: 4, description: "4 live lessons per month + unlimited self-study.", active: true },
      { name: "Intensive", kind: "SUBSCRIPTION", priceCents: 7900, credits: 12, description: "12 live lessons per month, priority scheduling.", active: true },
      { name: "Credit Pack 5", kind: "LESSON_CREDITS", priceCents: 6500, credits: 5, description: "Five single lesson credits, valid 6 months.", active: true },
      { name: "B2 Complete", kind: "LEVEL_PACKAGE", priceCents: 19900, credits: 16, description: "Full B2 journey: all live lessons + exams + certificate.", active: true },
    ],
  });
  const wallet = await db.wallet.create({ data: { studentId: lena.id } });
  const ledgerPlan: Array<[number, string, string | null]> = [
    [3, "SIGNUP_BONUS", null],
    [-1, "LESSON_BOOKING", "bk1"],
    [-1, "LESSON_BOOKING", "bk2"],
    [+1, "PACKAGE_PURCHASE", "pack5"],
    [-1, "LESSON_BOOKING", "bk-upcoming"],
  ];
  let bal = 0;
  let idx = 0;
  for (const [delta, reason, ref] of ledgerPlan) {
    bal += delta;
    await db.creditLedger.create({
      data: {
        walletId: wallet.id, delta, balanceAfter: bal, reason: reason as never,
        refType: ref?.startsWith("bk") ? "booking" : "package", refId: ref,
        idempotencyKey: `seed-${idx++}`,
        createdAt: daysAgo(idx * 5),
      },
    });
  }
  await db.wallet.create({ data: { studentId: max.id } });
  await db.subscription.create({
    data: { studentId: lena.id, planName: "Learning Plus", status: "ACTIVE", monthlyPriceCents: 2900, periodStart: daysAgo(10), periodEnd: daysAhead(20) },
  });
  await db.payment.createMany({
    data: [
      { studentId: lena.id, amountCents: 2900, status: "PAID", provider: "demo", reference: "PAY-100241", description: "Learning Plus — monthly", createdAt: daysAgo(40) },
      { studentId: lena.id, amountCents: 6500, status: "PAID", provider: "demo", reference: "PAY-100512", description: "Credit Pack 5", createdAt: daysAgo(12) },
      { studentId: max.id, amountCents: 2900, status: "PAID", provider: "demo", reference: "PAY-100633", description: "Learning Plus — monthly", createdAt: daysAgo(30) },
    ],
  });
  await db.teacherPayout.createMany({
    data: [
      { teacherId: stefan.userId, amountCents: 23000, status: "PENDING", periodStart: daysAgo(30), periodEnd: daysAgo(1) },
      { teacherId: elena.userId, amountCents: 18400, status: "PAID", periodStart: daysAgo(60), periodEnd: daysAgo(31), paidAt: daysAgo(30) },
    ],
  });

  // ── Notifications ──────────────────────────────────────────────────────────
  await db.notificationPreference.createMany({
    data: [{ userId: lena.id }, { userId: max.id }],
  });
  await db.notification.createMany({
    data: [
      { userId: lena.id, type: "lesson_reminder", titleKey: "Live lesson tomorrow at 17:00 with Stefan Brinkmann", link: "/student/schedule" },
      { userId: lena.id, type: "vocabulary", titleKey: "5 words are due for review today", link: "/student/vocabulary" },
      { userId: lena.id, type: "quiz_graded", titleKey: "Your quiz attempt scored 45% — review the topics and retry", link: "/student", readAt: daysAgo(1) },
      { userId: lena.id, type: "homework_feedback", titleKey: "Stefan Brinkmann left feedback on “Meeting minutes”", link: "/student/homework", readAt: daysAgo(20) },
      { userId: lena.id, type: "system", titleKey: "Certificate issued: B1 (CERT-839293)", link: "/verify/CERT-839293", readAt: daysAgo(90) },
      { userId: stefan.userId, type: "booking", titleKey: "New scheduled lesson: Lena Schmidt — Workplace Communication", link: "/teacher/upcoming" },
      { userId: moderator.id, type: "report_update", titleKey: "Case RPT-48213 opened", link: "/admin/reports" },
      { userId: manager.id, type: "system", titleKey: "Retake request RTK-73112 pending review", link: "/admin/retakes" },
    ],
  });

  // ── Audit log ──────────────────────────────────────────────────────────────
  await db.auditLog.createMany({
    data: [
      { actorId: academicAdmin.id, action: "certificate.issued", entityType: "certificate", entityId: "CERT-839293", meta: { level: "B1", score: 84 }, createdAt: daysAgo(94) },
      { actorId: moderator.id, action: "report.closed", entityType: "report_case", entityId: "RPT-39877", meta: { decision: "warning" }, createdAt: daysAgo(20) },
      { actorId: superAdmin.id, action: "role.updated", entityType: "user", entityId: manager.id, meta: { role: "TEACHER_MANAGER" }, createdAt: daysAgo(50) },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo accounts (password demo1234!):");
  console.log("  student : lena.schmidt@demo.deutschpath.dev");
  console.log("  teacher : stefan.brinkmann@demo.deutschpath.dev");
  console.log("  admin   : admin@demo.deutschpath.dev");
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
