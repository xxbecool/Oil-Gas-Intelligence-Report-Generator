export const CONFIG = {
  // Report generation limits
  MAX_ARTICLES: 20,
  MIN_ARTICLES: 5,
  DEFAULT_ARTICLES: 15,

  // Timeouts (milliseconds)
  // Edge Runtime hard limit = 25 s total.
  // Budget: RSS ~6 s + AI ~14 s + PDF ~2 s = ~22 s (3 s headroom)
  FETCH_TIMEOUT_MS: 6000,
  AI_TIMEOUT_MS: 14000,
  TOTAL_TIMEOUT_MS: 22000,

  // AI Models — stable, widely available, fast
  AI_PRIMARY_MODEL: "gemini-2.0-flash",
  AI_FALLBACK_MODEL: "gemini-2.0-flash-lite",

  // Content limits — fewer articles = faster AI response
  MAX_ARTICLE_CONTENT_LENGTH: 2000,
  MAX_SUMMARY_LENGTH: 500,
  MAX_PROMPT_ARTICLES: 10,

  // PDF settings
  PDF_PAGE_WIDTH: 595,   // A4 width in points
  PDF_PAGE_HEIGHT: 842,  // A4 height in points
  PDF_MARGIN: 50,

  // Application
  APP_NAME: "Oil & Gas Intelligence Report Generator",
  REPORT_FILENAME_PREFIX: "oil-gas-intelligence-report",
} as const;

export const KEYWORDS = {
  relevant: [
    "oil", "gas", "petroleum", "lng", "opec", "crude", "barrel", "brent", "wti",
    "natural gas", "energy", "refinery", "refining", "exploration", "production",
    "upstream", "downstream", "midstream", "pipeline", "offshore", "onshore",
    "drilling", "well", "reservoir", "hydrocarbon", "fossil fuel",
    "aramco", "adnoc", "shell", "bp", "totalenergies", "exxon", "chevron",
    "eni", "equinor", "petronas", "gazprom", "rosneft", "sinopec", "cnooc",
    "energy market", "energy policy", "energy security", "energy transition",
    "fossil", "tanker", "liquefied", "condensate", "ngl", "petrochemical",
    "carbon", "emission", "iea", "eia", "ceraweek", "commodity",
    "supply", "demand", "price", "benchmark", "futures", "contract",
  ],
  irrelevant: [
    "recipe", "fashion", "sports", "celebrity", "entertainment",
    "movie", "music", "restaurant", "travel", "lifestyle",
    "cryptocurrency", "bitcoin", "nft", "gaming", "social media",
  ],
} as const;
