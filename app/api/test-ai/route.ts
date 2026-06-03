/**
 * Diagnostic endpoint — call GET /api/test-ai to verify Gemini connectivity.
 * Returns JSON with pass/fail status and the specific error if it fails.
 * Safe to expose: only pings Gemini with a tiny prompt, never reveals the key.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message: string; code: number; status: string };
}

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        step: "env",
        error:
          "GEMINI_API_KEY is not set. Go to Vercel → Project → Settings → " +
          "Environment Variables, add GEMINI_API_KEY, then redeploy.",
      },
      { status: 200 }
    );
  }

  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with the single word: OK" }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      const { code, status, message } = data.error;
      return NextResponse.json(
        {
          ok: false,
          step: "api_call",
          httpStatus: response.status,
          geminiCode: code,
          geminiStatus: status,
          error: message,
          hint:
            code === 401 || code === 403
              ? "API key is invalid or doesn't have Gemini access. " +
                "Generate a new key at https://aistudio.google.com/app/apikey"
              : code === 429
              ? "Rate limit hit. Wait a minute and retry."
              : code === 404
              ? `Model "${model}" not found.`
              : "Check the Gemini API dashboard for more details.",
        },
        { status: 200 }
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return NextResponse.json({
      ok: true,
      model,
      response: text.trim(),
      message: "Gemini API is working correctly. AI analysis should appear in reports.",
    });
  } catch (err) {
    const msg = (err as Error).message;
    return NextResponse.json(
      {
        ok: false,
        step: "fetch",
        error: msg,
        hint: msg.includes("abort")
          ? "Request timed out after 10s. Gemini may be unreachable from your deployment region."
          : "Network error reaching Gemini API.",
      },
      { status: 200 }
    );
  }
}
