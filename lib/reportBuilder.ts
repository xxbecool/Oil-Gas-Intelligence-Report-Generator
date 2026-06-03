import { collectArticles } from "./scraper";
import { filterAndDeduplicate } from "./articleFilter";
import { analyzeArticles } from "./aiAnalyzer";
import { generatePDF } from "./pdfGenerator";
import { logger } from "./logger";
import type { ReportRequest } from "./types";

export async function buildReport(request: ReportRequest): Promise<Uint8Array> {
  const { maxArticles, includeAI, includeSources, focus } = request;

  logger.info("Report generation started", { focus, maxArticles, includeAI });

  // Stage 1: Collect
  logger.info("Stage 1: Collecting articles from trusted sources");
  const { articles: rawArticles, sourcesQueried, sourcesFailed } =
    await collectArticles(focus, maxArticles * 3);

  logger.info(
    `Collected ${rawArticles.length} raw articles from ${sourcesQueried} sources (${sourcesFailed} failed)`
  );

  // Stage 2: Filter & deduplicate
  logger.info("Stage 2: Filtering and deduplicating articles");
  const articles = filterAndDeduplicate(rawArticles).slice(0, maxArticles);

  if (articles.length === 0) {
    throw new Error(
      "No relevant articles found after filtering. Please try again later."
    );
  }

  logger.info(`Using ${articles.length} articles for report`);

  // Stage 3: AI analysis (always run analyzeArticles so we get the error message)
  let aiAnalysis = null;
  let aiError: string | null = null;

  if (includeAI) {
    logger.info("Stage 3: Running AI analysis");
    const result = await analyzeArticles(articles, focus);
    aiAnalysis = result.analysis;
    aiError = result.error;

    if (aiAnalysis) {
      logger.info("AI analysis completed successfully");
    } else {
      logger.warn(`AI analysis skipped: ${aiError}`);
    }
  } else {
    logger.info("Stage 3: AI analysis disabled by user");
    aiError = "AI analysis was disabled in report settings.";
  }

  // Stage 4: Generate PDF
  logger.info("Stage 4: Generating PDF report");
  const pdfBytes = await generatePDF({
    articles,
    analysis: aiAnalysis,
    aiError,
    generatedAt: new Date(),
    focus,
    sourcesQueried,
    includeSources,
  });

  logger.info(`PDF generated: ${pdfBytes.length} bytes`);
  return pdfBytes;
}
