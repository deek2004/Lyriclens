import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Types — raw LLM output ───────────────────────────────────────────────────

interface LLMWordplayItem {
  phrase: string;
  type: "metaphor" | "simile" | "allusion" | "double_meaning" | "pun" | string;
  explanation: string;
}

interface LLMDoubleMeaning {
  phrase: string;
  surface?: string;
  surfaceReading?: string;
  deeper?: string;
  deeperReading?: string;
}

interface LLMVocabItem {
  word: string;
  definition: string;
  type?: "slang" | "aave" | "cultural" | "technical" | "standard" | string;
}

interface LLMAnalysis {
  literalMeaning: string;
  culturalContext: string;
  wordplay: LLMWordplayItem[];
  rhymeScheme: {
    pattern: string;
    type: string;
    details: string;
  };
  doubleMeanings: LLMDoubleMeaning[];
  vocabulary: LLMVocabItem[];
  craftSummary: string;
}

// ─── Types — API response sent to frontend ────────────────────────────────────

interface TransformedResult {
  literalMeaning: string;
  culturalContext: string | null;
  wordplay: Array<{ phrase: string; type: string; explanation: string }>;
  rhymeScheme: { pattern: string; type: string; details: string };
  doubleMeanings: Array<{
    phrase: string;
    surface: string;
    deeper: string;
    surfaceReading: string;
    deeperReading: string;
  }>;
  vocabulary: Array<{ word: string; definition: string; type: string }>;
  vocabularyBreakdown: Array<{ word: string; definition: string; type: string }>;
  craftSummary: string;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are LyricLens, an expert hip-hop and poetry analyst. You write like a sharp critic who has spent years close-reading bars, verses, and poems.

Your ONLY output is a single JSON object. No markdown fences, no preamble, no trailing commentary — just raw parseable JSON.

════════════════════════════════════
DEVICE DEFINITIONS (use these strictly — never mislabel):

METAPHOR: Direct comparison stating one thing is another (e.g., "Aisle 7 is a battlefield").
SIMILE: Comparison using "like" or "as" (e.g., "Wet you like the hot tub").
ALLUSION: Indirect reference to a person, place, thing, or cultural work (e.g., mentioning "Stanley Kubrick").
DOUBLE MEANING / PUN: Wordplay where a phrase simultaneously holds a literal/surface interpretation and a hidden/coded/threat-based secondary interpretation.
════════════════════════════════════

The JSON object MUST contain EXACTLY these seven keys:

{
  "literalMeaning": string,
  "culturalContext": string,
  "wordplay": [{ "phrase": string, "type": string, "explanation": string }],
  "rhymeScheme": { "pattern": string, "type": string, "details": string },
  "doubleMeanings": [{ "phrase": string, "surface": string, "deeper": string }],
  "vocabulary": [{ "word": string, "definition": string, "type": string }],
  "craftSummary": string
}

════ FIELD REQUIREMENTS ════

literalMeaning (string, ≥ 5 sentences):
  Paraphrase the lyric in plain English. Unpack references, slang, biographical or historical context.
  Quote exact words from the lyric to support every claim.

culturalContext (string, ≥ 3 sentences):
  The social, historical, or genre context that shapes this lyric.
  Name real movements, eras, locations, or cultural codes relevant to the artist and song.
  If no context is known, analyse the genre conventions visible in the words.

wordplay (array, 1–8 items):
  Each item: { "phrase": <exact words from the lyric>, "type": <one of: metaphor|simile|allusion|double_meaning|pun>, "explanation": <1–3 sentences unpacking the figurative/secondary meaning> }
  Use the strict device definitions above:
    - METAPHOR: Direct comparison stating one thing is another (e.g., "Aisle 7 is a battlefield").
    - SIMILE: Comparison using "like" or "as" (e.g., "Wet you like the hot tub").
    - ALLUSION: Indirect reference to a person, place, thing, or cultural work (e.g., mentioning "Stanley Kubrick").
    - DOUBLE MEANING / PUN: Wordplay where a phrase simultaneously holds a literal/surface interpretation and a hidden/coded/threat-based secondary interpretation.
  Never label a simile as a metaphor (look for "like"/"as").
  Never invent phrases not present in the lyric.
  If no wordplay exists, return [].

rhymeScheme (object):
  pattern (string, ≥ 3 sentences): End rhyme, internal rhyme, slant/near rhyme, assonance, consonance,
    alliteration, multisyllabic rhyme. State the pattern (AABB, ABAB, free verse, etc.)
    and explain how sound supports meaning.
  type (string): e.g. "AABB", "ABAB", "free verse", "multisyllabic", "internal rhyme", "couplet".
  details (string, ≥ 3 sentences): Cadence, flow, breath control, delivery notes, how the
    sonic choices reinforce the lyrical content.

doubleMeanings (array, 0–5 items):
  Each item: { "phrase": <exact words from lyric>, "surface": <literal/surface interpretation>, "deeper": <hidden/coded/threat-based secondary interpretation> }
  Focus on coded language, street slang, threats disguised as innocuous statements, and boasts with dual registers.
  Return [] if none are present.

vocabulary (array, 0–8 items):
  Each item: { "word": <single word or short phrase from lyric>, "definition": <clear definition in context>, "type": <slang|aave|cultural|technical|standard> }
  Pick words that non-native listeners or younger/older audiences might not immediately understand.
  Return [] if all vocabulary is self-evident.

craftSummary (string, ≥ 5 sentences):
  Synthesise the writer's overall craft: persona, tone, pacing, punchline structure, enjambment,
  imagery, and performance technique. Explain WHY the specific choices are effective.
  Quote the lyric directly.

════ RULES ════
- Every string field must be substantive (≥ 3 full sentences minimum; no one-word answers, no "N/A", no "none").
- culturalContext must always be a non-empty string — never null, never "".
- Use the artist/song context if provided; if not, analyse the words on the page.
- Return only valid, parseable JSON. No markdown. No commentary outside the JSON.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSubstantial(value: unknown, minLen = 60): boolean {
  return (
    typeof value === "string" &&
    value.trim().length >= minLen &&
    !/^(ok|n\/a|na|none|stub|unknown|yes|no)$/i.test(value.trim())
  );
}

function sanitiseWordplay(raw: unknown): Array<{ phrase: string; type: string; explanation: string }> {
  if (!Array.isArray(raw)) return [];
  const VALID_TYPES = new Set(["metaphor", "simile", "allusion", "double_meaning", "pun"]);
  return raw
    .filter(
      (item): item is LLMWordplayItem =>
        !!item &&
        typeof item.phrase === "string" &&
        item.phrase.trim() !== "" &&
        typeof item.explanation === "string" &&
        item.explanation.trim() !== ""
    )
    .map((item) => {
      const typeLower = (item.type || "").toLowerCase().trim();
      let normType = "metaphor";
      if (VALID_TYPES.has(typeLower)) {
        normType = typeLower;
      } else if (typeLower.includes("double") || typeLower.includes("meaning")) {
        normType = "double_meaning";
      } else if (typeLower.includes("simile")) {
        normType = "simile";
      } else if (typeLower.includes("allusion")) {
        normType = "allusion";
      } else if (typeLower.includes("pun")) {
        normType = "pun";
      }
      return {
        phrase: item.phrase.trim(),
        type: normType,
        explanation: item.explanation.trim(),
      };
    });
}

function sanitiseDoubleMeanings(raw: unknown): Array<{
  phrase: string;
  surface: string;
  deeper: string;
  surfaceReading: string;
  deeperReading: string;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is LLMDoubleMeaning =>
        !!item &&
        typeof item.phrase === "string" &&
        item.phrase.trim() !== ""
    )
    .map((item) => {
      const s = (item.surface || item.surfaceReading || "").trim();
      const d = (item.deeper || item.deeperReading || "").trim();
      return {
        phrase: item.phrase.trim(),
        surface: s,
        deeper: d,
        surfaceReading: s,
        deeperReading: d,
      };
    });
}

