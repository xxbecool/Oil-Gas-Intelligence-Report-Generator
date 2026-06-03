import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import { buildReport } from "@/lib/reportBuilder";
import { logger } from "@/lib/logger";
import { CONFIG } from "@/lib/config";

const RequestSchema = z.object({
  maxArticles: z
    .number()
    .int()
    .min(CONFIG.MIN_ARTICLES)
    .max(CONFIG.MAX_ARTICLES)
    .default(CONFIG.DEFAULT_ARTICLES),
  includeAI: z.boolean().default(true),
  includeSources: z.boolean().default(true),
  focus: z
    .enum(["General Oil & Gas", "Upstream", "Downstream", "LNG", "OPEC", "Market Intelligence"])
    .default("General Oil & Gas"),
});

export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const parseResult = RequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const params = parseResult.data;
    logger.info("Report generation request received", params);

    // Generate report
    const pdfBytes = await buildReport(params);

    const elapsed = Date.now() - startTime;
    logger.info(`Report generated in ${elapsed}ms`);

    // Build filename
    const timestamp = format(new Date(), "yyyy-MM-dd-HH-mm");
    const filename = `${CONFIG.REPORT_FILENAME_PREFIX}-${timestamp}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.length.toString(),
        "X-Generation-Time-Ms": elapsed.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error occurred";

    logger.error("Report generation failed", { error: message, elapsed });

    return NextResponse.json(
      {
        error: "Report generation failed",
        message,
        elapsed,
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: "Oil & Gas Intelligence Report Generator",
    status: "operational",
    version: "1.0.0",
    endpoints: {
      "POST /api/generate-report": "Generate intelligence report PDF",
    },
    parameters: {
      maxArticles: `${CONFIG.MIN_ARTICLES}–${CONFIG.MAX_ARTICLES} (default: ${CONFIG.DEFAULT_ARTICLES})`,
      includeAI: "boolean (default: true)",
      includeSources: "boolean (default: true)",
      focus: "General Oil & Gas | Upstream | Downstream | LNG | OPEC | Market Intelligence",
    },
  });
}
