import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, RGB } from "pdf-lib";
import { format } from "date-fns";
import { CONFIG } from "./config";
import type { AIAnalysis, Article } from "./types";


// ── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  darkNavy: rgb(0.04, 0.12, 0.22),
  accentGold: rgb(0.75, 0.55, 0.1),
  accentBlue: rgb(0.1, 0.35, 0.65),
  darkGray: rgb(0.2, 0.2, 0.2),
  mediumGray: rgb(0.45, 0.45, 0.45),
  lightGray: rgb(0.85, 0.85, 0.85),
  veryLightGray: rgb(0.95, 0.95, 0.95),
  white: rgb(1, 1, 1),
  riskRed: rgb(0.7, 0.15, 0.15),
  opportunityGreen: rgb(0.1, 0.5, 0.2),
  watchBlue: rgb(0.1, 0.3, 0.6),
};

const W = CONFIG.PDF_PAGE_WIDTH;
const H = CONFIG.PDF_PAGE_HEIGHT;
const MARGIN = CONFIG.PDF_MARGIN;
const CONTENT_WIDTH = W - MARGIN * 2;

interface DrawState {
  doc: PDFDocument;
  pages: PDFPage[];
  boldFont: PDFFont;
  regularFont: PDFFont;
  italicFont: PDFFont;
  currentPage: PDFPage;
  y: number;
  pageNum: number;
}

// ── Text helpers ─────────────────────────────────────────────────────────────

function measureText(text: string, font: PDFFont, size: number): number {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    return text.length * size * 0.5;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (measureText(test, font, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function sanitizeText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/…/g, "...")
    .replace(/[^\x00-\x7F]/g, "?");
}

// ── Page management ──────────────────────────────────────────────────────────

async function addPage(state: DrawState): Promise<void> {
  const page = state.doc.addPage([W, H]);
  state.pages.push(page);
  state.currentPage = page;
  state.pageNum++;
  state.y = H - MARGIN;

  // Header bar
  page.drawRectangle({
    x: 0,
    y: H - 36,
    width: W,
    height: 36,
    color: COLORS.darkNavy,
  });

  page.drawText("OIL & GAS INTELLIGENCE REPORT", {
    x: MARGIN,
    y: H - 24,
    size: 9,
    font: state.boldFont,
    color: COLORS.accentGold,
  });

  const dateStr = format(new Date(), "dd MMM yyyy");
  const dateWidth = measureText(dateStr, state.regularFont, 9);
  page.drawText(dateStr, {
    x: W - MARGIN - dateWidth,
    y: H - 24,
    size: 9,
    font: state.regularFont,
    color: COLORS.white,
  });

  // Footer bar
  page.drawRectangle({
    x: 0,
    y: 0,
    width: W,
    height: 28,
    color: COLORS.darkNavy,
  });

  const confidential = "CONFIDENTIAL — FOR EXECUTIVE USE ONLY";
  page.drawText(confidential, {
    x: MARGIN,
    y: 10,
    size: 7,
    font: state.italicFont,
    color: COLORS.mediumGray,
  });

  const pageLabel = `Page ${state.pageNum}`;
  const pageWidth = measureText(pageLabel, state.regularFont, 8);
  page.drawText(pageLabel, {
    x: W - MARGIN - pageWidth,
    y: 10,
    size: 8,
    font: state.regularFont,
    color: COLORS.white,
  });

  state.y = H - 54;
}

function ensureSpace(state: DrawState, needed: number): Promise<void> | void {
  if (state.y - needed < 40) {
    return addPage(state);
  }
}

// ── Drawing primitives ───────────────────────────────────────────────────────

function drawLine(state: DrawState, color: RGB = COLORS.lightGray, thickness = 0.5): void {
  state.currentPage.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: W - MARGIN, y: state.y },
    thickness,
    color,
  });
  state.y -= 8;
}

async function drawText(
  state: DrawState,
  text: string,
  options: {
    size?: number;
    font?: PDFFont;
    color?: RGB;
    indent?: number;
    lineSpacing?: number;
    maxWidth?: number;
  } = {}
): Promise<void> {
  const {
    size = 10,
    font = state.regularFont,
    color = COLORS.darkGray,
    indent = 0,
    lineSpacing = 1.4,
    maxWidth = CONTENT_WIDTH,
  } = options;

  const safe = sanitizeText(text);
  const lines = wrapText(safe, font, size, maxWidth - indent);
  const lineH = size * lineSpacing;

  for (const line of lines) {
    await ensureSpace(state, lineH + 4);
    state.currentPage.drawText(line, {
      x: MARGIN + indent,
      y: state.y,
      size,
      font,
      color,
    });
    state.y -= lineH;
  }
}

