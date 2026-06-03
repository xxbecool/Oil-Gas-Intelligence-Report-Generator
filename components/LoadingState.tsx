"use client";

import { Loader2, Globe, Brain, FileText, CheckCircle } from "lucide-react";

interface Stage {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const STAGES: Stage[] = [
  {
    id: "collecting",
    label: "Collecting News",
    icon: <Globe className="h-5 w-5" />,
    description: "Fetching from trusted industry sources",
  },
  {
    id: "validating",
    label: "Validating Articles",
    icon: <CheckCircle className="h-5 w-5" />,
    description: "Filtering and deduplicating content",
  },
  {
    id: "analyzing",
    label: "AI Analysis",
    icon: <Brain className="h-5 w-5" />,
    description: "Generating executive intelligence insights",
  },
  {
    id: "generating",
    label: "Building PDF",
    icon: <FileText className="h-5 w-5" />,
    description: "Creating professional report",
  },
];

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-fade-in">
      {/* Main spinner */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full border-4 border-slate-200 dark:border-slate-700" />
        <div className="absolute h-24 w-24 rounded-full border-4 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-amber-500">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
          Generating Intelligence Report
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          Your report is being assembled from live industry data. This may take up to 60 seconds.
        </p>
      </div>

      {/* Stage indicators */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {STAGES.map((stage, idx) => (
          <div
            key={stage.id}
            className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 animate-pulse-slow"
            style={{ animationDelay: `${idx * 0.5}s` }}
          >
            <div className="mt-0.5 text-amber-500 flex-shrink-0">{stage.icon}</div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {stage.label}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {stage.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Do not close this tab. Your PDF will download automatically when ready.
      </p>
    </div>
  );
}
