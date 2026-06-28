// Drive cheap async image generation for words with NO image, end to end.
//
// OpenAI caps "enqueued tokens" per org (gpt-image-2 = 1,000,000). Our prompt is
// long (~800 tok) + image tokens, so ~1000 images max can be queued at once.
// This script therefore CHUNKS the work and runs one chunk at a time: submit a
// batch → poll until completed → ingest the images → move to the next chunk.
// That way 5000+ words finish unattended without ever hitting the org limit.
//
// Usage (from backend/):
//   API=http://localhost:3000/api \
//   ID=<admin-username-or-email> PASS=<password> \
//   N=5000 CHUNK=500 \
//   node scripts/send-image-batch.mjs
//
//   N      = total words to process (default 5000)
//   CHUNK  = words per batch (default 500 → ~500k enqueued tokens, safely < 1M)

const API = process.env.API || 'http://localhost:3000/api';
const ID = process.env.ID;
const PASS = process.env.PASS;
const N = Number(process.env.N || 5000);
const CHUNK = Number(process.env.CHUNK || 500);

if (!ID || !PASS) {
  console.error('Set ID=<admin> and PASS=<password> env vars.');
  process.exit(1);
}

const j = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) Login → JWT
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: ID, password: PASS }),
});
const login = await j(loginRes);
const token = login?.accessToken || login?.token || login?.access_token;
if (!loginRes.ok || !token) {
  console.error('Login failed:', login);
  process.exit(1);
}
const auth = { Authorization: `Bearer ${token}` };
console.log('Logged in OK.');

// 2) Fetch up to N words with no image
const listRes = await fetch(`${API}/words?noImage=true&all=true&limit=${N}`, { headers: auth });
const list = await j(listRes);
const allIds = (list?.items || []).map((w) => w.id);
console.log(`Found ${allIds.length} words with no image (requested up to ${N}). Chunk size = ${CHUNK}.`);
if (allIds.length === 0) process.exit(0);

let totalSaved = 0;
let totalFailed = 0;
const chunks = Math.ceil(allIds.length / CHUNK);

// 3) Process one chunk at a time: submit → poll → ingest
for (let c = 0; c < chunks; c++) {
  const wordIds = allIds.slice(c * CHUNK, (c + 1) * CHUNK);
  console.log(`\n=== Chunk ${c + 1}/${chunks} (${wordIds.length} words) ===`);

  const subRes = await fetch(`${API}/words/image-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ wordIds }),
  });
  const sub = await j(subRes);
  if (!subRes.ok || !sub.batchId) {
    console.error('  Submit failed:', sub);
    console.error('  (If "enqueued token limit", lower CHUNK and re-run.)');
    process.exit(1);
  }
  const batchId = sub.batchId;
  console.log(`  Submitted batch ${batchId}. Polling…`);

  // Poll until the batch finishes (image batches are slow).
  let status = 'validating';
  while (!['completed', 'failed', 'expired', 'cancelled'].includes(status)) {
    await sleep(15000);
    const st = await j(await fetch(`${API}/words/image-batch/${batchId}`, { headers: auth }));
    status = st.status;
    console.log(`  ${batchId}: ${status} — ${st.completed}/${st.total} (failed ${st.failed})`);
  }
  if (status !== 'completed') {
    console.error(`  Batch ${batchId} ended as ${status}; stopping.`);
    process.exit(1);
  }

  // Ingest the finished images into their words.
  const ing = await j(await fetch(`${API}/words/image-batch/${batchId}/ingest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: '{}',
  }));
  console.log(`  Ingested: saved=${ing.saved}, failed=${ing.failed}`);
  totalSaved += ing.saved || 0;
  totalFailed += ing.failed || 0;
}

console.log(`\nDONE. Saved ${totalSaved} images, ${totalFailed} failed across ${chunks} chunk(s).`);
