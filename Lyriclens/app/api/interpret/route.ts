import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const prisma = new PrismaClient();

const SYSTEM_INSTRUCTION = `You are LyricLens, an expert music interpreter. Your job is to decode lyric lines so that any listener — regardless of background — can deeply understand what an artist is saying and how they are saying it. You will receive a lyric line, the artist name, and optionally the song title. Return ONLY a JSON object with this exact structure, no markdown fences, no preamble: { "literal_meaning": string, "cultural_context": string or null, "wordplay": array of { phrase, type, explanation } where type is pun/double_meaning/allusion/metaphor/simile, "rhyme_scheme": { pattern, type, details }, "word_breakdown": array of { word, definition, type } where type is slang/aave/cultural/standard, "tags": array of strings, "difficulty": "easy" or "medium" or "hard" }. Write literal_meaning in plain English for a curious 15-year-old with no music background. Only include cultural_context if it's essential. Never fabricate references. Return only valid JSON.`;

export async function POST(request: NextRequest) {
  console.log('ROUTE HIT');
  try {
    const body = await request.json();
    const { lyric, artist, song } = body;

    if (!lyric || lyric.trim() === "") {
      return NextResponse.json(
        { error: "Lyric line is required." },
        { status: 400 }
      );
    }

    // ─── Step 3: Session + usage limit check ────────────────────────────────
    const session = await getServerSession();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const userPlan = (session?.user as { plan?: string } | undefined)?.plan ?? 'free';

    if (userPlan === 'free') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayCount = await prisma.interpretation.count({
        where: {
          userId: userId,
          createdAt: { gte: today },
        },
      });

      console.log(`[usage] userId=${userId ?? 'anon'} plan=${userPlan} today=${todayCount}`);

      if (todayCount >= 5) {
        return NextResponse.json(
          { error: 'daily_limit_reached', limit: 5, used: todayCount },
          { status: 429 }
        );
      }
    }

    // ─── Groq call ───────────────────────────────────────────────────────────
    const prompt = `Lyric: "${lyric.trim()}"
Artist: ${artist?.trim() || "Unknown"}
Song: ${song?.trim() || "Unknown"}`;

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);

    // ─── Step 4: Save interpretation to DB ──────────────────────────────────
    await prisma.interpretation.create({
      data: {
        userId: userId,
        lyric: lyric,
        artist: artist ?? null,
        song: song ?? null,
        result: parsed,
      },
    });

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("[/api/interpret] error:", error);
    return NextResponse.json(
      { error: "interpretation_failed" },
      { status: 500 }
    );
  }
}
