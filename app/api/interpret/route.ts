import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  literalMeaning: string;
  culturalContext: string | null;
  wordplay: Array<{
    phrase: string;
    type: "pun" | "double_meaning" | "allusion" | "metaphor" | "simile";
    explanation: string;
  }>;
  rhymeScheme: {
    pattern: string;
    type: string;
    details: string;
  };
  doubleMeanings: Array<{
    phrase: string;
    surfaceReading: string;
    deeperReading: string;
  }>;
  vocabularyBreakdown: Array<{
    word: string;
    definition: string;
    type: "slang" | "aave" | "cultural" | "technical" | "standard";
  }>;
  craftSummary: string;
}

// ─── Groq client (instantiated once per worker) ───────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are LyricLens, an expert music analyst and linguist. Your sole job is to decode lyric lines so any listener — regardless of background — can deeply understand what an artist is saying AND how they are saying it.

You will receive a lyric line, the artist name, and optionally a song title. Return ONLY a valid JSON object with this exact structure (no markdown fences, no preamble, no trailing text):

{
  "literalMeaning": "Plain-English explanation of exactly what the line says, written for a curious 15-year-old with no music background.",
  "culturalContext": "Essential cultural background needed to understand the reference. Set to null if not needed.",
  "wordplay": [
    { "phrase": "exact phrase from lyric", "type": "pun|double_meaning|allusion|metaphor|simile", "explanation": "how the device works here" }
  ],
  "rhymeScheme": {
    "pattern": "AABB / ABAB / free verse / etc.",
    "type": "end rhyme / internal rhyme / slant rhyme / none",
    "details": "one-sentence description of the rhyme structure"
  },
  "doubleMeanings": [
    { "phrase": "exact phrase", "surfaceReading": "obvious interpretation", "deeperReading": "hidden or second interpretation" }
  ],
  "vocabularyBreakdown": [
    { "word": "word or phrase", "definition": "clear definition in context", "type": "slang|aave|cultural|technical|standard" }
  ],
  "craftSummary": "2-3 sentence paragraph summarising the artist's craft choices and overall effect of the line."
}

Rules:
- wordplay and doubleMeanings may be empty arrays if none exist — never fabricate them.
- Never wrap the JSON in markdown code fences.
- Return only valid, parseable JSON.`;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse & validate body ────────────────────────────────────────────
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const { lyric, songTitle, artist, userId } = body as {
      lyric?: string;
      songTitle?: string;
      artist?: string;
      userId?: string;
    };

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

    // ── 2. Build user prompt ────────────────────────────────────────────────
    const userMessage = [
      `Lyric: "${lyric.trim()}"`,
      `Artist: ${artist?.trim() || "Unknown"}`,
      `Song: ${songTitle?.trim() || "Unknown"}`,
    ].join("\n");

    // ── 3. Call Groq ────────────────────────────────────────────────────────
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "";

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      console.error("[interpret] Groq returned non-JSON:", rawText);
      return NextResponse.json(
        { error: "The AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    // ── 4. Persist to Interpretation table ─────────────────────────────────
    await prisma.interpretation.create({
      data: {
        userId: userId ?? null,
        lyric: lyric.trim(),
        songTitle: songTitle?.trim() ?? null,
        artist: artist?.trim() ?? null,
        analysis: analysis as unknown as Prisma.InputJsonValue,
      },
    });

    // ── 5. Return analysis to client ────────────────────────────────────────
    return NextResponse.json(analysis, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[/api/interpret] Unhandled error:", msg, "\n", stack);
    return NextResponse.json(
      {
        error: "interpretation_failed",
        // expose detail in dev so we can diagnose without checking server logs
        ...(process.env.NODE_ENV !== "production" && { detail: msg }),
      },
      { status: 500 }
    );
  }
}
