// TC-18: 100 concurrent users on GET /dashboard and POST /requests for 60 seconds; >= 95% under 1 second.
// Usage: BASE_URL=http://localhost:4000 node scripts/load-test.js   (seed first: npm run seed:perf)
// Each virtual user logs in once, so the per-user limit of 100 requests/minute (NFR-04) applies to each of them;
// the pacing below keeps each user at ~90 requests a minute.
const BASE = process.env.BASE_URL || 'http://localhost:4000';
const USERS = Number(process.env.USERS || 100);
const SECONDS = Number(process.env.SECONDS || 60);
const PASSWORD = 'Password123';

async function call(method, path, token, body) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  await res.arrayBuffer();
  return { ms: performance.now() - t0, status: res.status };
}

(async () => {
  const learners = Array.from({ length: USERS }, (_, i) => `perf${200 + i}@pes.edu`);
  const tokens = [];
  for (const email of learners) {
    const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
    if (!res.ok) { console.error(`login failed for ${email}: ${res.status}. Run "npm run seed:perf" first.`); process.exit(1); }
    tokens.push((await res.json()).token);
  }
  const samples = []; const end = Date.now() + SECONDS * 1000;
  const next = Date.now() + 86_400_000 * 7;
  await Promise.all(tokens.map(async (token) => {
    let i = 0;
    while (Date.now() < end) {
      samples.push(i++ % 2 === 0
        ? await call('GET', '/dashboard', token)
        : await call('POST', '/requests', token, { subject: 'maths', topic: 'load test', preferredTime: new Date(next).toISOString(), urgency: 'Normal' }));
      await new Promise((r) => setTimeout(r, 650)); // ~90 requests / minute / user
    }
  }));
  const ok = samples.filter((s) => s.status < 400);
  const fast = samples.filter((s) => s.ms < 1000 && s.status < 400);
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  const pct = (fast.length / samples.length) * 100;
  console.log(`requests=${samples.length} ok=${ok.length} p50=${sorted[Math.floor(sorted.length * 0.5)].toFixed(0)}ms p95=${sorted[Math.floor(sorted.length * 0.95)].toFixed(0)}ms`);
  console.log(`${pct.toFixed(1)}% of responses were successful and under 1 second (target: 95%) -> ${pct >= 95 ? 'PASS' : 'FAIL'}`);
  process.exit(pct >= 95 ? 0 : 1);
})();