async function drawSectionHeader(state: DrawState, num: string, title: string): Promise<void> {
  await ensureSpace(state, 50);
  state.y -= 10;

  state.currentPage.drawRectangle({
    x: MARGIN,
    y: state.y - 4,
    width: CONTENT_WIDTH,
    height: 26,
    color: COLORS.darkNavy,
  });

  // Accent left bar
  state.currentPage.drawRectangle({
    x: MARGIN,
    y: state.y - 4,
    width: 4,
    height: 26,
    color: COLORS.accentGold,
  });

  state.currentPage.drawText(`${num}  ${title.toUpperCase()}`, {
    x: MARGIN + 14,
    y: state.y + 5,
    size: 11,
    font: state.boldFont,
    color: COLORS.white,
  });

  state.y -= 36;
}

async function drawBulletItem(
  state: DrawState,
  text: string,
  bullet = "•",
  color: RGB = COLORS.accentBlue,
  textColor: RGB = COLORS.darkGray
): Promise<void> {
  const bulletWidth = 14;
  const textMaxWidth = CONTENT_WIDTH - bulletWidth;

  const safe = sanitizeText(text);
  const lines = wrapText(safe, state.regularFont, 10, textMaxWidth);
  const lineH = 10 * 1.5;

  for (let i = 0; i < lines.length; i++) {
    await ensureSpace(state, lineH + 2);

    if (i === 0) {
      state.currentPage.drawText(bullet, {
        x: MARGIN,
        y: state.y,
        size: 10,
        font: state.boldFont,
        color,
      });
    }

    state.currentPage.drawText(lines[i], {
      x: MARGIN + bulletWidth,
      y: state.y,
      size: 10,
      font: state.regularFont,
      color: textColor,
    });

    state.y -= lineH;
  }

  state.y -= 2;
}

// ── Cover page ────────────────────────────────────────────────────────────────

async function drawCoverPage(
  state: DrawState,
  generatedAt: Date,
  focus: string,
  articleCount: number,
  sourcesQueried: number,
  hasAI: boolean
): Promise<void> {
  const page = state.currentPage;

  // Full background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COLORS.darkNavy });

  // Decorative top band
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: COLORS.accentGold });

  // Side accent
  page.drawRectangle({ x: 0, y: 0, width: 6, height: H, color: COLORS.accentGold });

  // Logo area / icon
  page.drawRectangle({ x: MARGIN, y: H - 130, width: 60, height: 60, color: rgb(0.1, 0.25, 0.45) });
  page.drawText("O&G", { x: MARGIN + 8, y: H - 100, size: 18, font: state.boldFont, color: COLORS.accentGold });

  // Main title
  page.drawText("OIL & GAS", {
    x: MARGIN,
    y: H - 200,
    size: 36,
    font: state.boldFont,
    color: COLORS.white,
  });
  page.drawText("INTELLIGENCE REPORT", {
    x: MARGIN,
    y: H - 244,
    size: 24,
    font: state.boldFont,
    color: COLORS.accentGold,
  });

  // Divider
  page.drawRectangle({ x: MARGIN, y: H - 270, width: 300, height: 2, color: COLORS.accentGold });

  // Metadata
  const meta = [
    { label: "Report Date:", value: format(generatedAt, "MMMM d, yyyy") },
    { label: "Generated At:", value: format(generatedAt, "HH:mm 'UTC'") },
    { label: "Focus Area:", value: focus },
    { label: "Articles Analyzed:", value: `${articleCount}` },
    { label: "Sources Queried:", value: `${sourcesQueried}` },
    { label: "AI Analysis:", value: hasAI ? "Included" : "Not Available" },
  ];

  let metaY = H - 310;
  for (const item of meta) {
    page.drawText(item.label, {
      x: MARGIN,
      y: metaY,
      size: 10,
      font: state.boldFont,
      color: COLORS.accentGold,
    });
    page.drawText(sanitizeText(item.value), {
      x: MARGIN + 150,
      y: metaY,
      size: 10,
      font: state.regularFont,
      color: COLORS.white,
    });
    metaY -= 22;
  }

  // Classification banner
  page.drawRectangle({
    x: MARGIN,
    y: H - 520,
    width: CONTENT_WIDTH,
    height: 40,
    color: rgb(0.12, 0.22, 0.38),
  });
  page.drawText("CONFIDENTIAL — FOR EXECUTIVE USE ONLY", {
    x: MARGIN + 20,
    y: H - 503,
    size: 10,
    font: state.boldFont,
    color: COLORS.accentGold,
  });

  // Disclaimer
  const disclaimer = "This report is generated by an AI-assisted intelligence system using publicly available trusted sources. All analysis is based solely on collected articles. Market conditions change rapidly — this document is for informational purposes only and should not be construed as financial or investment advice.";
  const discLines = wrapText(sanitizeText(disclaimer), state.italicFont, 8, CONTENT_WIDTH);
  let discY = H - 590;
  for (const line of discLines) {
    page.drawText(line, {
      x: MARGIN,
      y: discY,
      size: 8,
      font: state.italicFont,
      color: COLORS.mediumGray,
    });
    discY -= 12;
  }

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: COLORS.accentGold });
  page.drawText("OIL & GAS INTELLIGENCE UNIT", {
    x: MARGIN,
    y: 18,
    size: 8,
    font: state.boldFont,
    color: COLORS.mediumGray,
  });

  state.y = 28;
}

