"use client";

import { FileDown, Loader2, Sparkles } from "lucide-react";

interface GenerateButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function GenerateButton({ onClick, loading, disabled }: GenerateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 px-8 py-4 text-base font-bold text-white dark:text-slate-900 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
    >
      {/* Shimmer effect */}
      {!loading && !disabled && (
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}

      {/* Gold accent bar */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

      <div className="relative flex items-center justify-center gap-3">
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Generating Report...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span>Generate Report</span>
            <FileDown className="h-5 w-5 text-amber-400" />
          </>
        )}
      </div>
    </button>
  );
}
