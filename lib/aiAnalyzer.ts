/**
 * AI analysis via Groq API (OpenAI-compatible, Edge Runtime safe).
 *
 * Groq provides ultra-fast inference (1-3s vs 5-15s on other providers).
 * Free developer tier — set GROQ_API_KEY from console.groq.com/keys.
 *
 * Docs: https://console.groq.com/docs/openai
 */
import { CONFIG } from "./config";
import { logger } from "./logger";
import type { AIAnalysis, AIResult, Article } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Free models on Groq developer tier (fast inference, no credits needed)
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",  // most capable, best for structured JSON
  "mixtral-8x7b-32768",        // reliable fallback
  "llama-3.1-8b-instant",      // fastest last-resort
];

// ── Response types ────────────────────────────────────────────────────────────

interface GroqResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: {
    message: string;
    type?: string;
    code?: string | number;
  };
  model?: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(articles: Article[], focus: string): string {
  const list = articles
    .slice(0, CONFIG.MAX_PROMPT_ARTICLES)
    .map((a, i) => {
      const date = a.publishedAt
        ? new Date(a.publishedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Recent";
      return `[${i + 1}] SOURCE: ${a.source} | DATE: ${date}
HEADLINE: ${a.title}
SUMMARY: ${(a.summary || a.content).slice(0, 250)}`;
    })
    .join("\n\n");

  return `You are a senior Oil & Gas intelligence analyst. Produce a structured JSON briefing.

FOCUS AREA: ${focus}
ARTICLES (${articles.slice(0, CONFIG.MAX_PROMPT_ARTICLES).length} collected from trusted sources):

${list}

STRICT RULES:
- Analyze ONLY the articles above. Do NOT invent facts, prices, companies, or quotes.
- Cite article numbers in brackets for every major claim: [1], [2][4], etc.
- Use cautious language: "may", "could", "suggests", "indicates", "based on collected articles".
- Never state future prices with certainty.
- If a section has no relevant coverage, write "Insufficient data from collected articles."

Return ONLY a valid JSON object — no markdown, no explanation, just the JSON:
{
  "executiveSummary": "3-4 concise sentences for C-suite. Cite articles.",
  "topStories": [
    {"title": "Story title", "importance": "2-3 sentences on executive significance. Cite articles.", "references": [1, 2]}
  ],
  "marketImpact": "2 paragraphs on price, supply/demand dynamics. Cite articles.",
  "opecPolicyImpact": "1-2 paragraphs on OPEC+ production strategy. Cite or write 'No OPEC coverage in collected articles.'",
  "companyImpact": "1-2 paragraphs on major company developments. Cite articles.",
  "risks": ["Specific risk with citation [N]"],
  "opportunities": ["Specific opportunity with citation [N]"],
  "watchlist": ["Key development executives should monitor"]
}

Generate 3-5 topStories, 3-5 risks, 3-5 opportunities, 4-6 watchlist items.`;
}

// ── JSON extraction ───────────────────────────────────────────────────────────

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);

  return text.trim();
}

function parseAnalysis(text: string): AIAnalysis {
  const p = JSON.parse(extractJson(text));
  return {
    executiveSummary: String(p.executiveSummary ?? ""),
    topStories: Array.isArray(p.topStories)
      ? p.topStories.map((s: Record<string, unknown>) => ({
          title: String(s.title ?? ""),
          importance: String(s.importance ?? ""),
          references: Array.isArray(s.references)
            ? (s.references as unknown[]).map(Number).filter(Boolean)
            : [],
        }))
      : [],
    marketImpact: String(p.marketImpact ?? ""),
    opecPolicyImpact: String(p.opecPolicyImpact ?? ""),
    companyImpact: String(p.companyImpact ?? ""),
    risks: Array.isArray(p.risks) ? p.risks.map(String) : [],
    opportunities: Array.isArray(p.opportunities) ? p.opportunities.map(String) : [],
    watchlist: Array.isArray(p.watchlist) ? p.watchlist.map(String) : [],
  };
}

// ── Groq fetch ────────────────────────────────────────────────────────────────

async function callGroq(
  modelId: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`AI timeout after ${CONFIG.AI_TIMEOUT_MS}ms`)),
    CONFIG.AI_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2500,
        top_p: 0.85,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  let data: GroqResponse;
  try {
    data = (await response.json()) as GroqResponse;
  } catch {
    throw new Error(`Non-JSON response from Groq (HTTP ${response.status})`);
  }

  if (data.error) {
    const { type, message } = data.error;

    if (response.status === 401 || type === "invalid_api_key") {
      throw new Error(
        "QUOTA_OR_KEY: Groq API key is invalid. " +
          "Check GROQ_API_KEY in Vercel → Settings → Environment Variables."
      );
    }
    if (response.status === 429) {
      throw new Error(`RATE_LIMIT: ${message}`);
    }
    if (response.status === 400 && message.toLowerCase().includes("model")) {
      throw new Error(`MODEL_NOT_FOUND: Model "${modelId}" error — trying next.`);
    }

    throw new Error(`Groq error (${response.status}): ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status} ${response.statusText}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const reason = data.choices?.[0]?.finish_reason ?? "unknown";
    throw new Error(`Model returned no content (finish_reason: ${reason}).`);
  }

  return content;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeArticles(
  articles: Article[],
  focus: string
): Promise<AIResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    const error =
      "GROQ_API_KEY is not set. " +
      "Add it in Vercel → Project → Settings → Environment Variables, then redeploy. " +
      "Get a free key at console.groq.com/keys";
    logger.warn(error);
    return { analysis: null, error };
  }

  if (articles.length === 0) {
    return { analysis: null, error: "No articles were collected to analyze." };
  }

  const prompt = buildPrompt(articles, focus);
  const modelErrors: string[] = [];

  for (let i = 0; i < GROQ_MODELS.length; i++) {
    const modelId = GROQ_MODELS[i];
    try {
      logger.info(`Calling Groq — model: ${modelId}`);
      const text = await callGroq(modelId, prompt, apiKey);
      const analysis = parseAnalysis(text);
      logger.info(`AI analysis complete — model: ${modelId}`);
      return { analysis, error: null };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`Model ${modelId} failed: ${msg}`);
      modelErrors.push(`[${modelId}] ${msg.replace(/^[A-Z_]+:\s*/, "")}`);

      // Invalid key — no point trying other models
      if (msg.startsWith("QUOTA_OR_KEY:")) {
        return { analysis: null, error: msg.replace(/^[A-Z_]+:\s*/, "") };
      }

      if (i < GROQ_MODELS.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return {
    analysis: null,
    error: modelErrors.join(" | ") || "AI analysis failed for unknown reason.",
  };
}
