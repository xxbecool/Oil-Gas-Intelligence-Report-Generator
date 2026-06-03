/**
 * AI analysis via OpenRouter API (OpenAI-compatible, Edge Runtime safe).
 *
 * OpenRouter gives access to 200+ models through one API key.
 * We use free Gemini models by default; the key is set as OPENROUTER_API_KEY.
 *
 * Docs: https://openrouter.ai/docs
 */
import { CONFIG } from "./config";
import { logger } from "./logger";
import type { AIAnalysis, AIResult, Article } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── OpenRouter response types ─────────────────────────────────────────────────

interface OpenRouterResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: {
    message: string;
    code?: number;
    type?: string;
    metadata?: Record<string, unknown>;
  };
  id?: string;
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

// ── OpenRouter fetch ──────────────────────────────────────────────────────────

async function callOpenRouter(
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
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://oil-gas-intelligence.vercel.app",
        "X-Title": "Oil & Gas Intelligence Report Generator",
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

  let data: OpenRouterResponse;
  try {
    data = (await response.json()) as OpenRouterResponse;
  } catch {
    throw new Error(`Non-JSON response from OpenRouter (HTTP ${response.status})`);
  }

  // OpenRouter error object
  if (data.error) {
    const { code, type, message } = data.error;

    if (response.status === 401 || type === "auth_error" || code === 401) {
      throw new Error(
        "QUOTA_OR_KEY: OpenRouter API key is invalid. " +
          "Check OPENROUTER_API_KEY in Vercel → Settings → Environment Variables."
      );
    }
    if (response.status === 402 || code === 402) {
      throw new Error(
        "QUOTA_EXCEEDED: OpenRouter credits are exhausted. " +
          "Add credits at openrouter.ai/credits, or switch to a free model."
      );
    }
    if (response.status === 429 || code === 429) {
      const isQuota =
        message.toLowerCase().includes("quota") ||
        message.toLowerCase().includes("exceeded") ||
        message.toLowerCase().includes("limit");
      throw new Error(
        isQuota
          ? "QUOTA_EXCEEDED: Rate/quota limit reached on this model. " +
              "Try again in a minute or switch to a different model."
          : `RATE_LIMIT: ${message}`
      );
    }
    if (response.status === 404 || code === 404) {
      throw new Error(
        `MODEL_NOT_FOUND: Model "${modelId}" not found on OpenRouter — trying next model.`
      );
    }

    throw new Error(`OpenRouter error (${response.status}): ${message}`);
  }

  if (!response.ok) {
    throw new Error(`OpenRouter HTTP ${response.status} ${response.statusText}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const reason = data.choices?.[0]?.finish_reason ?? "unknown";
    throw new Error(
      `Model returned no content (finish_reason: ${reason}). ` +
        "The prompt may have triggered a content filter."
    );
  }

  return content;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeArticles(
  articles: Article[],
  focus: string
): Promise<AIResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const error =
      "OPENROUTER_API_KEY is not set. " +
      "Add it in Vercel → Project → Settings → Environment Variables, then redeploy.";
    logger.warn(error);
    return { analysis: null, error };
  }

  if (articles.length === 0) {
    return { analysis: null, error: "No articles were collected to analyze." };
  }

  const prompt = buildPrompt(articles, focus);

  const models = [
    CONFIG.AI_PRIMARY_MODEL,         // google/gemini-2.0-flash-exp:free
    CONFIG.AI_FALLBACK_MODEL,        // mistralai/mistral-7b-instruct:free
    "meta-llama/llama-3.2-3b-instruct:free", // universal free fallback
  ];

  const modelErrors: string[] = [];

  for (let i = 0; i < models.length; i++) {
    const modelId = models[i];
    try {
      logger.info(`Calling OpenRouter — model: ${modelId}`);
      const text = await callOpenRouter(modelId, prompt, apiKey);
      const analysis = parseAnalysis(text);
      logger.info(`AI analysis complete — model: ${modelId}`);
      return { analysis, error: null };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`Model ${modelId} failed: ${msg}`);
      modelErrors.push(`[${modelId}] ${msg.replace(/^[A-Z_]+:\s*/, "")}`);

      // Auth/key/quota errors affect all models — stop immediately
      if (
        msg.startsWith("QUOTA_OR_KEY:") ||
        msg.startsWith("QUOTA_EXCEEDED:")
      ) {
        return { analysis: null, error: msg.replace(/^[A-Z_]+:\s*/, "") };
      }

      // Pause before next model to avoid rate-limit cascade
      if (i < models.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  const combinedErrors = modelErrors.join(" | ");
  return {
    analysis: null,
    error: combinedErrors || "AI analysis failed for unknown reason.",
  };
}
