import type { NewsSource } from "./types";

export const TRUSTED_SOURCES: NewsSource[] = [
  // ── News Agencies ─────────────────────────────────────────────────────────
  {
    name: "Reuters Energy",
    url: "https://www.reuters.com/business/energy",
    rssUrl: "https://feeds.reuters.com/reuters/businessNews",
    category: "News Agency",
    type: "rss",
    trusted: true,
    focus: ["General Oil & Gas", "Market Intelligence", "Upstream", "Downstream"],
  },

  // ── Industry Publications ─────────────────────────────────────────────────
  {
    name: "OilPrice.com",
    url: "https://oilprice.com",
    rssUrl: "https://oilprice.com/rss/main",
    category: "Industry Publication",
    type: "rss",
    trusted: true,
    focus: ["General Oil & Gas", "Market Intelligence", "OPEC"],
  },
  {
    name: "Offshore Energy",
    url: "https://www.offshore-energy.biz",
    rssUrl: "https://www.offshore-energy.biz/feed/",
    category: "Industry Publication",
    type: "rss",
    trusted: true,
    focus: ["Upstream", "LNG"],
  },
  {
    name: "Rigzone",
    url: "https://www.rigzone.com",
    rssUrl: "https://www.rigzone.com/news/rss/rigzone_latest.aspx",
    category: "Industry Publication",
    type: "rss",
    trusted: true,
    focus: ["Upstream", "General Oil & Gas"],
  },
  {
    name: "World Oil",
    url: "https://www.worldoil.com",
    rssUrl: "https://www.worldoil.com/rss-feeds/all-articles",
    category: "Industry Publication",
    type: "rss",
    trusted: true,
    focus: ["General Oil & Gas", "Upstream"],
  },
  {
    name: "Natural Gas Intelligence",
    url: "https://www.naturalgasintel.com",
    rssUrl: "https://www.naturalgasintel.com/rss/",
    category: "Industry Publication",
    type: "rss",
    trusted: true,
    focus: ["LNG", "General Oil & Gas"],
  },

  // ── Government & Intergovernmental Organizations ──────────────────────────
  {
    name: "OPEC Newsroom",
    url: "https://www.opec.org",
    rssUrl: "https://www.opec.org/opec_web/en/press_room/rss.htm",
    category: "Government & IGO",
    type: "rss",
    trusted: true,
    focus: ["OPEC", "Market Intelligence"],
  },
  {
    name: "IEA News",
    url: "https://www.iea.org/newsroom",
    rssUrl: "https://www.iea.org/api/feed/news",
    category: "Government & IGO",
    type: "rss",
    trusted: true,
    focus: ["Market Intelligence", "General Oil & Gas"],
  },
  {
    name: "EIA News",
    url: "https://www.eia.gov/petroleum",
    rssUrl: "https://www.eia.gov/rss/news.xml",
    category: "Government & IGO",
    type: "rss",
    trusted: true,
    focus: ["Market Intelligence", "General Oil & Gas"],
  },

  // ── National Oil Companies ─────────────────────────────────────────────────
  {
    name: "Saudi Aramco News",
    url: "https://www.aramco.com/en/news-media/news",
    rssUrl: "https://www.aramco.com/en/rss/news.xml",
    category: "National Oil Company",
    type: "rss",
    trusted: true,
    focus: ["Upstream", "General Oil & Gas", "OPEC"],
  },
  {
    name: "ADNOC News",
    url: "https://www.adnoc.ae/en/news-and-media/press-releases",
    rssUrl: "https://www.adnoc.ae/rss/news",
    category: "National Oil Company",
    type: "rss",
    trusted: true,
    focus: ["Upstream", "Downstream", "LNG"],
  },

  // ── International Majors ──────────────────────────────────────────────────
  {
    name: "Shell Newsroom",
    url: "https://www.shell.com/media/news-and-media-releases.html",
    rssUrl: "https://www.shell.com/media/rss.xml",
    category: "International Major",
    type: "rss",
    trusted: true,
    focus: ["General Oil & Gas", "LNG", "Downstream"],
  },
  {
    name: "BP Press Releases",
    url: "https://www.bp.com/en/global/corporate/news-and-insights.html",
    rssUrl: "https://www.bp.com/rss/en/news-and-views.rss",
    category: "International Major",
    type: "rss",
    trusted: true,
    focus: ["General Oil & Gas", "Upstream", "Downstream"],
  },
  {
    name: "TotalEnergies News",
    url: "https://totalenergies.com/media/news",
    rssUrl: "https://totalenergies.com/rss.xml",
    category: "International Major",
    type: "rss",
    trusted: true,
    focus: ["General Oil & Gas", "LNG", "Upstream"],
  },
];

export function getSourcesByFocus(focus: string): NewsSource[] {
  if (focus === "General Oil & Gas") {
    return TRUSTED_SOURCES;
  }

  const focused = TRUSTED_SOURCES.filter(
    (s) => !s.focus || s.focus.some((f) => f === focus || f === "General Oil & Gas")
  );

  return focused.length >= 3 ? focused : TRUSTED_SOURCES;
}