function sanitiseVocabulary(raw: unknown): Array<{ word: string; definition: string; type: string }> {
  if (!Array.isArray(raw)) return [];
  const VALID_VOCAB_TYPES = new Set(["slang", "aave", "cultural", "technical", "standard"]);
  return raw
    .filter(
      (item): item is LLMVocabItem =>
        !!item &&
        typeof item.word === "string" &&
        item.word.trim() !== "" &&
        typeof item.definition === "string" &&
        item.definition.trim() !== ""
    )
    .map((item) => ({
      word: item.word.trim(),
      definition: item.definition.trim(),
      type: (item.type && VALID_VOCAB_TYPES.has(item.type.toLowerCase())) ? item.type.toLowerCase() : "standard",
    }));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse & validate body ────────────────────────────────────────────
    let rawBody: string | undefined;
    try {
      rawBody = await request.text();
      console.log("[interpret] Raw request body:", rawBody);
    } catch (readErr) {
      console.error("[interpret] Failed to read request body:", readErr);
      return NextResponse.json({ error: "Could not read request body." }, { status: 400 });
    }

    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(rawBody ?? "");
    } catch (parseErr) {
      console.error("[interpret] JSON parse error:", parseErr, "| Raw body was:", rawBody);
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { lyric, song, artist } = body as {
      lyric?: string;
      song?: string;
      artist?: string;
    };

    console.log("[interpret] Parsed fields — lyric:", lyric?.slice(0, 80), "| song:", song, "| artist:", artist);

    if (!lyric || lyric.trim() === "") {
      return NextResponse.json(
        { error: "lyric is required and cannot be empty." },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("[interpret] GROQ_API_KEY is not set.");
      return NextResponse.json(
        { error: "Server misconfiguration: missing API key." },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // ── 2. Build user prompt ────────────────────────────────────────────────
    const userMessage = [
      "Produce a deep, structured JSON analysis of this lyric.",
      "Every field must contain multiple full sentences — never one-word answers.",
      "Use the device definitions strictly: METAPHOR (direct IS comparison), SIMILE ('like'/'as'), ALLUSION (indirect reference), DOUBLE MEANING / PUN (literal surface + hidden deeper).",
      `Lyric: "${lyric.trim()}"`,
      `Song: ${song?.trim() || "Unknown"}`,
      `Artist: ${artist?.trim() || "Unknown"}`,
    ].join("\n");

    // ── 3. Call Groq ────────────────────────────────────────────────────────
    let completion: Awaited<ReturnType<typeof groq.chat.completions.create>>;
    try {
      completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        response_format: { type: "json_object" },
        temperature: 0.35,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      });
    } catch (groqErr: unknown) {
      const groqMsg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      console.error("[interpret] Groq API error:", groqMsg);
      return NextResponse.json(
        {
          error: "AI service error. Please try again.",
          ...(process.env.NODE_ENV !== "production" && { detail: groqMsg }),
        },
        { status: 502 }
      );
    }

    const rawText = completion.choices[0]?.message?.content ?? "";
    console.log("[interpret] Raw LLM response (first 600 chars):", rawText.slice(0, 600));

    // Strip markdown code fences if the model wraps output anyway
    const cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim();

    // ── 4. Parse JSON ────────────────────────────────────────────────────────
    let analysis: LLMAnalysis;
    try {
      analysis = JSON.parse(cleanedText);
    } catch (jsonErr) {
      console.error("[interpret] JSON.parse failed. Error:", jsonErr, "| Cleaned text:", cleanedText);
      return NextResponse.json(
        { error: "The AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    // ── 5. Validate required string fields ──────────────────────────────────
    const requiredStrings: (keyof LLMAnalysis)[] = ["literalMeaning", "culturalContext", "craftSummary"];
    const shallow = requiredStrings.filter((k) => !isSubstantial(analysis[k], 20));
    if (shallow.length > 0) {
      console.error("[interpret] Shallow/missing required fields:", shallow, "| Raw:", rawText.slice(0, 400));
      return NextResponse.json(
        { error: "The AI returned an incomplete analysis. Please try again." },
        { status: 502 }
      );
    }

    // Validate rhymeScheme object
    if (
      !analysis.rhymeScheme ||
      typeof analysis.rhymeScheme !== "object" ||
      typeof analysis.rhymeScheme.pattern !== "string" ||
      analysis.rhymeScheme.pattern.trim().length < 3
    ) {
      console.error("[interpret] rhymeScheme missing or shallow. Raw:", rawText.slice(0, 400));
      return NextResponse.json(
        { error: "The AI returned an incomplete analysis. Please try again." },
        { status: 502 }
      );
    }

    // ── 6. Build sanitised response ─────────────────────────────────────────
    const vocabList = sanitiseVocabulary(
      analysis.vocabulary ?? (analysis as unknown as Record<string, unknown>).vocabularyBreakdown
    );

    const transformedResult: TransformedResult = {
      literalMeaning: analysis.literalMeaning.trim(),
      culturalContext: analysis.culturalContext?.trim() || null,
      wordplay: sanitiseWordplay(analysis.wordplay),
      rhymeScheme: {
        pattern: analysis.rhymeScheme.pattern.trim(),
        type: (analysis.rhymeScheme.type ?? "").trim() || "complex",
        details: (analysis.rhymeScheme.details ?? "").trim(),
      },
      doubleMeanings: sanitiseDoubleMeanings(analysis.doubleMeanings),
      vocabulary: vocabList,
      vocabularyBreakdown: vocabList,
      craftSummary: analysis.craftSummary.trim(),
    };

    // ── 7. Persist (non-blocking, best-effort) ──────────────────────────────
    prisma.interpretation
      .create({
        data: {
          userId: null,
          artist: artist?.trim() || null,
          lyric: lyric.trim(),
          songTitle: song?.trim() || null,
          analysis: transformedResult as unknown as Prisma.InputJsonValue,
        },
      })
      .catch((dbErr: unknown) => {
        const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        console.error("[interpret] Non-fatal DB persist error (analysis still returned):", dbMsg);
      });

    // ── 8. Return to client ─────────────────────────────────────────────────
    return NextResponse.json(transformedResult, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[/api/interpret] Unhandled error:", msg, "\n", stack);
    return NextResponse.json(
      {
        error: "interpretation_failed",
        ...(process.env.NODE_ENV !== "production" && { detail: msg }),
      },
      { status: 500 }
    );
  }
}
