/**
 * Edge-compatible RSS scraper.
 * Uses fetch + fast-xml-parser instead of rss-parser/cheerio so the
 * route can run on Vercel Edge Runtime (free 25-30s timeout on Hobby plan).
 */
import { XMLParser } from "fast-xml-parser";
import { CONFIG } from "./config";
import { logger } from "./logger";
import type { Article, NewsSource, RawArticle, ScraperResult } from "./types";
import { getSourcesByFocus } from "./sources";

// ── XML parser (shared instance) ─────────────────────────────────────────────

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseTagValue: false,
  isArray: (name: string) =>
    name === "item" || name === "entry",
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise namespace-prefixed RSS elements to plain names before parsing,
 * so fast-xml-parser doesn't have to deal with colons in key names.
 */
function normalizeXml(xml: string): string {
  return xml
    .replace(/<content:encoded>/gi, "<contentEncoded>")
    .replace(/<\/content:encoded>/gi, "</contentEncoded>")
    .replace(/<dc:date>/gi, "<dcDate>")
    .replace(/<\/dc:date>/gi, "</dcDate>")
    .replace(/<dc:creator>/gi, "<dcCreator>")
    .replace(/<\/dc:creator>/gi, "</dcCreator>")
    .replace(/<media:description>/gi, "<mediaDescription>")
    .replace(/<\/media:description>/gi, "</mediaDescription>")
    .replace(/<media:content\b[^/\s>]*[^>]*\/>/gi, "")
    .replace(/<media:content\b[^>]*>[\s\S]*?<\/media:content>/gi, "");
}

