// debug-gemini.mjs
// Diagnoses the Gemini API call directly, outside of Next.js.
// Run with: node debug-gemini.mjs

import { readFileSync } from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- 1. Read .env.local manually ---
let apiKey;
try {
  const envFile = readFileSync(".env.local", "utf8");
  const match = envFile.match(/^GEMINI_API_KEY=(.+)$/m);
  apiKey = match?.[1]?.trim();
} catch {
  console.error("❌ Could not read .env.local");
  process.exit(1);
}

if (!apiKey || apiKey === "your_key_here") {
  console.error("❌ GEMINI_API_KEY is not set in .env.local");
  console.error("   Open .env.local and replace 'your_key_here' with your real key from:");
  console.error("   https://aistudio.google.com/apikey");
  process.exit(1);
}

console.log(`✅ API key found: ${apiKey.slice(0, 8)}${"*".repeat(apiKey.length - 8)}`);

// --- 2. Call Gemini ---
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: `You are LyricLens. Return only valid JSON with this shape: { "literal_meaning": string, "cultural_context": string or null, "wordplay": [], "rhyme_scheme": { "pattern": string, "type": string, "details": string }, "word_breakdown": [], "tags": [], "difficulty": "easy" | "medium" | "hard" }`,
  generationConfig: {
    responseMimeType: "application/json",
  },
});

const prompt = `Lyric: "I remember syrup sandwiches and crime allowances"
Artist: Kendrick Lamar
Song: HUMBLE.`;

console.log("\n📤 Calling gemini-2.0-flash...\n");

try {
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  console.log("✅ Raw response text:");
  console.log(text);
  console.log("\n✅ Parsed JSON:");
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch (err) {
  console.error("\n❌ Gemini call failed with error:");
  console.error(err);
}
