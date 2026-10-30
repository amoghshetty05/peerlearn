// Campus-local (IST, UTC+05:30, no DST) helpers for weekly availability slots.
const IST_OFFSET_MIN = 330;

// Returns { isoWeekday: 1..7, minutes: minutes since local midnight } for a Date.
function localParts(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MIN * 60_000);
  const dow = shifted.getUTCDay(); // 0 = Sunday
  return { isoWeekday: dow === 0 ? 7 : dow, minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

function hhmmToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}

// Next upcoming Date (strictly after `from`) at which a weekly slot starts.
function nextOccurrences(slot, from, count = 2) {
  const startMin = hhmmToMinutes(slot.start_time ?? slot.startTime);
  const { isoWeekday, minutes } = localParts(from);
  let daysAhead = (slot.weekday - isoWeekday + 7) % 7;
  if (daysAhead === 0 && startMin <= minutes) daysAhead = 7;
  const shifted = new Date(from.getTime() + IST_OFFSET_MIN * 60_000);
  const base = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const out = [];
  for (let i = 0; i < count; i++) {
    const localMs = base + (daysAhead + 7 * i) * 86_400_000 + startMin * 60_000;
    out.push(new Date(localMs - IST_OFFSET_MIN * 60_000));
  }
  return out;
}

// ISO string with the +05:30 offset, matching the SAD API example.
function toIst(date) {
  const s = new Date(date.getTime() + IST_OFFSET_MIN * 60_000).toISOString();
  return s.replace('Z', '+05:30').replace(/\.\d{3}/, '');
}

module.exports = { localParts, hhmmToMinutes, nextOccurrences, toIst };
