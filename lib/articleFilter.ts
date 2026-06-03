import { KEYWORDS } from "./config";
import { logger } from "./logger";
import type { Article } from "./types";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking params and fragments
    parsed.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source"].forEach((p) =>
      parsed.searchParams.delete(p)
    );
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function isRelevant(article: Article): boolean {
  const text = `${article.title} ${article.summary} ${article.content}`.toLowerCase();

  const hasRelevant = KEYWORDS.relevant.some((kw) => text.includes(kw));
  if (!hasRelevant) return false;

  const hasIrrelevant = KEYWORDS.irrelevant.some((kw) => text.includes(kw));
  if (hasIrrelevant) {
    // Only discard if irrelevant keywords dominate and no strong energy signal
    const energySignals = ["oil", "gas", "energy", "opec", "crude", "lng", "petroleum"];
    const hasStrongSignal = energySignals.some((kw) => text.includes(kw));
    if (!hasStrongSignal) return false;
  }

  return true;
}

function isValid(article: Article): boolean {
  if (!article.title || article.title.trim().length < 10) return false;
  if (!article.url || !article.url.startsWith("http")) return false;
  if (!article.source) return false;
  return true;
}

export function filterAndDeduplicate(articles: Article[]): Article[] {
  const seenTitles = new Set<string>();
  const seenUrls = new Set<string>();
  const filtered: Article[] = [];

  for (const article of articles) {
    if (!isValid(article)) {
      logger.debug(`Discarded (invalid): "${article.title}"`);
      continue;
    }

    if (!isRelevant(article)) {
      logger.debug(`Discarded (irrelevant): "${article.title}"`);
      continue;
    }

    const normalTitle = normalizeTitle(article.title);
    const normalUrl = normalizeUrl(article.url);

    if (seenTitles.has(normalTitle) || seenUrls.has(normalUrl)) {
      logger.debug(`Discarded (duplicate): "${article.title}"`);
      continue;
    }

    seenTitles.add(normalTitle);
    seenUrls.add(normalUrl);
    filtered.push(article);
  }

  logger.info(`Filter result: ${filtered.length} unique relevant articles from ${articles.length} total`);
  return filtered;
}
