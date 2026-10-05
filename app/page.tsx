"use client";

import { useState, useRef, useEffect } from "react";
import AnalysisDisplay, { AnalysisResult } from "./components/AnalysisDisplay";

const EXAMPLE_LYRICS = [
  { lyric: "I shot the sheriff, but I did not shoot the deputy", song: "I Shot The Sheriff", artist: "Bob Marley" },
  { lyric: "To be or not to be, that is the question", song: "Hamlet", artist: "Shakespeare" },
  { lyric: "Cause every time we touch I get this feeling", song: "Everytime We Touch", artist: "Cascada" },
  { lyric: "Stairway to heaven", song: "Stairway to Heaven", artist: "Led Zeppelin" },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <div className="rounded-3xl p-8 border border-border/40 overflow-hidden">
        <div className="skeleton h-3 w-28 rounded-full mb-5" />
        <div className="space-y-3">
          <div className="skeleton h-6 rounded-xl w-full" />
          <div className="skeleton h-6 rounded-xl w-5/6" />
          <div className="skeleton h-6 rounded-xl w-4/6" />
        </div>
      </div>
      <div>
        <div className="skeleton h-3 w-24 rounded-full mb-4" />
        <div className="flex gap-2">
          {[80, 100, 72, 88].map((w) => (
            <div key={w} className="skeleton h-7 rounded-full" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
      <div>
        <div className="skeleton h-3 w-32 rounded-full mb-4" />
        <div className="flex flex-wrap gap-2">
          {[90, 70, 110, 80, 95, 75].map((w, i) => (
            <div key={i} className="skeleton h-8 rounded-full" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
      <div className="skeleton h-20 rounded-2xl" />
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  );
}

export default function Home() {
  const [lyric, setLyric] = useState("");
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedLyric, setSubmittedLyric] = useState("");
  const [submittedSong, setSubmittedSong] = useState("");
  const [submittedArtist, setSubmittedArtist] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [lyric]);

  // Scroll to results when they arrive
  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [result]);

  async function runAnalysis(lyricVal: string, songVal: string, artistVal: string) {
    if (!lyricVal.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setSubmittedLyric(lyricVal.trim());
    setSubmittedSong(songVal.trim());
    setSubmittedArtist(artistVal.trim());

    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyric: lyricVal.trim(),
          song: songVal.trim(),
          artist: artistVal.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runAnalysis(lyric, song, artist);
  }

  function handleExample(example: typeof EXAMPLE_LYRICS[0]) {
    setLyric(example.lyric);
    setSong(example.song);
    setArtist(example.artist);
    setResult(null);
    setError(null);
    runAnalysis(example.lyric, example.song, example.artist);
  }

  const canSubmit = lyric.trim().length > 0 && !loading;

  return (
    <main className="min-h-screen bg-bg bg-grid">
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(200,245,60,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 pt-16 pb-8">
        {/* Header */}
        <header className="text-center mb-12 animate-fade-up opacity-0" style={{ animationFillMode: "forwards" }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-accent/30 bg-accent/8 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-inter font-medium text-accent/80 tracking-wide">
              Free AI-Powered Lyric Analysis
            </span>
          </div>
          <h1 className="font-syne font-extrabold text-5xl md:text-6xl text-textPrimary mb-4 leading-none tracking-tight">
            Lyric
            <span className="text-accent">Lens</span>
          </h1>
          <p className="font-inter text-textSecondary text-lg max-w-md mx-auto leading-relaxed">
            Paste any lyric line and uncover its hidden meaning, poetic devices, and double meanings instantly.
          </p>
        </header>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="animate-slide-in opacity-0 stagger-2 glass-card rounded-3xl p-6 mb-8 gradient-border"
          style={{ animationFillMode: "forwards" }}
          aria-label="Lyric analysis form"
        >
          {/* Lyric input */}
          <div className="mb-4">
            <label
              htmlFor="lyric-input"
              className="block text-xs font-inter font-medium text-textMuted uppercase tracking-widest mb-2"
            >
              Lyric Line <span className="text-accent">*</span>
            </label>
            <textarea
              id="lyric-input"
              ref={textareaRef}
              value={lyric}
              onChange={(e) => setLyric(e.target.value)}
              placeholder="Paste 2–8 bars for deep analysis..."
              rows={2}
              required
              disabled={loading}
              className="w-full bg-bg/60 border border-border rounded-xl px-4 py-3 text-textPrimary font-inter text-base placeholder:text-textMuted resize-none overflow-hidden transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/30 focus:outline-none disabled:opacity-50"
              style={{ minHeight: "72px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSubmit) {
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }
              }}
            />
          </div>

          {/* Song Title Input */}
          <div className="mb-4">
            <label
              htmlFor="song-input"
              className="block text-xs font-inter font-medium text-textMuted uppercase tracking-widest mb-2"
            >
              Song Title <span className="text-textMuted font-normal lowercase">(optional)</span>
            </label>
            <input
              id="song-input"
              type="text"
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="e.g. HUMBLE."
              disabled={loading}
              className="w-full bg-bg/60 border border-border rounded-xl px-4 py-3 text-textPrimary font-inter text-sm placeholder:text-textMuted transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/30 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Artist Input */}
          <div className="mb-5">
            <label
              htmlFor="artist-input"
              className="block text-xs font-inter font-medium text-textMuted uppercase tracking-widest mb-2"
            >
              Artist <span className="text-textMuted font-normal lowercase">(optional)</span>
            </label>
            <input
              id="artist-input"
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Kendrick Lamar"
              disabled={loading}
              className="w-full bg-bg/60 border border-border rounded-xl px-4 py-3 text-textPrimary font-inter text-sm placeholder:text-textMuted transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/30 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Submit button */}
          <button
            id="submit-btn"
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-syne font-bold text-base transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: canSubmit
                ? "linear-gradient(135deg, #C8F53C 0%, #9DB82E 100%)"
                : "#2a2a3a",
              color: canSubmit ? "#09090C" : "#5C5C70",
              boxShadow: canSubmit ? "0 4px 32px rgba(200,245,60,0.3)" : "none",
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Analyzing…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Analyze Lyric
              </>
            )}
          </button>

          {/* Examples */}
          <div className="mt-5 pt-4 border-t border-border/50">
            <p className="text-xs text-textMuted font-inter mb-2.5">Try an example:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_LYRICS.map((ex, i) => (
                <button
                  key={i}
                  id={`example-btn-${i}`}
                  type="button"
                  onClick={() => handleExample(ex)}
                  disabled={loading}
                  className="px-3 py-1 rounded-lg border border-border bg-surface text-textMuted text-xs font-inter hover:border-accent/30 hover:text-textSecondary transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {ex.song}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Error state */}
        {error && (
          <div
            className="animate-fade-up opacity-0 mb-8 p-4 rounded-2xl border border-red-500/30 bg-red-500/8 flex items-start gap-3"
            style={{ animationFillMode: "forwards" }}
            role="alert"
          >
            <svg className="flex-shrink-0 mt-0.5 text-red-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-red-400 font-inter">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <LoadingSkeleton />}

        {/* Results */}
        {result && !loading && (
          <div ref={resultsRef}>
            <AnalysisDisplay
              result={result}
              lyric={submittedLyric}
              artist={submittedArtist}
              song={submittedSong}
            />
          </div>
        )}
      </div>
    </main>
  );
}
