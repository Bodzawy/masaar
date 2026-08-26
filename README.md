# Masaar – Arabisch lernen online

**Masaar** (arabisch مسار, „der Weg") ist eine produktionsreife Lernplattform, auf der **Deutschsprachige Arabisch lernen** – von den ersten Buchstaben (A1) bis zu beinahe muttersprachlicher Beherrschung (C2). Die Plattform kombiniert einen strukturierten, datenbankgetriebenen Lernpfad mit Live-Einzelunterricht, Prüfungen, Zertifikaten und einer vollständigen Verwaltungs- und Moderationsseite.

> **Produktkern:** Die Plattform besitzt die Lernfolge. Lehrkräfte unterrichten genau die Lektion, die der Lernweg vorgibt – sie entscheiden nicht, was als Nächstes gelernt wird.

## Tech-Stack

| Bereich | Technologie |
| --- | --- |
| Framework | Next.js 15 (App Router, RSC, Server Actions), TypeScript strict |
| UI | Tailwind CSS + shadcn-artiges Komponenten-Kit (Radix Primitives) |
| Datenbank | PostgreSQL + Prisma (Migrationen + deterministischer Seed) |
| Auth | Signiertes JWT-Session-Cookie (`jose`, httpOnly/SameSite) + bcrypt |
| Validierung | Zod in allen untrusted Inputs (Forms, API-Routen, Server Actions) |
| Forms | React Hook Form + zodResolver |
| Charts | Recharts |
| i18n | Deutsch (primär) + Englisch; arabischer Inhalt als RTL-Inseln im LTR-Layout |
| Tests | Vitest (+ DB-Integrationstests) und Playwright (E2E) |

## Schnellstart

```bash
# Voraussetzungen: Node ≥ 18.18, PostgreSQL 14+
createdb masaar                      # oder bestehende DB verwenden
cp .env.example .env                 # DATABASE_URL + AUTH_SECRET setzen (openssl rand -hex 32)

npm install
npm run db:migrate                   # prisma migrate dev
npm run db:seed                      # deterministische Demo-Daten (arabisches Curriculum)

npm run dev                          # http://localhost:3000
```

Produktion: `npm run build && npm start`

Nützliche Skripte:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm test               # Vitest: Einheit + DB-Integration
npm run test:e2e       # Playwright (seedet vorab via global-setup)
npm run db:reset       # Migrationen zurücksetzen + seeden
```

## Demo-Konten

Passwort für alle Demo-Konten: `demo1234!`

| Rolle | E-Mail | Hinweis |
| --- | --- | --- |
| Lernende (Hauptdemo) | `lena.schmidt@demo.deutschpath.dev` | B2 · Kapitel 1 · Lektion 3 läuft; B1-Zertifikat `CERT-839293`; offene Wiederholung `RTK-73112` |
| Lehrkraft | `omar.elsayed@demo.deutschpath.dev` | Senior, online |
| Super-Admin | `admin@demo.deutschpath.dev` | Vollzugriff inkl. Audit-Log |
| Academic Admin | `academic@demo.deutschpath.dev` | Curriculum, Wiederholungen, Zertifikate |
| Moderator | `moderator@demo.deutschpath.dev` | Meldungen & vertrauliche Beweismittel |
| Teacher Manager | `manager@demo.deutschpath.dev` | Onboarding-Pipeline & Wiederholungen |
| Support Admin | `support@demo.deutschpath.dev` | Lesender Zugriff auf Lernende |
| Finance Admin | `finance@demo.deutschpath.dev` | Zahlungen & Auszahlungen |

Der **Demo-Konto-Auswahler** erscheint auf `/signin` ausschließlich wenn `NODE_ENV !== "production"` **und** `DEMO_MODE === "true"` – er lässt sich in Produktion nicht versehentlich exponieren.

## Curriculum (Modernes Hocharabisch / فصحى)

- **A1 Grundlagen** – Arabisches Alphabet, Buchstabenformen, Harakat, Begrüßungen, Zahlen, erste Nominalsätze
- **A2 Alltag** – Tagesablauf, Essen und Trinken, Einkaufen, Uhrzeit, Reisen, Wegbeschreibung
- **B1 Kommunikation** – Längere Gespräche, Vergangenheits-/Zukunftsformen, Meinungen, Alltagssituationen
- **B2 Fortgeschrittene Kommunikation** – Medien und Gesellschaft, Beruf und Studium, Kultur und Geschichte
- **C1 Wissenschaft & Beruf**, **C2 Beherrschung** – akademisches Arabisch, klassische Texte, Nuancen

Lehrkräfte führen Schwerpunkte wie *Modernes Hocharabisch*, *Ägyptischer Dialekt*, *Levantinisches Arabisch*, *Konversation*, *Grammatik*, *Aussprache* usw.

## Arabisch-Unterstützung

- UI-Shell bleibt **LTR (Deutsch)**; arabische Inhalte laufen als **RTL-Inseln** (`<ArabicText dir="rtl" lang="ar">`) mit der Lernschrift **Noto Naskh Arabic**
- Gemischte Texte über `dir="auto"` je Absatz/Quizoption – Satzzeichen und Wortstellung bleiben stabil
- Arabische Eingaben: Quiz-Antworten, Hausaufgaben-Textarea (`dir="auto"`, `lang="ar"`), Vokabel-Ansicht
- Harakat werden end-to-end erhalten (Seed → DB → Rendering); Eingabe, Copy/Paste und Selektion sind per E2E abgedeckt

## Architektur (Kurzform)

```
src/config/    brand.ts · domain.ts (alle Geschäftsregeln) · nav.ts · placement.ts
src/domain/    rules.ts (Freischalt-/Scoring-Logik) · progression.ts · matching.ts · quality.ts · wallet.ts
src/lib/       auth.ts · routing.ts · i18n/{de,en} · live/ ai/ payments/ (Provider-Abstraktionen)
src/app/       student/ teacher/ admin/ verify/[serial] onboarding/ api/
prisma/        schema (~50 Modelle), Migrationen, seed.ts
e2e/           happy-path · lesson-path-regression · arabic-content · quality-sweep
```

Wichtige Prinzipien: serverautoriative Progression (Teilnahme ✓ + Quiz ≥ 70 % ✓ + Hausaufgabe ✓ → nächste Lektion), idempotente Guthaben-Ledger, RBAC-Matrix in `config/domain.ts`, Audit-Log für finanzielle und moderatorische Aktionen, ehrliche Demo-Adapter für Video/AI/Payments (niemals „verbunden" vortäuschen).

## Tests

```bash
npm test          # 33 Tests: Freischaltregeln, Quiz-Grenzen, Einstufung, Leitner-Intervalle,
                  # Lehrkräfte-Qualifikation, Qualitätspunktzahl, RBAC-Matrix, Routing-Schutz,
                  # Zertifikats-Hash, Guthaben-Ledger (idempotent, echte DB mit Rollback)
npm run test:e2e  # 22 Playwright-Specs (seedet vorab):
                  # – kompletter Lernpfad: Buchung → Klassenzimmer → Bewertung → Quiz (100 %)
                  #   → Hausaufgabe → Abschluss + Freischaltung (DB-assertiert)
                  # – Regression „Lernweg starten" (frische:r Lernende:r ohne Einschreibung,
                  #   Serverfehler → verständliche Meldung → Wiederholung möglich)
                  # – Arabisch-Inhalte: RTL-Inseln, gemischte Richtung, Harakat, Eingaben
                  # – Qualitäts-Sweep: 3 Viewports, kein Überlauf, keine Konsolen-/Hydrationsfehler
```

## Deployment (Vercel + Neon)

1. **Datenbank anlegen:** Neon-Projekt erstellen (Free Tier genügt) und den *pooled connection string* kopieren.
2. **Schema & Seed einspielen:** einmalig lokal gegen die Produktions-DB:
   ```bash
   DATABASE_URL="<neon-pooled-url>" npx prisma migrate deploy
   DATABASE_URL="<neon-direct-url>" npx prisma db seed
   ```
3. **Vercel-Projekt verbinden:** `vercel link` im Repo-Ordner.
4. **Environment Variables setzen** (Vercel-Dashboard oder `vercel env add`): siehe `.env.production.example`
   – Pflicht: `DATABASE_URL`, `AUTH_SECRET` (min. 32 Zeichen). Optional: Demo-/Integrations-Flags.
5. **Deployen:** `vercel --prod`. Nach dem ersten Deploy die Domain in Neon ggf. auf die Vercel-IPs/Region freigeben.

Hinweise: Cookies sind in Produktion automatisch `secure`; der Demo-Auswahler ist deaktiviert, solange `DEMO_MODE` nicht explizit `"true"` ist. Alle Runtime-URLs werden aus der Request-Origin abgeleitet – keine hartcodierten Hosts.

## Integrations-Grenzen

Video (LiveKit/Daily), KI-Assistent (OpenAI) und Zahlungen (Stripe) sind als Provider-Abstraktionen vorbereitet. Ohne Zugangsdaten laufen ehrliche lokale Demo-Adapter, die sich klar als solche kennzeichnen. Prüfungs-Aufsicht (Proctoring) ist als Integrationsgrenze mit „Demo-Platzhalter"-Status dargestellt. Zertifikate sind ausdrücklich **plattform-eigene Abschlusszertifikate** – es wird keine externe Akkreditierung behauptet.
