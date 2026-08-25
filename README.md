# DeutschPath

A production-minded MVP of a structured German-learning platform: a CEFR-aligned LMS (A1→C2) with live one-to-one teaching, teacher discovery & quality control, moderation tooling, exams with verifiable certificates — three distinct workspaces (Student / Teacher / Admin) on one codebase.

> **Brand note:** "DeutschPath" is a placeholder. The brand is isolated in [`src/config/brand.ts`](src/config/brand.ts) and can be renamed in one place.

---

## Tech stack

| Concern            | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| Framework          | Next.js 15 (App Router, RSC, Server Actions), TypeScript strict |
| Styling / UI       | Tailwind CSS + shadcn-style component kit (Radix primitives)   |
| Database           | PostgreSQL + Prisma (migrations + deterministic seed)          |
| Auth               | Signed JWT session cookie (`jose`, httpOnly/SameSite) + bcrypt |
| Validation         | Zod on every untrusted input (forms, API routes, server actions)|
| Forms              | React Hook Form + zodResolver                                  |
| Charts             | Recharts                                                       |
| i18n               | Cookie locale + EN/AR dictionaries + true RTL (logical CSS)    |
| Unit/integration   | Vitest + Testing Library (+ DB integration tests w/ rollback)  |
| E2E                | Playwright (full student happy path against prod server)       |

## Quick start

```bash
# 1. Requirements: Node ≥ 18.18, PostgreSQL 14+ running locally
createdb deutschpath                      # or use an existing DB

# 2. Configure
cp .env.example .env                      # set DATABASE_URL + AUTH_SECRET (openssl rand -hex 32)

# 3. Install, migrate, seed
npm install
npm run db:migrate                        # prisma migrate dev
npm run db:seed                           # deterministic demo data

# 4. Run
npm run dev                               # http://localhost:3000
```

Production:

```bash
npm run build && npm start
```

Useful commands:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm test               # vitest unit + DB-integration tests
npm run test:e2e       # Playwright (reseeds DB first via global-setup)
npm run db:reset       # drop & re-apply migrations + seed
```

## Demo accounts

Password for **all** demo accounts: `demo1234!`

| Role             | Email                                      | Notes                              |
| ---------------- | ------------------------------------------ | ---------------------------------- |
| Student (main)   | `lena.schmidt@demo.deutschpath.dev`        | B2 · Ch1 · Lesson 3 in progress; B1 certificate `CERT-839293`; pending retake `RTK-73112` |
| Teacher          | `stefan.brinkmann@demo.deutschpath.dev`    | Senior, online                     |
| Super Admin      | `admin@demo.deutschpath.dev`               | Full access incl. audit log        |
| Academic Admin   | `academic@demo.deutschpath.dev`            | Curriculum, retakes, certificates  |
| Moderator        | `moderator@demo.deutschpath.dev`           | Report cases & confidential evidence |
| Teacher Manager  | `manager@demo.deutschpath.dev`             | Onboarding pipeline & retakes      |
| Support Admin    | `support@demo.deutschpath.dev`             | Read-only student view             |
| Finance Admin    | `finance@demo.deutschpath.dev`             | Payments & payouts                 |

The **dev-only demo-account selector** appears on `/signin` only when `NODE_ENV !== "production"` **and** `DEMO_MODE === "true"` ([`src/lib/demo-mode.ts`](src/lib/demo-mode.ts)) — it is impossible to expose accidentally in production.

## Architecture

```
src/
├── config/         # brand.ts (renaming), domain.ts (ALL business rules), nav.ts, placement questions
├── domain/         # Pure business logic: rules.ts (progression/scoring/placement),
│                   # progression.ts (server-side access checks + transactions),
│                   # matching.ts (teacher↔level qualification), quality.ts, wallet.ts, certificates.ts
├── lib/            # auth.ts (sessions/guards), db.ts, routing.ts (middleware rules),
│                   # i18n/ (en/ar dictionaries + RTL), live/ ai/ payments/ (provider abstractions)
├── middleware.ts   # Role-based route protection (edge)
├── components/     # ui/ (design system), shell/, student/, teacher/, admin/, classroom/
└── app/
    ├── (auth)/ signin · signup          ├── onboarding/
    ├── verify/[serial]/                 # public certificate verification (QR + hash)
    ├── student/…   # dashboard, learning-path, lessons/[id](+/quiz), teachers, schedule,
    │               # classroom/[booking], post-lesson/[booking], homework, vocabulary, skills,
    │               # exams(+chapter/final), favorites, notifications, billing, settings, assistant
    ├── teacher/…   # overview(online toggle), upcoming, students(+[id]), review(+grading),
    │               # classroom/[booking], earnings, performance, availability, settings
    └── admin/…     # overview(charts), curriculum, students, teachers(pipeline), reports(+case detail),
                    # retakes(decisions), certificates(revoke), exams, payments, analytics, roles
prisma/schema.prisma # ~50 models: users/profiles, curriculum, progression, bookings/live sessions,
                     # quizzes/exams/certificates, homework, moderation, billing, notifications,
                     # vocabulary, audit log
