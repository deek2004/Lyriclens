// test-interpret.js
// Run with: node test-interpret.js
// Make sure your dev server is already running: npm run dev

// Use PORT env var if set, otherwise default to 3000
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function testInterpret() {
  const payload = {
    lyric: "I remember syrup sandwiches and crime allowances",
    artist: "Kendrick Lamar",
    song: "HUMBLE.",
  };

  console.log(`📤 Sending request to ${BASE_URL}/api/interpret...`);
  console.log(JSON.stringify(payload, null, 2));
  console.log("---");

  try {
    const res = await fetch(`${BASE_URL}/api/interpret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ API returned error:", data);
      process.exit(1);
    }

    console.log("✅ Parsed JSON response:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ Fetch failed:", err.message);
    console.error(`   Is the dev server running on port ${PORT}?`);
    process.exit(1);
  }
}

testInterpret();
