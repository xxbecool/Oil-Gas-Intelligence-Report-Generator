export type ReportFocus =
  | "General Oil & Gas"
  | "Upstream"
  | "Downstream"
  | "LNG"
  | "OPEC"
  | "Market Intelligence";

export type SourceCategory =
  | "News Agency"
  | "Industry Publication"
  | "Government & IGO"
  | "National Oil Company"
  | "International Major";

export type SourceType = "rss" | "web";

export interface NewsSource {
  name: string;
  url: string;
  rssUrl?: string;
  category: SourceCategory;
  type: SourceType;
  trusted: true;
  focus?: ReportFocus[];
}

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: Date | null;
  summary: string;
  content: string;
  category: string;
}

export interface Article {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: Date | null;
  summary: string;
  content: string;
  category: string;
}

export interface TopStory {
  title: string;
  importance: string;
  references: number[];
}

export interface AIAnalysis {
  executiveSummary: string;
  topStories: TopStory[];
  marketImpact: string;
  opecPolicyImpact: string;
  companyImpact: string;
  risks: string[];
  opportunities: string[];
  watchlist: string[];
}

export interface ReportRequest {
  maxArticles: number;
  includeAI: boolean;
  includeSources: boolean;
  focus: ReportFocus;
}

export interface ReportResult {
  articles: Article[];
  analysis: AIAnalysis | null;
  generatedAt: Date;
  articlesCollected: number;
  sourcesQueried: number;
  aiEnabled: boolean;
}

export interface ScraperResult {
  articles: Article[];
  sourcesQueried: number;
  sourcesFailed: number;
}

export interface GenerationProgress {
  stage: "collecting" | "validating" | "analyzing" | "generating" | "complete";
  message: string;
  progress: number;
}
