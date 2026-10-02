"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import AnalysisDisplay from "./components/AnalysisDisplay";

interface AnalysisResult {
  literal_meaning: string;
  cultural_context: string | null;
  wordplay: Array<{ phrase: string; type: string; explanation: string }>;
  rhyme_scheme: { pattern: string; type: string; details: string };
  tags: string[];
  word_breakdown: Array<{ word: string; definition: string; type: string }>;
  difficulty: "easy" | "medium" | "hard";
}

const EXAMPLE_LYRICS = [
  { lyric: "I shot the sheriff, but I did not shoot the deputy", artist: "Bob Marley", song: "I Shot The Sheriff" },
  { lyric: "To be or not to be, that is the question", artist: "Shakespeare", song: "Hamlet" },
  { lyric: "Cause every time we touch I get this feeling", artist: "Cascada", song: "Everytime We Touch" },
  { lyric: "Stairway to heaven", artist: "Led Zeppelin", song: "Stairway to Heaven" },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Hero block */}
      <div className="rounded-3xl p-8 border border-border/40 overflow-hidden">
        <div className="skeleton h-3 w-28 rounded-full mb-5" />
        <div className="space-y-3">
          <div className="skeleton h-6 rounded-xl w-full" />
          <div className="skeleton h-6 rounded-xl w-5/6" />
          <div className="skeleton h-6 rounded-xl w-4/6" />
        </div>
      </div>
      {/* Tags */}
      <div>
        <div className="skeleton h-3 w-24 rounded-full mb-4" />
        <div className="flex gap-2">
          {[80, 100, 72, 88].map((w) => (
            <div key={w} className="skeleton h-7 rounded-full" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
      {/* Chips */}
      <div>
        <div className="skeleton h-3 w-32 rounded-full mb-4" />
        <div className="flex flex-wrap gap-2">
          {[90, 70, 110, 80, 95, 75].map((w, i) => (
            <div key={i} className="skeleton h-8 rounded-full" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
      {/* Rhyme */}
      <div className="skeleton h-20 rounded-2xl" />
      {/* Context */}
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  );
}

export default function Home() {
  const [lyric, setLyric] = useState("");
  const [artist, setArtist] = useState("");
  const [song, setSong] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [submittedLyric, setSubmittedLyric] = useState("");
  const [submittedArtist, setSubmittedArtist] = useState("");
  const [submittedSong, setSubmittedSong] = useState("");
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

  // ─── Core API call — takes values directly, never reads state ──────────────
  async function runAnalysis(lyricVal: string, artistVal: string, songVal: string) {
    console.log('Submitting:', { lyric: lyricVal, artist: artistVal, song: songVal });

    if (!lyricVal.trim() || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);
    setSubmittedLyric(lyricVal.trim());
    setSubmittedArtist(artistVal.trim());
    setSubmittedSong(songVal.trim());

    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyric: lyricVal.trim(),
          song: songVal.trim() || 'Unknown',
          artist: artistVal.trim() || 'Unknown',
        }),
      });

      const data = await response.json();

      if (response.status === 429 && data.error === 'daily_limit_reached') {
        setShowUpgradeModal(true);
        return;
      }

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

  // ─── Form submit — reads current state and passes values directly ────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runAnalysis(lyric, artist, song);
  }

  // ─── Example click — passes fresh values directly, no stale-state risk ──────
  function handleExample(example: typeof EXAMPLE_LYRICS[0]) {
    // Populate the form fields so the user can see what was loaded
    setLyric(example.lyric);
    setArtist(example.artist);
    setSong(example.song);
    setResult(null);
    setError(null);
    // Call the API immediately with the example values directly — do NOT read
    // from state here because React batches state updates and the new values
    // won't be visible in the closures until the next render.
    runAnalysis(example.lyric, example.artist, example.song);
  }

  const canSubmit = lyric.trim().length > 0 && !loading;

  // ─── Auth ─────────────────────────────────────────────────────────────────
  const { data: session, status } = useSession();
  const [showSignOut, setShowSignOut] = useState(false);

  return (
    <main className="min-h-screen bg-bg bg-grid">
      {/* ── Auth button — fixed top-right ────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50">
        {status === 'loading' ? (
          <div className="w-9 h-9 rounded-full skeleton" />
        ) : session?.user ? (
          <div className="relative" onMouseEnter={() => setShowSignOut(true)} onMouseLeave={() => setShowSignOut(false)}>
            <button
              id="user-avatar-btn"
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border bg-surface hover:border-accent/30 transition-all duration-200"
              aria-label="Account menu"
            >
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt={session.user.name ?? ''} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <span className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-syne font-bold text-sm">
                  {session.user.name?.[0] ?? '?'}
                </span>
              )}
              <span className="text-xs font-inter text-textSecondary max-w-[120px] truncate hidden sm:block">
                {session.user.name}
              </span>
            </button>
            {showSignOut && (
              <div className="absolute top-full right-0 mt-2 w-44 glass-card rounded-2xl border border-border shadow-xl shadow-black/40 overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-border/60">
                  <p className="text-xs text-textMuted font-inter truncate">{session.user.email}</p>
                  {session.user.plan && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent/80 font-inter uppercase tracking-wide">
                      {session.user.plan}
                    </span>
                  )}
                </div>
                <button
                  id="signout-btn"
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-4 py-3 text-xs text-textSecondary font-inter hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            id="signin-btn"
            onClick={() => signIn('google')}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-surface text-textSecondary text-xs font-inter font-medium hover:border-accent/40 hover:text-textPrimary transition-all duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        )}
      </div>

      {/* Radial glow at top */}
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
              AI-Powered Lyric Analysis
            </span>
          </div>
          <h1 className="font-syne font-extrabold text-5xl md:text-6xl text-textPrimary mb-4 leading-none tracking-tight">
            Lyric
            <span className="text-accent">Lens</span>
          </h1>
          <p className="font-inter text-textSecondary text-lg max-w-md mx-auto leading-relaxed">
            Paste any lyric line and uncover its hidden meaning, poetic devices, and cultural layers.
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
              placeholder="Paste a lyric line here…"
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

          {/* Artist + Song — side by side on md+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <div>
              <label
                htmlFor="artist-input"
                className="block text-xs font-inter font-medium text-textMuted uppercase tracking-widest mb-2"
              >
                Artist
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
            <div>
              <label
                htmlFor="song-input"
                className="block text-xs font-inter font-medium text-textMuted uppercase tracking-widest mb-2"
              >
                Song Title
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
                  {ex.artist}
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
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
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

      {/* ── Upgrade Modal ──────────────────────────────────────────────────── */}
      {showUpgradeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(9,9,12,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowUpgradeModal(false); }}
        >
          <div className="glass-card rounded-3xl p-8 max-w-sm w-full border border-accent/20 shadow-2xl shadow-accent/5 animate-fade-up" style={{ animationFillMode: 'forwards' }}>
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6 mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C8F53C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="font-syne font-extrabold text-xl text-textPrimary text-center mb-3">
              You&apos;ve used all 5 free interpretations today
            </h2>

            {/* Subtext */}
            <p className="font-inter text-sm text-textSecondary text-center leading-relaxed mb-8">
              Upgrade to <span className="text-accent font-semibold">Scholar</span> for{' '}
              <span className="text-textPrimary font-semibold">$7/month</span> and get unlimited
              interpretations, full rhyme maps, and Spotify sync.
            </p>

            {/* Upgrade CTA */}
            <button
              id="upgrade-btn"
              onClick={() => { console.log('checkout'); }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-syne font-bold text-sm mb-3 transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #C8F53C 0%, #9DB82E 100%)',
                color: '#09090C',
                boxShadow: '0 4px 32px rgba(200,245,60,0.25)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Upgrade to Scholar
            </button>

            {/* Dismiss */}
            <button
              id="upgrade-dismiss-btn"
              onClick={() => setShowUpgradeModal(false)}
              className="w-full py-2.5 text-xs font-inter text-textMuted hover:text-textSecondary transition-colors duration-150"
            >
              Come back tomorrow for 5 more free ones
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
