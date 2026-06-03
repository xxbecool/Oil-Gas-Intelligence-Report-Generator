"use client";

import { useState } from "react";
import {
  Settings2,
  Layers,
  Brain,
  BookOpen,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

export type ReportFocus =
  | "General Oil & Gas"
  | "Upstream"
  | "Downstream"
  | "LNG"
  | "OPEC"
  | "Market Intelligence";

export interface ReportSettingsValues {
  maxArticles: number;
  includeAI: boolean;
  includeSources: boolean;
  focus: ReportFocus;
}

interface ReportSettingsProps {
  values: ReportSettingsValues;
  onChange: (values: ReportSettingsValues) => void;
  disabled?: boolean;
}

const FOCUS_OPTIONS: { value: ReportFocus; label: string; description: string }[] = [
  {
    value: "General Oil & Gas",
    label: "General Oil & Gas",
    description: "Full coverage across all segments",
  },
  {
    value: "Upstream",
    label: "Upstream",
    description: "Exploration, drilling & production",
  },
  {
    value: "Downstream",
    label: "Downstream",
    description: "Refining, retail & distribution",
  },
  {
    value: "LNG",
    label: "LNG",
    description: "Liquefied natural gas markets",
  },
  {
    value: "OPEC",
    label: "OPEC",
    description: "OPEC+ policy & production decisions",
  },
  {
    value: "Market Intelligence",
    label: "Market Intelligence",
    description: "Price trends & market dynamics",
  },
];

interface ToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ enabled, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? "bg-amber-500" : "bg-slate-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function ReportSettings({ values, onChange, disabled }: ReportSettingsProps) {
  const [focusOpen, setFocusOpen] = useState(false);

  const update = (partial: Partial<ReportSettingsValues>) =>
    onChange({ ...values, ...partial });

  const selectedFocus = FOCUS_OPTIONS.find((o) => o.value === values.focus);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1">
        <Settings2 className="h-5 w-5 text-amber-500" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Report Configuration
        </h3>
      </div>

      {/* Max Articles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Maximum Articles
            </label>
          </div>
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-sm font-bold text-amber-700 dark:text-amber-400">
            {values.maxArticles}
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={20}
          step={1}
          value={values.maxArticles}
          disabled={disabled}
          onChange={(e) => update({ maxArticles: parseInt(e.target.value) })}
          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>5 (Fast)</span>
          <span>20 (Comprehensive)</span>
        </div>
      </div>

      {/* Report Focus */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-400" />
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Report Focus
          </label>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setFocusOpen(!focusOpen)}
            className="w-full flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:border-amber-400 dark:hover:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <span>{selectedFocus?.label ?? values.focus}</span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${focusOpen ? "rotate-180" : ""}`}
            />
          </button>

          {focusOpen && !disabled && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
              {FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    update({ focus: opt.value });
                    setFocusOpen(false);
                  }}
                  className={`w-full flex flex-col items-start px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    values.focus === opt.value
                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-1">
        {/* Include AI */}
        <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Include AI Analysis
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Executive insights via Google Gemini
              </p>
            </div>
          </div>
          <Toggle
            enabled={values.includeAI}
            onChange={(v) => update({ includeAI: v })}
            disabled={disabled}
          />
        </div>

        {/* Include Sources */}
        <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Include Source References
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Append full source list to report
              </p>
            </div>
          </div>
          <Toggle
            enabled={values.includeSources}
            onChange={(v) => update({ includeSources: v })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
