"use client";

import { useState } from "react";
import {
  FileText,
  Shield,
  Database,
  Zap,
  Globe2,
  Brain,
  CheckCircle2,
  ExternalLink,
  Flame,
} from "lucide-react";
import { GenerateButton } from "@/components/GenerateButton";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { ReportSettings, type ReportSettingsValues } from "@/components/ReportSettings";

type AppState = "idle" | "loading" | "error" | "success";

const DEFAULT_SETTINGS: ReportSettingsValues = {
  maxArticles: 15,
  includeAI: true,
  includeSources: true,
  focus: "General Oil & Gas",
};

const TRUSTED_SOURCE_NAMES = [
  "Reuters Energy",
  "OilPrice.com",
  "Offshore Energy",
  "Rigzone",
  "World Oil",
  "OPEC Newsroom",
  "IEA News",
  "EIA News",
  "Saudi Aramco",
  "ADNOC",
  "Shell",
  "BP",
  "TotalEnergies",
];

const FEATURE_CARDS = [
  {
    icon: <Globe2 className="h-5 w-5" />,
    title: "14 Trusted Sources",
    desc: "Reuters, OPEC, IEA, EIA, Aramco, and more",
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: "Gemini AI Analysis",
    desc: "Executive-level insights powered by Google Gemini",
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: "Validated & Filtered",
    desc: "Duplicates removed, relevance checked",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Professional PDF",
    desc: "Consulting-grade report with cover page",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "60 Second Delivery",
    desc: "Fully automated, no manual work needed",
  },
  {
    icon: <Database className="h-5 w-5" />,
    title: "No Data Stored",
    desc: "PDF generated in memory, nothing persisted",
  },
];

export default function HomePage() {
  const [state, setState] = useState<AppState>("idle");
  const [settings, setSettings] = useState<ReportSettingsValues>(DEFAULT_SETTINGS);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleGenerate = async () => {
    setState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        let msg = "Report generation failed. Please try again.";
        try {
          const data = await response.json();
          msg = data.message || data.error || msg;
        } catch {
          // use default message
        }
        setErrorMessage(msg);
        setState("error");
        return;
      }

      // Download the PDF
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "oil-gas-intelligence-report.pdf";

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setState("success");
      setTimeout(() => setState("idle"), 5000);
    } catch {
      setErrorMessage(
        "Network error while generating report. Please check your connection and try again."
      );
      setState("error");
    }
  };

  const handleRetry = () => {
    setState("idle");
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100">
              <Flame className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Oil & Gas Intelligence
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">
                Report Generator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="hidden sm:inline">System Operational</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-6">
            <Brain className="h-3.5 w-3.5" />
            AI-Powered Intelligence
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
            Oil & Gas{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-600">
              Intelligence
            </span>{" "}
            Reports
          </h1>

          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-3">
            Generate executive-level oil and gas intelligence reports from 14 trusted industry
            sources. Powered by Google Gemini AI.
          </p>

          <p className="text-sm text-slate-400 dark:text-slate-500">
            For CEOs · Directors · Managers · Investors · Energy Consultants
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left: Settings + Generate */}
          <div className="lg:col-span-1 space-y-6">
            {/* Settings card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
              <ReportSettings
                values={settings}
                onChange={setSettings}
                disabled={state === "loading"}
              />
            </div>

            {/* Generate button */}
            {state !== "loading" && (
              <GenerateButton
                onClick={handleGenerate}
                loading={false}
                disabled={false}
              />
            )}

            {/* Success message */}
            {state === "success" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 animate-fade-in">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Report downloaded successfully!
                </p>
              </div>
            )}

            {/* Trusted sources list */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                Trusted Sources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TRUSTED_SOURCE_NAMES.map((src) => (
                  <span
                    key={src}
                    className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400"
                  >
                    {src}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Content area */}
          <div className="lg:col-span-2">
            {state === "idle" && (
              <div className="space-y-6 animate-fade-in">
                {/* Feature grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {FEATURE_CARDS.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                          {card.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-white text-sm">
                            {card.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {card.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Report structure preview */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-500" />
                    Report Structure
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Cover Page",
                      "Executive Summary",
                      "Top Stories",
                      "Market Impact Analysis",
                      "OPEC & Policy Analysis",
                      "Company Developments",
                      "Risks",
                      "Opportunities",
                      "Things To Watch",
                      "Full News Brief",
                      "Source References",
                    ].map((section, i) => (
                      <div
                        key={section}
                        className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
                      >
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500">
                          {i + 1 > 10 ? "" : i + 1}
                        </span>
                        {section}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    <strong className="text-slate-500 dark:text-slate-400">Disclaimer:</strong>{" "}
                    Reports are generated from publicly available sources using AI analysis.
                    This is for informational purposes only and does not constitute financial
                    or investment advice. Always verify information independently.
                  </p>
                </div>
              </div>
            )}

            {state === "loading" && <LoadingState />}

            {state === "error" && (
              <ErrorState message={errorMessage} onRetry={handleRetry} />
            )}

            {state === "success" && (
              <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-fade-in">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Report Ready!
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Your intelligence report has been downloaded successfully.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setState("idle")}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Generate Another
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Download Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Oil & Gas Intelligence Report Generator — For executive decision-making only.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Powered by Google Gemini AI · Built with Next.js
          </p>
        </div>
      </footer>
    </div>
  );
}
