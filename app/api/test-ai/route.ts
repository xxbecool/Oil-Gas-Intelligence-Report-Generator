/**
 * Diagnostic endpoint — GET /api/test-ai
 * Verifies Groq API key and connectivity with a tiny test prompt.
 * Returns JSON {ok, model, error, hint} — safe to visit in browser.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";

interface GroqResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message: string; type?: string };
  model?: string;
}

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      step: "env",
      error: "GROQ_API_KEY is not set.",
      hint:
        "Go to Vercel → your project → Settings → Environment Variables. " +
        "Add GROQ_API_KEY with your key from console.groq.com/keys, then redeploy.",
    });
  }

  const model = "llama-3.3-70b-versatile";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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

    const data = (await response.json()) as GroqResponse;

    if (data.error) {
      return NextResponse.json({
        ok: false,
        step: "api_call",
        httpStatus: response.status,
        error: data.error.message,
        hint:
          response.status === 401
            ? "API key is invalid. Get a fresh key at console.groq.com/keys"
            : response.status === 429
            ? "Rate limit hit. Wait a minute and try again."
            : "Check console.groq.com for account status.",
      });
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({
      ok: true,
      model: data.model ?? model,
      response: content.trim(),
      message: "Groq is working correctly. AI analysis will appear in reports.",
    });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json({
      ok: false,
      step: "fetch",
      error: msg,
      hint: msg.includes("abort")
        ? "Request timed out after 10s — Groq may be temporarily unreachable."
        : "Network error reaching Groq.",
    });
  }
}
