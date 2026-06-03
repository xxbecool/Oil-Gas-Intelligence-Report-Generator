/**
 * AI analysis via Gemini REST API (no SDK — guaranteed Edge Runtime safe).
 *
 * Returns AIResult so callers always know WHY analysis failed, not just that
 * it failed. The error message is threaded into the PDF "AI Not Available"
 * box so the user sees the exact reason without needing to check logs.
 */
import { CONFIG } from "./config";
import { logger } from "./logger";
import type { AIAnalysis, AIResult, Article } from "./types";

// ── Gemini REST response shape ────────────────────────────────────────────────

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string; code: number; status: string };
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

Return ONLY a JSON object — no markdown, no explanation, just JSON:
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
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Find the outermost JSON object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  return text.trim();
}

function parseAnalysis(text: string): AIAnalysis {
  const json = extractJson(text);
  const p = JSON.parse(json);

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

// ── REST fetch with manual timeout ───────────────────────────────────────────

async function callGeminiRest(
  modelId: string,
  prompt: string,
  apiKey: string
): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  // Manual AbortController — more reliable than AbortSignal.timeout() in Edge
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Gemini timeout after ${CONFIG.AI_TIMEOUT_MS}ms`)),
    CONFIG.AI_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.85,
          maxOutputTokens: 2500,
          // responseMimeType omitted — parse JSON from text for max compatibility
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  // Parse response body
  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch {
    throw new Error(`Gemini returned non-JSON body (HTTP ${response.status})`);
  }

  // Surface API-level errors with actionable messages
  if (data.error) {
    const { code, status, message } = data.error;
    if (code === 400) throw new Error(`Bad request to Gemini (${status}): ${message}`);
    if (code === 401 || code === 403)
      throw new Error(
        `Gemini API key invalid or permission denied (${status}). ` +
          "Check GEMINI_API_KEY in Vercel environment variables."
      );
    if (code === 429)
      throw new Error("Gemini rate limit reached. Wait a minute and try again.");
    if (code === 404)
      throw new Error(
        `Model "${modelId}" not found. It may have been retired — trying next model.`
      );
    throw new Error(`Gemini API error ${code} (${status}): ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status} ${response.statusText}`);
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    const reason = candidate?.finishReason ?? "unknown";
    throw new Error(
      `Gemini returned no text (finishReason: ${reason}). ` +
        "Prompt may have been blocked by safety filters."
    );
  }

  return text;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run AI analysis. Always returns an AIResult — never throws.
 * On failure, analysis is null and error contains the human-readable reason.
 */
export async function analyzeArticles(
  articles: Article[],
  focus: string
): Promise<AIResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error =
      "GEMINI_API_KEY environment variable is not set. " +
      "Add it in Vercel → Project Settings → Environment Variables, then redeploy.";
    logger.warn(error);
    return { analysis: null, error };
  }

  if (articles.length === 0) {
    return { analysis: null, error: "No articles were collected to analyze." };
  }

  const prompt = buildPrompt(articles, focus);

  // Try models in order of preference
  const models = [
    CONFIG.AI_PRIMARY_MODEL,   // gemini-2.0-flash
    CONFIG.AI_FALLBACK_MODEL,  // gemini-2.0-flash-lite
    "gemini-1.5-flash",        // stable legacy fallback
  ];

  const errors: string[] = [];

  for (const modelId of models) {
    try {
      logger.info(`Trying Gemini model: ${modelId}`);
      const text = await callGeminiRest(modelId, prompt, apiKey);
      const analysis = parseAnalysis(text);
      logger.info(`AI analysis complete — model: ${modelId}`);
      return { analysis, error: null };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error(`Model ${modelId} failed: ${msg}`);
      errors.push(`${modelId}: ${msg}`);

      // Don't try further models on auth/key errors — all will fail the same way
      if (msg.includes("API key") || msg.includes("permission denied")) {
        break;
      }
    }
  }

  const combinedError = `AI analysis failed after trying ${errors.length} model(s). Last error: ${errors[errors.length - 1]}`;
  logger.error(combinedError);
  return { analysis: null, error: combinedError };
}
