export const CONFIG = {
  // Report generation limits
  MAX_ARTICLES: 20,
  MIN_ARTICLES: 5,
  DEFAULT_ARTICLES: 15,

  // Timeouts (milliseconds)
  // Edge Runtime hard limit = 25 s total.
  // Budget: RSS ~5 s + AI ~8 s (per model) + PDF ~2 s
  // Worst case: 2 timeouts = 5 + 8 + 0.3 + 8 + 2 = 23.3 s ✓
  FETCH_TIMEOUT_MS: 5000,
  AI_TIMEOUT_MS: 8000,
  TOTAL_TIMEOUT_MS: 22000,

  // AI Models — Groq model IDs (all free on developer tier)
  AI_PRIMARY_MODEL: "llama-3.3-70b-versatile",
  AI_FALLBACK_MODEL: "mixtral-8x7b-32768",

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
