/**
 * AI analysis using the Gemini REST API directly.
 *
 * Using fetch instead of the @google/generative-ai SDK because:
 * - fetch is guaranteed to work in Edge Runtime
 * - No SDK initialisation overhead
 * - Simpler timeout control via AbortSignal
 */
import { CONFIG } from "./config";
import { logger } from "./logger";
import type { AIAnalysis, Article } from "./types";

// ── Gemini REST types ─────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message: string; code: number; status: string };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

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
      return `[${i + 1}] ${a.source} | ${date}\nHEADLINE: ${a.title}\nSUMMARY: ${(a.summary || a.content).slice(0, 250)}`;
    })
    .join("\n\n");

  return `You are a senior Oil & Gas market intelligence analyst.
FOCUS: ${focus}
ARTICLES (${articles.slice(0, CONFIG.MAX_PROMPT_ARTICLES).length} from trusted sources):

${list}

RULES:
1. Analyze ONLY the articles above. Do NOT invent facts, prices, or quotes.
2. Cite article numbers like [1] or [1][3] for every major claim.
3. Use cautious language: "may", "could", "suggests", "indicates".
4. Never state future prices with certainty.

Return ONLY valid JSON with this exact structure:
{
  "executiveSummary": "3-4 sentences for C-suite. Cite articles.",
  "topStories": [{"title":"","importance":"2-3 sentences. Cite articles.","references":[1]}],
  "marketImpact": "2 paragraphs on price, supply/demand. Cite articles.",
  "opecPolicyImpact": "1-2 paragraphs on OPEC+ strategy. Cite articles.",
  "companyImpact": "1-2 paragraphs on company developments. Cite articles.",
  "risks": ["Risk with citation [N]"],
  "opportunities": ["Opportunity with citation [N]"],
  "watchlist": ["Key item executives should monitor"]
}
Generate 3-5 items per array. Be concise.`;
}

// ── Gemini REST call ──────────────────────────────────────────────────────────

async function callGemini(
  modelId: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.85,
        maxOutputTokens: 2500,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(CONFIG.AI_TIMEOUT_MS),
  });

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message ?? `Gemini API error ${response.status}`
    );
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(`Empty Gemini response (finishReason: ${reason ?? "unknown"})`);
  }

  return text;
}

// ── Response parser ───────────────────────────────────────────────────────────

function parseAnalysis(text: string): AIAnalysis {
  // Gemini with responseMimeType="application/json" should return pure JSON,
  // but strip any accidental markdown fences just in case.
  const jsonText = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(jsonText);

  return {
    executiveSummary: String(parsed.executiveSummary ?? ""),
    topStories: Array.isArray(parsed.topStories)
      ? parsed.topStories.map((s: Record<string, unknown>) => ({
          title: String(s.title ?? ""),
          importance: String(s.importance ?? ""),
          references: Array.isArray(s.references)
            ? (s.references as unknown[]).map(Number).filter(Boolean)
            : [],
        }))
      : [],
    marketImpact: String(parsed.marketImpact ?? ""),
    opecPolicyImpact: String(parsed.opecPolicyImpact ?? ""),
    companyImpact: String(parsed.companyImpact ?? ""),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    opportunities: Array.isArray(parsed.opportunities)
      ? parsed.opportunities.map(String)
      : [],
    watchlist: Array.isArray(parsed.watchlist)
      ? parsed.watchlist.map(String)
      : [],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeArticles(
  articles: Article[],
  focus: string
): Promise<AIAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.warn("GEMINI_API_KEY not configured — skipping AI analysis");
    return null;
  }

  if (articles.length === 0) {
    logger.warn("No articles to analyze");
    return null;
  }

  const prompt = buildPrompt(articles, focus);

  const tryModel = async (modelId: string): Promise<AIAnalysis> => {
    logger.info(`Calling Gemini REST API: ${modelId}`);
    const text = await callGemini(modelId, prompt, apiKey);
    return parseAnalysis(text);
  };

  // Primary model
  try {
    const analysis = await tryModel(CONFIG.AI_PRIMARY_MODEL);
    logger.info(`AI analysis done — model: ${CONFIG.AI_PRIMARY_MODEL}`);
    return analysis;
  } catch (err) {
    logger.warn(`Primary model failed: ${(err as Error).message}`);
  }

  // Fallback model
  try {
    const analysis = await tryModel(CONFIG.AI_FALLBACK_MODEL);
    logger.info(`AI analysis done — fallback: ${CONFIG.AI_FALLBACK_MODEL}`);
    return analysis;
  } catch (err) {
    logger.error(`Fallback model also failed: ${(err as Error).message}`);
    return null;
  }
}
