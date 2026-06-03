/**
 * Diagnostic endpoint — GET /api/test-ai
 * Verifies OpenRouter API key and connectivity with a tiny test prompt.
 * Returns JSON {ok, model, error, hint} — safe to visit in browser.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message: string; code?: number; type?: string };
  model?: string;
}

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      step: "env",
      error: "OPENROUTER_API_KEY is not set.",
      hint:
        "Go to Vercel → your project → Settings → Environment Variables. " +
        "Add OPENROUTER_API_KEY with your key from openrouter.ai/keys, then redeploy.",
    });
  }

  const model = "google/gemini-2.0-flash-exp:free";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://oil-gas-intelligence.vercel.app",
          "X-Title": "Oil & Gas Intelligence Report Generator",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with the single word: OK" }],
          max_tokens: 10,
          temperature: 0,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = (await response.json()) as OpenRouterResponse;

    if (data.error) {
      const { code, type, message } = data.error;
      return NextResponse.json({
        ok: false,
        step: "api_call",
        httpStatus: response.status,
        code,
        type,
        error: message,
        hint:
          response.status === 401
            ? "API key is invalid. Get a fresh key at openrouter.ai/keys"
            : response.status === 402
            ? "No credits. Add credits at openrouter.ai/credits (free models need $1 minimum)"
            : response.status === 429
            ? "Rate limit hit. Wait 60 seconds and try again."
            : response.status === 404
            ? `Model "${model}" not found. It may have been renamed — check openrouter.ai/models`
            : "Check openrouter.ai for account status.",
      });
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({
      ok: true,
      model: data.model ?? model,
      response: content.trim(),
      message:
        "OpenRouter is working correctly. AI analysis will appear in reports.",
    });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json({
      ok: false,
      step: "fetch",
      error: msg,
      hint: msg.includes("abort")
        ? "Request timed out after 10s — OpenRouter may be temporarily unreachable."
        : "Network error reaching OpenRouter.",
    });
  }
}