// ── Section: Executive Summary ────────────────────────────────────────────────

async function drawExecutiveSummary(state: DrawState, summary: string): Promise<void> {
  await drawSectionHeader(state, "1", "Executive Summary");

  // Highlighted box
  await ensureSpace(state, 20);
  const boxStartY = state.y + 8;

  state.currentPage.drawRectangle({
    x: MARGIN,
    y: boxStartY - 140,
    width: CONTENT_WIDTH,
    height: 148,
    color: rgb(0.96, 0.97, 0.99),
  });
  state.currentPage.drawRectangle({
    x: MARGIN,
    y: boxStartY - 140,
    width: 3,
    height: 148,
    color: COLORS.accentBlue,
  });

  state.y = boxStartY - 8;
  await drawText(state, summary, {
    size: 11,
    font: state.regularFont,
    color: COLORS.darkGray,
    indent: 10,
    maxWidth: CONTENT_WIDTH - 10,
  });

  state.y -= 12;
}

// ── Section: Top Stories ──────────────────────────────────────────────────────

async function drawTopStories(
  state: DrawState,
  stories: AIAnalysis["topStories"],
  articles: Article[]
): Promise<void> {
  await drawSectionHeader(state, "2", "Top Stories");

  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    await ensureSpace(state, 60);

    // Story number badge
    state.currentPage.drawCircle({
      x: MARGIN + 10,
      y: state.y + 2,
      size: 10,
      color: COLORS.accentBlue,
    });
    state.currentPage.drawText(`${i + 1}`, {
      x: MARGIN + 6,
      y: state.y - 3,
      size: 9,
      font: state.boldFont,
      color: COLORS.white,
    });

    await drawText(state, story.title, {
      size: 11,
      font: state.boldFont,
      color: COLORS.darkNavy,
      indent: 24,
      maxWidth: CONTENT_WIDTH - 24,
    });

    await drawText(state, story.importance, {
      size: 10,
      color: COLORS.mediumGray,
      indent: 24,
      maxWidth: CONTENT_WIDTH - 24,
    });

    if (story.references.length > 0) {
      const refs = story.references
        .map((r) => {
          const art = articles[r - 1];
          return art ? `[${r}] ${art.source}` : `[${r}]`;
        })
        .join(", ");
      await drawText(state, `Sources: ${refs}`, {
        size: 8,
        font: state.italicFont,
        color: COLORS.accentBlue,
        indent: 24,
      });
    }

    if (i < stories.length - 1) {
      state.y -= 4;
      drawLine(state, COLORS.lightGray);
    }
    state.y -= 6;
  }
}

// ── Section: Market Impact ────────────────────────────────────────────────────

