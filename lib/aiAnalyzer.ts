import { GoogleGenerativeAI } from "@google/generative-ai";
import { CONFIG } from "./config";
import { logger } from "./logger";
import type { AIAnalysis, Article } from "./types";

function buildPrompt(articles: Article[], focus: string): string {
  const articleList = articles
    .slice(0, CONFIG.MAX_PROMPT_ARTICLES)
    .map((a, i) => {
      const date = a.publishedAt ? a.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent";
      return `[${i + 1}] SOURCE: ${a.source} | DATE: ${date} | CATEGORY: ${a.category}
HEADLINE: ${a.title}
SUMMARY: ${a.summary || a.content.slice(0, 300)}`;
    })
    .join("\n\n---\n\n");

  return `You are a senior Oil & Gas market intelligence analyst producing an executive briefing report.

FOCUS AREA: ${focus}

ARTICLES TO ANALYZE (${articles.length} articles collected from trusted industry sources):

${articleList}

CRITICAL INSTRUCTIONS:
1. Analyze ONLY the articles provided above. Do NOT invent facts, prices, data, or quotes.
2. Every major claim MUST cite article numbers like [1], [3], or [1][4].
3. Use cautious language: "may", "could", "suggests", "indicates", "based on collected articles".
4. Do NOT predict future prices with certainty.
5. Focus on executive-level insights, not news summaries.
6. If articles are insufficient for a section, write "Insufficient data from collected sources."

Respond with ONLY valid JSON matching this exact structure:
{
  "executiveSummary": "3-4 sentence high-level overview for C-suite. Cite articles.",
  "topStories": [
    {
      "title": "Story title",
      "importance": "2-3 sentences on why this matters to executives and investors. Cite articles.",
      "references": [1, 2]
    }
  ],
  "marketImpact": "2-3 paragraphs on price, supply/demand, and market dynamics. Cite articles.",
  "opecPolicyImpact": "1-2 paragraphs on OPEC+ strategy and production policy. Cite articles or state 'No OPEC coverage in collected articles.'",
  "companyImpact": "1-2 paragraphs on major company developments and strategic moves. Cite articles.",
  "risks": [
    "Specific risk with article citation [N]"
  ],
  "opportunities": [
    "Specific opportunity with article citation [N]"
  ],
  "watchlist": [
    "Key development or data point executives should monitor"
  ]
}

Generate 3-5 top stories, 3-5 risks, 3-5 opportunities, and 4-6 watchlist items based on collected articles.`;
}

function parseAIResponse(text: string): AIAnalysis {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    executiveSummary: String(parsed.executiveSummary || ""),
    topStories: Array.isArray(parsed.topStories)
      ? parsed.topStories.map((s: Record<string, unknown>) => ({
          title: String(s.title || ""),
          importance: String(s.importance || ""),
          references: Array.isArray(s.references)
            ? s.references.map(Number).filter(Boolean)
            : [],
        }))
      : [],
    marketImpact: String(parsed.marketImpact || ""),
    opecPolicyImpact: String(parsed.opecPolicyImpact || ""),
    companyImpact: String(parsed.companyImpact || ""),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.map(String) : [],
    watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist.map(String) : [],
  };
}

async function callGemini(model: string, prompt: string, apiKey: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const result = await geminiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      topP: 0.85,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  });

  const response = result.response;
  const text = response.text();
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

export async function analyzeArticles(
  articles: Article[],
  focus: string
): Promise<AIAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.warn("GEMINI_API_KEY not set — skipping AI analysis");
    return null;
  }

  if (articles.length === 0) {
    logger.warn("No articles to analyze");
    return null;
  }

  const prompt = buildPrompt(articles, focus);

  const tryModel = async (modelName: string): Promise<AIAnalysis> => {
    logger.info(`Attempting AI analysis with ${modelName}`);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI timeout after ${CONFIG.AI_TIMEOUT_MS}ms`)), CONFIG.AI_TIMEOUT_MS)
    );
    const analysisPromise = callGemini(modelName, prompt, apiKey);
    const text = await Promise.race([analysisPromise, timeoutPromise]);
    return parseAIResponse(text);
  };

  try {
    const analysis = await tryModel(CONFIG.AI_PRIMARY_MODEL);
    logger.info("AI analysis completed with primary model");
    return analysis;
  } catch (primaryErr) {
    logger.warn(`Primary model failed: ${(primaryErr as Error).message} — trying fallback`);
    try {
      const analysis = await tryModel(CONFIG.AI_FALLBACK_MODEL);
      logger.info("AI analysis completed with fallback model");
      return analysis;
    } catch (fallbackErr) {
      logger.error("Both AI models failed", { error: (fallbackErr as Error).message });
      return null;
    }
  }
}