/** Strip HTML tags and decode common entities from a string. */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/(?:&#39;|&apos;)/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a plain string from a fast-xml-parser value node. */
function getText(val: unknown): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if ("__cdata" in obj) return String(obj.__cdata ?? "");
    if ("#text" in obj) return String(obj["#text"] ?? "");
  }
  return "";
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function generateId(title: string, url: string): string {
  const combined = `${title}|${url}`;
  let h = 0;
  for (let i = 0; i < combined.length; i++) {
    h = (Math.imul(31, h) + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

// ── Feed parsers ──────────────────────────────────────────────────────────────

function parseRss2Items(
  channel: Record<string, unknown>,
  source: NewsSource
): RawArticle[] {
  const items = (channel.item as Record<string, unknown>[] | undefined) ?? [];
  const out: RawArticle[] = [];

  for (const item of items) {
    const title = stripHtml(getText(item.title)).slice(0, 200);

    // <link> in RSS 2.0 is a text node between tags (no attributes)
    let url = getText(item.link).trim();
    // fallback: some feeds use <link> as attribute container
    if (!url && typeof item.link === "object" && item.link !== null) {
      url = ((item.link as Record<string, unknown>)["@_href"] as string) ?? "";
    }

    if (!title || !url.startsWith("http")) continue;

    const rawContent =
      getText(item.contentEncoded) ||
      getText(item.description) ||
      getText(item.mediaDescription);

    const content = stripHtml(rawContent).slice(0, CONFIG.MAX_ARTICLE_CONTENT_LENGTH);
    const rawSummary = getText(item.description) || getText(item.mediaDescription);
    const summary =
      stripHtml(rawSummary).slice(0, CONFIG.MAX_SUMMARY_LENGTH) ||
      content.slice(0, CONFIG.MAX_SUMMARY_LENGTH);

    out.push({
      title,
      url,
      source: source.name,
      publishedAt: parseDate(
        getText(item.pubDate) || getText(item.dcDate) || getText(item.date)
      ),
      summary,
      content,
      category: source.focus?.[0] ?? "General Oil & Gas",
    });
  }

  return out;
}

function parseAtomEntries(
  feed: Record<string, unknown>,
  source: NewsSource
): RawArticle[] {
  const entries = (feed.entry as Record<string, unknown>[] | undefined) ?? [];
  const out: RawArticle[] = [];

  for (const entry of entries) {
    const title = stripHtml(getText(entry.title)).slice(0, 200);

    // Atom <link> can be array of objects with @_href, or a single string/object
    let url = "";
    if (Array.isArray(entry.link)) {
      const links = entry.link as Record<string, unknown>[];
      const preferred = links.find(
        (l) => !l["@_rel"] || l["@_rel"] === "alternate"
      );
      url = ((preferred?.["@_href"] as string) ?? getText(preferred)).trim();
    } else if (entry.link) {
      const l = entry.link as Record<string, unknown>;
      url = ((l["@_href"] as string) ?? getText(l)).trim();
    }

    if (!title || !url.startsWith("http")) continue;

    const rawContent = getText(entry.content) || getText(entry.summary);
    const content = stripHtml(rawContent).slice(0, CONFIG.MAX_ARTICLE_CONTENT_LENGTH);
    const summary =
      stripHtml(getText(entry.summary)).slice(0, CONFIG.MAX_SUMMARY_LENGTH) ||
      content.slice(0, CONFIG.MAX_SUMMARY_LENGTH);

    out.push({
      title,
      url,
      source: source.name,
      publishedAt: parseDate(
        getText(entry.published) || getText(entry.updated)
      ),
      summary,
      content,
      category: source.focus?.[0] ?? "General Oil & Gas",
    });
  }

  return out;
}

function extractArticles(
  parsed: Record<string, unknown>,
  source: NewsSource
): RawArticle[] {
  // RSS 2.0
  const channel = (parsed.rss as Record<string, unknown> | undefined)
    ?.channel as Record<string, unknown> | undefined;
  if (channel) return parseRss2Items(channel, source);

  // Atom
  const feed = parsed.feed as Record<string, unknown> | undefined;
  if (feed) return parseAtomEntries(feed, source);

  // RDF (RSS 1.0) — basic fallback
  const rdf = (parsed["rdf:RDF"] ?? parsed.RDF) as Record<string, unknown> | undefined;
  if (rdf) {
    const items = (rdf["item"] as Record<string, unknown>[] | undefined) ?? [];
    return items.flatMap((item) => {
      const title = stripHtml(getText(item.title)).slice(0, 200);
      const url = (
        (item.link as Record<string, unknown>)?.["@_rdf:resource"] as string
      ) ?? getText(item.link);
      if (!title || !url?.startsWith("http")) return [];
      const content = stripHtml(getText(item.description)).slice(0, CONFIG.MAX_ARTICLE_CONTENT_LENGTH);
      return [{
        title,
        url,
        source: source.name,
        publishedAt: null,
        summary: content.slice(0, CONFIG.MAX_SUMMARY_LENGTH),
        content,
        category: source.focus?.[0] ?? "General Oil & Gas",
      }];
    });
  }

  return [];
}

// ── Main fetch function ───────────────────────────────────────────────────────

async function fetchRssFeed(source: NewsSource): Promise<RawArticle[]> {
  const feedUrl = source.rssUrl ?? source.url;

  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "OilGasIntelligenceBot/1.0 (Energy Research Tool)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(CONFIG.FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const rawXml = await response.text();
  const cleanedXml = normalizeXml(rawXml);

  let parsed: Record<string, unknown>;
  try {
    parsed = XML_PARSER.parse(cleanedXml) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`XML parse error: ${(err as Error).message}`);
  }

  return extractArticles(parsed, source);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function collectArticles(
  focus: string,
  maxArticles: number
): Promise<ScraperResult> {
  const sources = getSourcesByFocus(focus);
  logger.info(`Querying ${sources.length} sources for focus: ${focus}`);

  const results = await Promise.allSettled(
    sources.map((source) =>
      fetchRssFeed(source).catch((err) => {
        logger.warn(`Failed to fetch ${source.name}`, {
          error: (err as Error).message,
        });
        throw err;
      })
    )
  );

  const allArticles: RawArticle[] = [];
  let sourcesFailed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      logger.info(`${sources[i].name}: ${result.value.length} articles`);
      allArticles.push(...result.value);
    } else {
      logger.warn(`${sources[i].name}: failed — ${(result.reason as Error)?.message}`);
      sourcesFailed++;
    }
  }

  if (sources.length - sourcesFailed === 0) {
    throw new Error("All news sources failed to respond. Please try again later.");
  }

  const articles: Article[] = allArticles
    .map((raw) => ({ ...raw, id: generateId(raw.title, raw.url) }))
    .sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    })
    .slice(0, maxArticles);

  logger.info(`Final: ${articles.length} articles from ${sources.length - sourcesFailed} sources`);

  return { articles, sourcesQueried: sources.length, sourcesFailed };
}
