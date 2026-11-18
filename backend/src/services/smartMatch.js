// FR-16 Smart Match client: builds the 8 model features for each matched Tutor and asks the
// model service (CMP-13, ml/app.py) for the chance that the session succeeds.
// If the service is not configured, slow or down, matching still works without predictions.
const config = require('../config');
const { E } = require('../errors');
const logger = require('../utils/logger');

const LEVEL = { Beginner: 0, Intermediate: 0.5, Advanced: 1 };
const URGENCY = { Low: 0, Normal: 0.5, High: 1 };
const DAY_MS = 86_400_000;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** The same 8 features, in the same 0..1 scale, as ml/smartmatch/features.py. */
function features(tutor, request, now) {
  return {
    proficiency: LEVEL[tutor.proficiency] ?? 0,
    time_fit: tutor.covers ? 1 : tutor.same_day ? 0.5 : 0,
    rating_avg: tutor.rating_count > 0 ? clamp01(Number(tutor.avg_rating) / 5) : 0,
    rating_count: Math.min(tutor.rating_count || 0, 20) / 20,
    acceptance_rate: ((tutor.accepted_count || 0) + 1) / ((tutor.answered_count || 0) + 2),
    load: Math.min(tutor.upcoming_week || 0, 10) / 10,
    urgency: URGENCY[request.urgency] ?? 0.5,
    lead_time: clamp01((new Date(request.preferred_time) - now) / DAY_MS / 14),
  };
}

/** Returns { model, modelName, probabilities } or null when predictions are unavailable. */
async function predict(rows, { fetchImpl = globalThis.fetch } = {}) {
  const { url, timeoutMs, model } = config.smartMatch;
  if (!url || rows.length === 0) return null;
  try {
    const res = await fetchImpl(`${url}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model ? { rows, model } : { rows }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`model service answered ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.probabilities) || body.probabilities.length !== rows.length) throw new Error('bad response shape');
    return body;
  } catch (err) {
    logger.warn('Smart Match unavailable; showing matches without predictions', { error: err.message });
    return null;
  }
}

/** The six models and their test scores, for the Admin's Smart Match page (GET /models of CMP-13). */
async function models({ fetchImpl = globalThis.fetch } = {}) {
  const { url, timeoutMs } = config.smartMatch;
  const down = E.unavailable('The Smart Match model service is not available right now.');
  if (!url) throw down;
  try {
    const res = await fetchImpl(`${url}/models`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`model service answered ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.models)) throw new Error('bad response shape');
    return body;
  } catch (err) {
    logger.warn('Smart Match model list unavailable', { error: err.message });
    throw down;
  }
}

module.exports = { features, predict, models };