```

### Key technical decisions

1. **The platform owns the sequence.** Lesson unlock is computed *only* on the server (`domain/rules.ts` + `domain/progression.ts`). Direct URLs to locked lessons render a precise lock explanation; manipulated requests fail authorization (`assertLessonAccess`, `assertChapterExamAccess`, `assertLevelExamAccess`). A lesson completes **only** when live attendance ✓ + quiz ≥ 70% ✓ (+ homework if required); completing all lessons unlocks the chapter exam; passing each exam opens the next chapter; all chapters ⇒ final exam.
2. **Single source of truth for rules.** Pass marks, XP, rank ceilings, quality weights/states, booking & cancellation rules, certificate wording, report lifecycle, retake credit, RBAC matrix — all in `config/domain.ts`, asserted by tests.
3. **Server Actions + transactions** for every state change that must not partially apply: lesson advancement, credit deduction/refund (idempotency keys), retake approval (credit return inside the same transaction), certificate issuance, moderation decisions. Financial/moderation mutations write `AuditLog` entries.
4. **RBAC everywhere.** Middleware guards route prefixes per role; every protected action re-checks permissions (`roleHas`) — hidden buttons are never the access control. Confidential case evidence is restricted to Moderator/Super Admin even from other admins' pages.
5. **Honest integration boundaries.** Live video, AI chat and payments are provider abstractions with explicit local demo adapters. The classroom shows a persistent “Local demo mode” banner; proctoring requirements are labeled “Demo placeholder”; the AI assistant prefixes replies with `[Demo]`. No fake “connected” states anywhere.

## Implemented features

**Student:** onboarding wizard with placement test (transparent scoring), dashboard (level %, tasks, next class, skills radar, vocab due, streak/XP), learning path across all six CEFR levels with completed/current/available/locked states, lesson pages (objectives, materials, task checklist), teacher discovery (qualification-filtered, favorites-first, instant/schedule flows, waiting queue empty-state), live classroom prototype (simulated video, controls, chat, whiteboard, timer, consent indicator, provider banner), post-lesson flow (6-category rating, required comment for low ratings, favorite toggle, separate report & retake actions with case IDs), 20-question quiz (autosave, navigation dots, confirm dialog, server scoring, explanations, weak-topic review, retry), homework (writing + exercises + labeled demo voice-note metadata, drafts, teacher grading display), spaced-repetition vocabulary, skill profiles, chapter exams + final-exam eligibility/proctoring boundary, certificates with public QR verification (`/verify/CERT-839293`), notifications, billing (wallet ledger, subscription, packages, payments), AI assistant (grounded demo adapter).

**Teacher:** go online/offline with availability validation, today's schedule + incoming instant request banner, KPIs (rating, lessons, cancellation rate, documented weighted quality score with Good Standing/Warning/Under Review/Suspended states), student preview before/during lessons (history, scores, notes), private internal notes, homework review queue with grading (score, corrections, recommended practice → notification), earnings (available/pending/lifetime + payouts), performance breakdown of the quality formula, availability view.

**Admin:** KPI overview with derived charts, curriculum explorer, student table, teacher onboarding pipeline (7 stages, advance action), report cases with full lifecycle (Open → Under Review → Teacher Response → Decision → Closed), evidence gating, audit trail per case, retake approvals that return exactly one credit transactionally, certificate revocation (confirm + audit), exam configuration/pass rates, payments & payouts, analytics, RBAC matrix viewer.

**Cross-cutting:** EN/AR with real RTL (logical properties throughout), loading skeletons, error boundaries + custom 404, disabled/locked/empty states, keyboard-focus rings, `prefers-reduced-motion` support, responsive layouts (mobile drawer nav → wide desktop), rate-limit integration points noted in auth/AI routes, `.env.example` with documented placeholders.

## Testing

```bash
npm test          # 33 tests: lesson/chapter/final unlock rules, quiz pass-fail boundaries,
                  # placement thresholds, Leitner intervals, teacher qualification matching,
                  # quality-score weights & states, single-bad-review safety, RBAC matrix,
                  # route-protection rules, certificate hash determinism, lifecycle constants,
                  # credit-ledger idempotency + insufficiency (real DB, rolled back)

npm run test:e2e  # 7 Playwright specs (reseeds DB): sign-in → dashboard → book compatible
                  # teacher → demo classroom → rating (attendance verified in DB) → pass quiz
                  # (100%, server-scored) → submit homework → lesson COMPLETED + next lesson
                  # AVAILABLE (DB-verified) → locked-content URL bypass blocked → cross-role
                  # access redirected by middleware
```

## Environment variables

See [`.env.example`](.env.example). Required: `DATABASE_URL`, `AUTH_SECRET` (≥ 32 chars).
Optional integrations — absent credentials mean the honest demo adapter is used:
`LIVE_PROVIDER` (+LiveKit/Daily keys), `AI_PROVIDER` (+`OPENAI_API_KEY`), `PAYMENTS_PROVIDER` (+Stripe key), `DEMO_MODE`.

## Integration boundaries (deliberately not faked)

- **Live video** — LocalDemoProvider renders simulated panels; LiveKit/Daily adapters activate with credentials.
- **Proctoring** — requirement checklist with explicit “Demo placeholder” statuses; no simulated secure proctoring.
- **Payments** — DemoPaymentsProvider settles instantly and labels itself; Stripe adapter is a boundary stub.
- **AI assistant** — template responses grounded in the student's level; OpenAI adapter activates with a key.
- **Certificates** — explicitly *platform-issued level completion* certificates; no external accreditation claimed.

## Recommended next steps

1. Real-time infrastructure (LiveKit/Daily wiring + WebRTC diagnostics).
2. Curriculum editor UI (levels/chapters/lessons CRUD behind `curriculum_edit` permission).
3. Scheduling system with real availability slotting (iCal sync, reminders via email/push).
4. File storage for homework voice notes (S3-compatible + virus scanning) and recording retention policy enforcement.
5. Notification delivery channels (email/push) + digest preferences.
6. Rate limiting middleware (auth, quiz submit, reports, AI) backed by Redis.
7. Analytics warehouse exports; more granular admin dashboards.
