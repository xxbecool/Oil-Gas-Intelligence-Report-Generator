import Parser from "rss-parser";
import { load as cheerioLoad } from "cheerio";
import { CONFIG } from "./config";
import { logger } from "./logger";
import type { Article, NewsSource, RawArticle, ScraperResult } from "./types";
import { getSourcesByFocus } from "./sources";

const rssParser = new Parser({
  timeout: CONFIG.FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": "OilGasIntelligenceBot/1.0 (Energy Research Tool)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:description", "mediaDescription"],
      ["description", "description"],
      ["content:encoded", "contentEncoded"],
      ["dc:date", "dcDate"],
    ],
  },
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function extractTextFromHtml(html: string): string {
  try {
    const $ = cheerioLoad(html);
    $("script, style, nav, header, footer, iframe, noscript").remove();
    return $.text().replace(/\s+/g, " ").trim().slice(0, CONFIG.MAX_ARTICLE_CONTENT_LENGTH);
  } catch {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, CONFIG.MAX_ARTICLE_CONTENT_LENGTH);
  }
}

function cleanText(text: string | undefined | null, maxLen: number): string {
  if (!text) return "";
  const cleaned = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, maxLen);
}

function generateId(title: string, url: string): string {
  const combined = `${title}-${url}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

async function fetchRssFeed(source: NewsSource): Promise<RawArticle[]> {
  const feedUrl = source.rssUrl || source.url;

  const feed = await withTimeout(rssParser.parseURL(feedUrl), CONFIG.FETCH_TIMEOUT_MS);

  const articles: RawArticle[] = [];

  for (const item of feed.items ?? []) {
    if (!item.title || !item.link) continue;

    const itemAny = item as unknown as Record<string, unknown>;
    const rawContent = (itemAny["contentEncoded"] as string | undefined)
      || (itemAny["content:encoded"] as string | undefined)
      || item.content
      || (itemAny["mediaDescription"] as string | undefined)
      || item.summary
      || item.contentSnippet
      || "";

    const rawSummary = item.contentSnippet
      || item.summary
      || (itemAny["mediaDescription"] as string | undefined)
      || "";

    const content = extractTextFromHtml(rawContent as string);
    const summary = cleanText(rawSummary as string, CONFIG.MAX_SUMMARY_LENGTH);

    articles.push({
      title: cleanText(item.title, 200),
      url: item.link,
      source: source.name,
      publishedAt: parseDate(item.pubDate || item.isoDate || (itemAny["dcDate"] as string | undefined)),
      summary: summary || content.slice(0, CONFIG.MAX_SUMMARY_LENGTH),
      content,
      category: source.focus?.[0] || "General Oil & Gas",
    });
  }

  return articles;
}

function convertToArticle(raw: RawArticle): Article {
  return {
    ...raw,
    id: generateId(raw.title, raw.url),
  };
}

export async function collectArticles(
  focus: string,
  maxArticles: number
): Promise<ScraperResult> {
  const sources = getSourcesByFocus(focus);
  logger.info(`Querying ${sources.length} sources for focus: ${focus}`);

  const results = await Promise.allSettled(
    sources.map((source) =>
      fetchRssFeed(source).catch((err) => {
        logger.warn(`Failed to fetch from ${source.name}`, { error: (err as Error).message });
        throw err;
      })
    )
  );

  const allArticles: RawArticle[] = [];
  let sourcesFailed = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      logger.info(`${sources[index].name}: fetched ${result.value.length} articles`);
      allArticles.push(...result.value);
    } else {
      logger.warn(`${sources[index].name}: failed - ${result.reason?.message}`);
      sourcesFailed++;
    }
  });

  const sourcesSucceeded = sources.length - sourcesFailed;

  if (sourcesSucceeded === 0) {
    throw new Error("All news sources failed to respond. Please try again later.");
  }

  const articles = allArticles
    .map(convertToArticle)
    .sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    })
    .slice(0, maxArticles);

  logger.info(`Collected ${articles.length} articles from ${sourcesSucceeded} sources`);

  return {
    articles,
    sourcesQueried: sources.length,
    sourcesFailed,
  };
}