async function drawMarketImpact(state: DrawState, text: string): Promise<void> {
  await drawSectionHeader(state, "3", "Market Impact Analysis");
  await drawText(state, text, { size: 10, color: COLORS.darkGray });
  state.y -= 8;
}

// ── Section: OPEC & Policy ────────────────────────────────────────────────────

async function drawOpecPolicy(state: DrawState, text: string): Promise<void> {
  await drawSectionHeader(state, "4", "OPEC & Policy Analysis");
  await drawText(state, text, { size: 10, color: COLORS.darkGray });
  state.y -= 8;
}

// ── Section: Company Developments ────────────────────────────────────────────

async function drawCompanyImpact(state: DrawState, text: string): Promise<void> {
  await drawSectionHeader(state, "5", "Company Developments");
  await drawText(state, text, { size: 10, color: COLORS.darkGray });
  state.y -= 8;
}

// ── Section: Risks & Opportunities ───────────────────────────────────────────

async function drawRisksOpportunities(
  state: DrawState,
  risks: string[],
  opportunities: string[]
): Promise<void> {
  await drawSectionHeader(state, "6", "Risks");
  for (const risk of risks) {
    await drawBulletItem(state, risk, "▸", COLORS.riskRed, COLORS.darkGray);
  }
  state.y -= 8;

  await drawSectionHeader(state, "7", "Opportunities");
  for (const opp of opportunities) {
    await drawBulletItem(state, opp, "▸", COLORS.opportunityGreen, COLORS.darkGray);
  }
  state.y -= 8;
}

// ── Section: Watchlist ────────────────────────────────────────────────────────

async function drawWatchlist(state: DrawState, watchlist: string[]): Promise<void> {
  await drawSectionHeader(state, "8", "Things To Watch");
  for (const item of watchlist) {
    await drawBulletItem(state, item, "→", COLORS.watchBlue, COLORS.darkGray);
  }
  state.y -= 8;
}

// ── Section: Full News Brief ──────────────────────────────────────────────────

async function drawNewsBrief(state: DrawState, articles: Article[]): Promise<void> {
  await drawSectionHeader(state, "9", "Full News Brief");

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    await ensureSpace(state, 80);

    // Article number
    state.currentPage.drawRectangle({
      x: MARGIN,
      y: state.y - 4,
      width: 22,
      height: 18,
      color: COLORS.accentBlue,
    });
    state.currentPage.drawText(`${i + 1}`, {
      x: MARGIN + (i + 1 < 10 ? 7 : 3),
      y: state.y + 1,
      size: 9,
      font: state.boldFont,
      color: COLORS.white,
    });

    // Title
    await drawText(state, article.title, {
      size: 10,
      font: state.boldFont,
      color: COLORS.darkNavy,
      indent: 28,
      maxWidth: CONTENT_WIDTH - 28,
    });

    // Meta line
    const pubDate = article.publishedAt
      ? format(article.publishedAt, "MMM d, yyyy")
      : "Recent";
    await drawText(state, `${article.source}  •  ${pubDate}  •  ${article.category}`, {
      size: 8,
      font: state.italicFont,
      color: COLORS.mediumGray,
      indent: 28,
    });

    // Summary
    if (article.summary) {
      await drawText(state, article.summary.slice(0, 300), {
        size: 9,
        color: COLORS.darkGray,
        indent: 28,
        maxWidth: CONTENT_WIDTH - 28,
      });
    }

    // URL
    await drawText(state, article.url, {
      size: 8,
      font: state.italicFont,
      color: COLORS.accentBlue,
      indent: 28,
      maxWidth: CONTENT_WIDTH - 28,
    });

    if (i < articles.length - 1) {
      state.y -= 4;
      drawLine(state, COLORS.lightGray, 0.3);
    }

    state.y -= 6;
  }
}

// ── Section: Source References ────────────────────────────────────────────────

async function drawSourceReferences(state: DrawState, articles: Article[]): Promise<void> {
  await drawSectionHeader(state, "10", "Source References");

  const grouped: Record<string, Article[]> = {};
  for (const art of articles) {
    if (!grouped[art.source]) grouped[art.source] = [];
    grouped[art.source].push(art);
  }

  for (const [source, arts] of Object.entries(grouped)) {
    await ensureSpace(state, 30);
    await drawText(state, source, {
      size: 10,
      font: state.boldFont,
      color: COLORS.darkNavy,
    });

    for (const art of arts) {
      await drawText(state, `• ${art.title}`, {
        size: 9,
        color: COLORS.mediumGray,
        indent: 10,
      });
      await drawText(state, art.url, {
        size: 8,
        font: state.italicFont,
        color: COLORS.accentBlue,
        indent: 10,
      });
    }
    state.y -= 6;
  }
}

