/**
 * Simple load-test script for Kraken Face Engine endpoints.
 *
 * Usage:
 *   node load-test-face.js
 *
 * Environment variables:
 *   FACE_SERVER_URL   - base URL, default http://localhost:8001
 *   CONCURRENCY       - parallel requests, default 4
 *   REQUESTS          - total requests, default 20
 *   TIMEOUT_MS        - per-request timeout, default 30000
 */

const BASE = process.env.FACE_SERVER_URL || "http://localhost:8001";
const CONCURRENCY = Number(process.env.CONCURRENCY || "4");
const TOTAL = Number(process.env.REQUESTS || "20");
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || "30000");

const summary = { success: 0, failed: 0, timeout: 0, retries: 0, errors: {} };

function randomJpeg() {
  const width = 640;
  const height = 480;
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#888"/><circle cx="50%" cy="50%" r="80" fill="#fff"/></svg>`;
  return Buffer.from(canvas).toString("base64");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(index) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const form = new FormData();
    const blob = new Blob([Buffer.from(randomJpeg(), "base64")], { type: "image/jpeg" });
    form.append("image", blob, `test_${index}.jpg`);

    const res = await fetch(`${BASE}/detect-faces`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (res.ok) {
      summary.success += 1;
      return true;
    }

    summary.failed += 1;
    const text = await res.text().catch(() => "");
    summary.errors[String(res.status)] = (summary.errors[String(res.status)] || 0) + 1;
    console.warn(`Request ${index}: HTTP ${res.status} ${text.slice(0, 120)}`);
    return false;
  } catch (err) {
    clearTimeout(timeout);
    summary.failed += 1;
    const name = err?.name || "Error";
    if (name === "AbortError") summary.timeout += 1;
    summary.errors[name] = (summary.errors[name] || 0) + 1;
    console.warn(`Request ${index}: ${name} ${err?.message || err}`);
    return false;
  }
}

async function worker(id) {
  while (summary.success + summary.failed < TOTAL) {
    const index = summary.success + summary.failed + 1;
    await request(index);
    await sleep(200 + Math.random() * 300);
  }
}

async function main() {
  console.log(`Load test: ${TOTAL} requests, concurrency=${CONCURRENCY}, timeout=${TIMEOUT_MS}ms`);
  const start = Date.now();
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);
  const duration = Date.now() - start;
  const rps = ((summary.success + summary.failed) / (duration / 1000)).toFixed(2);
  console.log("\n=== Load test result ===");
  console.log(JSON.stringify({ ...summary, durationMs: duration, rps }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
