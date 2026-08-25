// AI learning assistant abstraction.
// Demo provider returns safe template responses grounded in the student's
// current CEFR level. OpenAI-compatible adapter activates only with a key.
export interface AiContext {
  level: string;
  lessonTitle?: string;
  nativeLanguage?: string;
}

export interface AiProvider {
  readonly name: string;
  readonly demoMode: boolean;
  reply(userMessage: string, ctx: AiContext): Promise<string>;
}

const GRAMMAR_TIPS: Record<string, string> = {
  A1: "At A1, focus on present-tense conjugation (ich du er/sie/es wir ihr sie/Sie), word order in simple sentences, and the four cases at a basic level (der/die/das).",
  A2: "At A2, practise Perfekt with haben/sein, modal verbs, and Wechselpräpositionen (in, an, auf…). Keep sentences short and check verb-final position in subordinate clauses.",
  B1: "At B1, master Konjunktiv II for polite requests (Könnten Sie…), Passiv forms, and relative clauses. Watch adjective endings after definite/indefinite articles.",
  B2: "At B2, refine Nominalstil (nominalisation), Konjunktiv I for reported speech, and connectors like dennoch, infolgedessen, wobei. Vary sentence structure deliberately.",
  C1: "At C1, work on text coherence: advanced connectors, participle constructions (Partizipialattribut), and precise academic register.",
  C2: "At C2, focus on nuance: register shifts, idiomatic collocations, and subtle modal particles (ja, doch, halt) in professional communication.",
};

export class DemoAiProvider implements AiProvider {
  readonly name = "demo";
  readonly demoMode = true;

  async reply(userMessage: string, ctx: AiContext): Promise<string> {
    const msg = userMessage.toLowerCase();
    if (msg.includes("grammar") || msg.includes("grammatik") || msg.includes("قواعد")) {
      return `[Demo] ${GRAMMAR_TIPS[ctx.level] ?? ""}${
        ctx.lessonTitle ? ` This connects well to your current lesson “${ctx.lessonTitle}”.` : ""
      }`;
    }
    if (msg.includes("vocab") || msg.includes("wortschatz") || msg.includes("مفردات")) {
      return `[Demo] For ${ctx.level} vocabulary: aim for 8–10 new words per study day and use the spaced-repetition reviews on your Vocabulary page. Words you mark as hard return sooner.`;
    }
    if (msg.includes("exam") || msg.includes("prüfung") || msg.includes("امتحان")) {
      return `[Demo] Your path unlocks the final ${ctx.level} exam after you pass every chapter exam. Each chapter exam draws from that chapter's question bank; the pass mark is 70%.`;
    }
    if (msg.includes("hallo") || msg.includes("hello")) {
      return "[Demo] Hallo! Nice to see you practising. Ask me about your current lesson, grammar topics, or how to prepare for your next live session.";
    }
    return `[Demo] Here is what I can suggest at ${ctx.level}: review today's due vocabulary, finish your current lesson tasks (attendance → quiz ≥70% → homework), and book your next live session. ${
      ctx.lessonTitle ? `You are working on “${ctx.lessonTitle}” — its quiz focuses on the lesson objectives.` : ""
    }`;
  }
}

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly demoMode = false;
  constructor(private apiKey: string, private model: string) {}

  async reply(userMessage: string, ctx: AiContext): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              `You are DeutschPath's German learning assistant. The student is CEFR ${ctx.level}` +
              (ctx.lessonTitle ? `, currently on lesson "${ctx.lessonTitle}"` : "") +
              `. Be concise, encouraging, and pedagogically precise.`,
          },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("AI provider returned no content");
    return text;
  }
}

export function getAiProvider(): AiProvider {
  const kind = process.env.AI_PROVIDER ?? "demo";
  if (kind === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAiProvider(process.env.OPENAI_API_KEY, process.env.AI_MODEL ?? "gpt-4o-mini");
  }
  return new DemoAiProvider();
}
