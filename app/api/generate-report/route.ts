/**
 * Edge Runtime route — runs on Vercel's global edge network.
 *
 * Timeout comparison:
 *   Serverless (Node.js)  Hobby = 10 s  |  Pro = 60 s
 *   Edge Runtime          Hobby = 25 s  |  Pro = 25 s  ← FREE & sufficient
 *
 * No code changes are needed for Railway / Render (they have no timeout limit).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import { buildReport } from "@/lib/reportBuilder";
import { logger } from "@/lib/logger";
import { CONFIG } from "@/lib/config";

export const runtime = "edge";
export const maxDuration = 25; // seconds — maximum allowed on all Vercel plans for Edge

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
    .enum([
      "General Oil & Gas",
      "Upstream",
      "Downstream",
      "LNG",
      "OPEC",
      "Market Intelligence",
    ])
    .default("General Oil & Gas"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
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
        {
          error: "Invalid request parameters",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const params = parseResult.data;
    logger.info("Report generation request received", params);

    const pdfBytes = await buildReport(params);
    const elapsed = Date.now() - startTime;
    logger.info(`Report generated in ${elapsed}ms`);

    const timestamp = format(new Date(), "yyyy-MM-dd-HH-mm");
    const filename = `${CONFIG.REPORT_FILENAME_PREFIX}-${timestamp}.pdf`;

    // Use ArrayBuffer so the type is unambiguously valid as BodyInit
    // in both Node.js and Edge runtimes.
    const buffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;

    return new NextResponse(buffer, {
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
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    logger.error("Report generation failed", { error: message, elapsed });

    return NextResponse.json(
      { error: "Report generation failed", message, elapsed },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: "Oil & Gas Intelligence Report Generator",
    runtime: "edge",
    status: "operational",
    version: "1.0.0",
    freeTierCompatible: true,
    endpoints: {
      "POST /api/generate-report": "Generate intelligence report PDF",
    },
    parameters: {
      maxArticles: `${CONFIG.MIN_ARTICLES}–${CONFIG.MAX_ARTICLES} (default: ${CONFIG.DEFAULT_ARTICLES})`,
      includeAI: "boolean (default: true)",
      includeSources: "boolean (default: true)",
      focus:
        "General Oil & Gas | Upstream | Downstream | LNG | OPEC | Market Intelligence",
    },
  });
}
