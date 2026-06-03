import { collectArticles } from "./scraper";
import { filterAndDeduplicate } from "./articleFilter";
import { analyzeArticles } from "./aiAnalyzer";
import { generatePDF } from "./pdfGenerator";
import { logger } from "./logger";
import type { ReportRequest } from "./types";

export async function buildReport(request: ReportRequest): Promise<Uint8Array> {
  const { maxArticles, includeAI, includeSources, focus } = request;

  logger.info("Report generation started", { focus, maxArticles, includeAI });

  // Stage 1: Collect articles
  logger.info("Stage 1: Collecting articles from trusted sources");
  const { articles: rawArticles, sourcesQueried, sourcesFailed } = await collectArticles(
    focus,
    maxArticles * 3 // fetch more, filter down
  );

  logger.info(`Collected ${rawArticles.length} raw articles from ${sourcesQueried} sources (${sourcesFailed} failed)`);

  // Stage 2: Validate & deduplicate
  logger.info("Stage 2: Filtering and deduplicating articles");
  const filteredArticles = filterAndDeduplicate(rawArticles).slice(0, maxArticles);

  if (filteredArticles.length === 0) {
    throw new Error("No relevant articles found after filtering. Please try again later.");
  }

  logger.info(`Using ${filteredArticles.length} articles for report`);

  // Stage 3: AI Analysis
  let analysis = null;
  if (includeAI) {
    logger.info("Stage 3: Running AI analysis");
    analysis = await analyzeArticles(filteredArticles, focus);

    if (!analysis) {
      logger.warn("AI analysis unavailable — proceeding without AI");
    } else {
      logger.info("AI analysis completed successfully");
    }
  } else {
    logger.info("Stage 3: AI analysis skipped by user request");
  }

  // Stage 4: Generate PDF
  logger.info("Stage 4: Generating PDF report");
  const pdfBytes = await generatePDF({
    articles: filteredArticles,
    analysis,
    generatedAt: new Date(),
    focus,
    sourcesQueried,
    includeSources,
  });

  logger.info(`PDF generated: ${pdfBytes.length} bytes`);
  return pdfBytes;
}
