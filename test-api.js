#!/usr/bin/env node
/**
 * test-api.js — LyricLens /api/interpret integration test
 *
 * Usage:
 *   node test-api.js              # auto-starts dev server if port 3000 is free
 *   node test-api.js --no-server  # assumes server is already running
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — one or more tests failed
 */

"use strict";

const { spawn } = require("child_process");
const http = require("http");

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/interpret`;
const SERVER_READY_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
const NO_SERVER_FLAG = process.argv.includes("--no-server");

// ─── ANSI colours ─────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// ─── Test payloads ────────────────────────────────────────────────────────────

const TEST_CASES = [
  {
    name: "Kendrick — Not Like Us",
    payload: {
      lyric: "They not like us, they not like us",
      song: "Not Like Us",
      artist: "Kendrick Lamar",
    },
  },
  {
    name: "Eminem — Fall",
    payload: {
      lyric: "I'm making a list, checking it twice",
      song: "Fall",
      artist: "Eminem",
    },
  },
  {
    name: "Bob Marley — I Shot The Sheriff",
    payload: {
      lyric: "I shot the sheriff, but I did not shoot the deputy",
      song: "I Shot The Sheriff",
      artist: "Bob Marley",
    },
  },
  {
    name: "No optional fields",
    payload: {
      lyric: "To be or not to be, that is the question",
    },
  },
  {
    name: "400 validation — empty lyric (expects error)",
    payload: { lyric: "   ", song: "Test", artist: "Test" },
    expectStatus: 400,
  },
  {
    name: "400 validation — missing lyric field (expects error)",
    payload: { song: "Test", artist: "Test" },
    expectStatus: 400,
  },
];

// ─── Expected shape for a successful (200) response ───────────────────────────

const REQUIRED_STRING_KEYS = ["literalMeaning", "craftSummary"];

function validateShape(body) {
  const errors = [];

  for (const key of REQUIRED_STRING_KEYS) {
    if (typeof body[key] !== "string" || body[key].trim().length < 20) {
      errors.push(`"${key}" is missing or too short (got: ${JSON.stringify(body[key]?.slice?.(0, 60))})`);
    }
  }

  // rhymeScheme is an object { pattern: string, type: string, details: string }
  if (!body.rhymeScheme || typeof body.rhymeScheme !== "object") {
    errors.push(`"rhymeScheme" must be an object`);
  } else {
    if (typeof body.rhymeScheme.pattern !== "string" || body.rhymeScheme.pattern.trim().length < 20) {
      errors.push(`"rhymeScheme.pattern" is missing or too short`);
    }
    if (typeof body.rhymeScheme.type !== "string") {
      errors.push(`"rhymeScheme.type" is missing`);
    }
  }

  if (!Array.isArray(body.wordplay)) {
    errors.push(`"wordplay" must be an array`);
  }

  return errors;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPortBound(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

function waitForServer(timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = async () => {
      if (await isPortBound(3000)) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("Server did not start in time"));
      setTimeout(poll, 800);
    };
    poll();
  });
}

async function postInterpret(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const status = res.status;
    const headers = Object.fromEntries(res.headers.entries());
    let body;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }

    return { status, headers, body };
  } finally {
    clearTimeout(timer);
  }
}

function printSeparator(char = "─", len = 64) {
  console.log(c.dim + char.repeat(len) + c.reset);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let devServer = null;
  let passed = 0;
  let failed = 0;

  console.log(`\n${c.bold}${c.cyan}LyricLens API Integration Tests${c.reset}`);
  console.log(`${c.dim}Endpoint: ${ENDPOINT}${c.reset}\n`);

  // ── Start dev server if needed ─────────────────────────────────────────────
  const alreadyRunning = await isPortBound(3000);

  if (alreadyRunning) {
    console.log(`${c.green}✓${c.reset} Server already running on port 3000\n`);
  } else if (NO_SERVER_FLAG) {
    console.error(`${c.red}✗ --no-server flag set but nothing is listening on port 3000${c.reset}`);
    process.exit(1);
  } else {
    console.log(`${c.yellow}⟳${c.reset} Starting dev server (this may take ~30s)…\n`);
    devServer = spawn("npm", ["run", "dev"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    // Stream server output with dim prefix so it doesn't drown test output
    devServer.stdout.on("data", (d) =>
      process.stdout.write(c.dim + "[server] " + d.toString() + c.reset)
    );
    devServer.stderr.on("data", (d) =>
      process.stderr.write(c.dim + "[server:err] " + d.toString() + c.reset)
    );

    try {
      await waitForServer(SERVER_READY_TIMEOUT_MS);
      console.log(`\n${c.green}✓${c.reset} Dev server ready\n`);
    } catch (err) {
      console.error(`${c.red}✗ ${err.message}${c.reset}`);
      devServer.kill();
      process.exit(1);
    }
  }

  // ── Run tests ──────────────────────────────────────────────────────────────
  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    const expectStatus = tc.expectStatus ?? 200;

    printSeparator();
    console.log(`${c.bold}Test ${i + 1}/${TEST_CASES.length}: ${tc.name}${c.reset}`);
    console.log(`${c.dim}Payload: ${JSON.stringify(tc.payload)}${c.reset}`);

    let result;
    try {
      result = await postInterpret(tc.payload);
    } catch (err) {
      console.log(`${c.red}✗ FAIL — network error: ${err.message}${c.reset}\n`);
      failed++;
      continue;
    }

    console.log(`\n  HTTP Status : ${result.status}`);
    console.log(`  Content-Type: ${result.headers["content-type"] ?? "(none)"}`);

    // ── Status check ────────────────────────────────────────────────────────
    if (result.status !== expectStatus) {
      console.log(`${c.red}  ✗ FAIL — expected status ${expectStatus}, got ${result.status}${c.reset}`);
      console.log(`  Response body:\n${JSON.stringify(result.body, null, 4)
        .split("\n").map((l) => "    " + l).join("\n")}`);
      failed++;
      continue;
    }

    // ── For 200 responses: validate shape ───────────────────────────────────
    if (expectStatus === 200) {
      const shapeErrors = validateShape(result.body);

      if (shapeErrors.length > 0) {
        console.log(`${c.red}  ✗ FAIL — response shape invalid:${c.reset}`);
        shapeErrors.forEach((e) => console.log(`    • ${e}`));
        console.log(`\n  Full response:\n${JSON.stringify(result.body, null, 4)
          .split("\n").map((l) => "    " + l).join("\n")}`);
        failed++;
        continue;
      }

      // Print a clean excerpt of the successful analysis
      console.log(`\n  ${c.green}✓ PASS${c.reset}`);
      console.log(`  ${c.dim}literalMeaning (excerpt): ${result.body.literalMeaning?.slice(0, 120)}…${c.reset}`);
      if (result.body.wordplay?.length > 0) {
        console.log(`  ${c.dim}wordplay[0]: "${result.body.wordplay[0].phrase}" → ${result.body.wordplay[0].explanation?.slice(0, 80)}…${c.reset}`);
      }
    } else {
      // Error case: just confirm we got the expected status
      console.log(`  ${c.green}✓ PASS${c.reset} — correctly returned ${expectStatus}`);
      console.log(`  ${c.dim}error: ${JSON.stringify(result.body?.error)}${c.reset}`);
    }

    passed++;
    console.log();
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  printSeparator("═");
  const total = passed + failed;
  if (failed === 0) {
    console.log(`${c.bold}${c.green}All ${total} tests passed ✓${c.reset}\n`);
  } else {
    console.log(`${c.bold}${c.red}${failed} of ${total} tests FAILED ✗${c.reset}\n`);
  }

  // ── Tear down ──────────────────────────────────────────────────────────────
  if (devServer) {
    devServer.kill();
    console.log(`${c.dim}Dev server stopped.${c.reset}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${c.red}Unhandled error: ${err.message}${c.reset}`);
  process.exit(1);
});
