"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
          Report Generation Failed
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {message || "An unexpected error occurred while generating your report."}
        </p>
      </div>

      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4 max-w-md w-full">
        <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Possible causes:</p>
        <ul className="text-xs text-red-500 dark:text-red-400 space-y-1 list-disc list-inside">
          <li>News sources temporarily unavailable</li>
          <li>AI service timeout (try disabling AI analysis)</li>
          <li>Network connectivity issue</li>
          <li>Gemini API key not configured</li>
        </ul>
      </div>

      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}