// ── No-AI fallback section ────────────────────────────────────────────────────

async function drawNoAINotice(state: DrawState, reason?: string | null): Promise<void> {
  const boxHeight = reason ? 90 : 68;
  await ensureSpace(state, boxHeight + 16);

  state.currentPage.drawRectangle({
    x: MARGIN,
    y: state.y - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight + 8,
    color: rgb(0.99, 0.97, 0.92),
  });
  state.currentPage.drawRectangle({
    x: MARGIN,
    y: state.y - boxHeight,
    width: 3,
    height: boxHeight + 8,
    color: COLORS.accentGold,
  });

  state.y -= 8;
  await drawText(state, "AI Analysis Not Available", {
    size: 11,
    font: state.boldFont,
    color: COLORS.darkNavy,
    indent: 10,
  });
  await drawText(
    state,
    "The AI analysis module could not complete. All collected articles are included in the Full News Brief below.",
    { size: 10, color: COLORS.mediumGray, indent: 10 }
  );

  if (reason) {
    state.y -= 4;
    await drawText(state, `Reason: ${sanitizeText(reason)}`, {
      size: 9,
      font: state.italicFont,
      color: COLORS.riskRed,
      indent: 10,
    });
  }

  state.y -= 10;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface PDFGeneratorOptions {
  articles: Article[];
  analysis: AIAnalysis | null;
  /** Reason shown in PDF when analysis is null */
  aiError?: string | null;
  generatedAt: Date;
  focus: string;
  sourcesQueried: number;
  includeSources: boolean;
}

export async function generatePDF(options: PDFGeneratorOptions): Promise<Uint8Array> {
  const { articles, analysis, aiError, generatedAt, focus, sourcesQueried, includeSources } = options;

  const doc = await PDFDocument.create();
  doc.setTitle("Oil & Gas Intelligence Report");
  doc.setAuthor("Oil & Gas Intelligence System");
  doc.setSubject(`${focus} — ${format(generatedAt, "MMMM yyyy")}`);
  doc.setKeywords(["oil", "gas", "energy", "intelligence", "report"]);
  doc.setCreationDate(generatedAt);

  const [boldFont, regularFont, italicFont] = await Promise.all([
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);

  // Create cover page
  const coverPage = doc.addPage([W, H]);
  const state: DrawState = {
    doc,
    pages: [coverPage],
    boldFont,
    regularFont,
    italicFont,
    currentPage: coverPage,
    y: H - MARGIN,
    pageNum: 1,
  };

  await drawCoverPage(
    state,
    generatedAt,
    focus,
    articles.length,
    sourcesQueried,
    analysis !== null
  );

  // Start content pages
  await addPage(state);

  if (analysis) {
    // Executive Summary
    await drawExecutiveSummary(state, analysis.executiveSummary);

    // Top Stories
    if (analysis.topStories.length > 0) {
      await drawTopStories(state, analysis.topStories, articles);
    }

    // Market Impact
    if (analysis.marketImpact) {
      await drawMarketImpact(state, analysis.marketImpact);
    }

    // OPEC & Policy
    if (analysis.opecPolicyImpact) {
      await drawOpecPolicy(state, analysis.opecPolicyImpact);
    }

    // Company Impact
    if (analysis.companyImpact) {
      await drawCompanyImpact(state, analysis.companyImpact);
    }

    // Risks & Opportunities
    if (analysis.risks.length > 0 || analysis.opportunities.length > 0) {
      await drawRisksOpportunities(state, analysis.risks, analysis.opportunities);
    }

    // Watchlist
    if (analysis.watchlist.length > 0) {
      await drawWatchlist(state, analysis.watchlist);
    }
  } else {
    await drawNoAINotice(state, aiError);
  }

  // Full News Brief
  await drawNewsBrief(state, articles);

  // Source References
  if (includeSources) {
    await drawSourceReferences(state, articles);
  }

  return doc.save();
}
