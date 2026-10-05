"use client";

import { useState, useRef, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WordplayItem {
  phrase: string;
  type: "pun" | "double_meaning" | "allusion" | "metaphor" | "simile" | string;
  explanation: string;
}

export interface RhymeScheme {
  pattern: string;
  type: string;
  details: string;
}

export interface DoubleMeaning {
  phrase: string;
  surface?: string;
  deeper?: string;
  surfaceReading?: string;
  deeperReading?: string;
}

export interface VocabItem {
  word: string;
  definition: string;
  type?: "slang" | "aave" | "cultural" | "technical" | "standard" | string;
}

export interface AnalysisResult {
  literalMeaning: string;
  culturalContext: string | null;
  wordplay: WordplayItem[];
  rhymeScheme: RhymeScheme;
  doubleMeanings: DoubleMeaning[];
  vocabularyBreakdown?: VocabItem[];
  vocabulary?: VocabItem[];
  craftSummary: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Tappable chip that expands into a definition tooltip */
function WordChip({ item, index }: { item: VocabItem; index: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Vibrant mix of orange and purple Tailwind accent colors
  const chipStyle =
    index % 2 === 0
      ? "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25 hover:border-orange-500/50"
      : "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25 hover:border-purple-500/50";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        id={`word-chip-${index}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`word-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium font-inter transition-all duration-200 animate-fade-up opacity-0 ${chipStyle} ${
          open ? "ring-1 ring-accent/40 border-accent/40 !text-accent" : ""
        }`}
        style={{ animationFillMode: "forwards", animationDelay: `${0.3 + index * 0.06}s` }}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
            open ? "bg-accent" : "bg-current opacity-70"
          }`}
        />
        {item.word}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-72 max-w-[90vw] z-50 animate-fade-in"
          role="tooltip"
        >
          <div className="glass-card rounded-2xl p-4 gradient-border shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-accent font-syne uppercase tracking-widest">
                {item.word}
              </p>
              {item.type && item.type !== "standard" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent/70 font-inter uppercase tracking-wide">
                  {item.type}
                </span>
              )}
            </div>
            <p className="text-sm text-textSecondary font-inter leading-relaxed">
              {item.definition}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Wordplay badge styling helper based on strict spec */
function getWordplayBadgeStyle(type: string): string {
  const norm = type.toLowerCase().replace(/[\s_]+/g, "_");
  switch (norm) {
    case "metaphor":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "simile":
      return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    case "allusion":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "double_meaning":
    case "doublemeaning":
    case "pun":
    default:
      return "bg-teal-500/20 text-teal-400 border-teal-500/30";
  }
}

/** Wordplay card — phrase + type badge + explanation */
function WordplayCard({ item, index }: { item: WordplayItem; index: number }) {
  const badgeStyle = getWordplayBadgeStyle(item.type);
  return (
    <div
      className="animate-fade-up opacity-0 rounded-2xl border border-border bg-surface p-4 flex flex-col gap-2.5"
      style={{ animationFillMode: "forwards", animationDelay: `${0.45 + index * 0.08}s` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-syne font-semibold text-textPrimary text-base leading-snug">
          &ldquo;{item.phrase}&rdquo;
        </p>
        <span
          className={`flex-shrink-0 text-[10px] font-inter font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${badgeStyle}`}
        >
          {item.type.replace(/_/g, " ")}
        </span>
      </div>
      <p className="text-sm text-textSecondary font-inter leading-relaxed">
        {item.explanation}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AnalysisDisplayProps {
  result: AnalysisResult;
  lyric: string;
  artist?: string;
  song?: string;
}

export default function AnalysisDisplay({ result, lyric, artist, song }: AnalysisDisplayProps) {
  const vocabList = result.vocabularyBreakdown || result.vocabulary || [];

  return (
    <div className="space-y-6 pb-20 animate-fade-in">

      {/* ── Analyzed lyric echo ─────────────────────────────────────── */}
      <div className="animate-fade-up opacity-0" style={{ animationFillMode: "forwards" }}>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs text-textMuted font-inter uppercase tracking-widest">Analyzing</p>
        </div>
        <blockquote className="border-l-2 border-accent/60 pl-5">
          <p className="font-syne text-xl md:text-2xl text-textPrimary leading-relaxed italic">
            &ldquo;{lyric}&rdquo;
          </p>
          {(artist || song) && (
            <p className="mt-2 text-sm text-textMuted font-inter">
              {song && <span className="text-textSecondary">{song}</span>}
              {song && artist && <span className="mx-1.5 text-textMuted">·</span>}
              {artist && <span>{artist}</span>}
            </p>
          )}
        </blockquote>
      </div>

      {/* ── Literal Meaning — hero ───────────────────────────────────── */}
      <div
        className="animate-slide-in opacity-0 stagger-1 rounded-3xl p-6 md:p-8 gradient-border relative overflow-hidden"
        style={{
          animationFillMode: "forwards",
          background: "linear-gradient(135deg, rgba(200,245,60,0.07) 0%, rgba(17,17,22,0.9) 60%)",
        }}
      >
        {/* Decorative glow orb */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
        <p className="text-xs text-accent font-syne font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M7 1L8.545 5.182H13L9.727 7.636L11.273 12L7 9.273L2.727 12L4.273 7.636L1 5.182H5.455L7 1Z" />
          </svg>
          Literal Meaning
        </p>
        <p className="font-inter text-lg md:text-xl text-textPrimary leading-relaxed font-light relative z-10">
          {result.literalMeaning}
        </p>
      </div>

      {/* ── Cultural Context ─────────────────────────────────────────── */}
      {result.culturalContext && result.culturalContext.trim() !== "" && (
        <div
          className="animate-slide-in opacity-0 stagger-2 rounded-2xl p-5 md:p-6 border border-border/60 bg-surface"
          style={{ animationFillMode: "forwards" }}
        >
          <p className="text-xs text-textMuted font-inter uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Cultural Context
          </p>
          <p className="text-textSecondary font-inter leading-relaxed text-sm md:text-base">
            {result.culturalContext}
          </p>
        </div>
      )}

      {/* ── Wordplay & Devices ───────────────────────────────────────── */}
      {result.wordplay && result.wordplay.length > 0 && (
        <div
          className="animate-fade-up opacity-0 stagger-3"
          style={{ animationFillMode: "forwards" }}
        >
          <p className="text-xs text-textMuted font-inter uppercase tracking-widest mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Wordplay &amp; Devices
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.wordplay.map((wp, i) => (
              <WordplayCard key={i} item={wp} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Rhyme Scheme & Flow ───────────────────────────────────────── */}
      {result.rhymeScheme && (
        <div
          className="animate-fade-up opacity-0 stagger-4 flex items-start gap-4 p-4 md:p-5 rounded-2xl border border-border bg-surface"
          style={{ animationFillMode: "forwards" }}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mt-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8F53C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-textMuted font-inter uppercase tracking-widest mb-1">Rhyme Scheme &amp; Flow</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-syne font-bold text-textPrimary text-base">
                {result.rhymeScheme.pattern}
              </span>
              {result.rhymeScheme.type && (
                <span className="text-xs text-accent/70 font-inter bg-accent/8 px-2 py-0.5 rounded-full">
                  {result.rhymeScheme.type}
                </span>
              )}
            </div>
            {result.rhymeScheme.details && (
              <p className="text-xs text-textMuted font-inter mt-1.5 leading-relaxed">
                {result.rhymeScheme.details}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Double Meanings ──────────────────────────────────────────── */}
      {result.doubleMeanings && result.doubleMeanings.length > 0 && (
        <div
          className="animate-fade-up opacity-0 stagger-5"
          style={{ animationFillMode: "forwards" }}
        >
          <p className="text-xs text-textMuted font-inter uppercase tracking-widest mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            Double Meanings
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.doubleMeanings.map((dm, i) => {
              const surfaceText = dm.surface || dm.surfaceReading || "";
              const deeperText = dm.deeper || dm.deeperReading || "";
              return (
                <div
                  key={i}
                  className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-2"
                >
                  <p className="font-syne font-semibold text-textPrimary text-sm">&ldquo;{dm.phrase}&rdquo;</p>
                  <div className="space-y-1.5">
                    {surfaceText && (
                      <p className="text-xs text-textMuted font-inter">
                        <span className="text-teal-400 font-semibold uppercase tracking-wider mr-1.5">Surface:</span>
                        {surfaceText}
                      </p>
                    )}
                    {deeperText && (
                      <p className="text-xs text-textSecondary font-inter">
                        <span className="text-accent font-semibold uppercase tracking-wider mr-1.5">Deeper:</span>
                        {deeperText}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Vocabulary Breakdown — interactive chips ──────────────────── */}
      {vocabList && vocabList.length > 0 && (
        <div
          className="animate-fade-up opacity-0 stagger-6"
          style={{ animationFillMode: "forwards" }}
        >
          <p className="text-xs text-textMuted font-inter uppercase tracking-widest mb-3">
            Vocabulary Breakdown&nbsp;
            <span className="normal-case text-textMuted/70">— tap to explore</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {vocabList.map((wb, i) => (
              <WordChip key={i} item={wb} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Craft Summary ────────────────────────────────────────────── */}
      {result.craftSummary && (
        <div
          className="animate-fade-up opacity-0"
          style={{ animationFillMode: "forwards", animationDelay: "0.7s" }}
        >
          <p className="text-xs text-textMuted font-inter uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Craft &amp; Technique
          </p>
          <div className="rounded-2xl border border-border/60 bg-surface p-5">
            <p className="text-sm text-textSecondary font-inter leading-relaxed">{result.craftSummary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
