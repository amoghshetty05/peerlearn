const { localParts, nextOccurrences, toIst, hhmmToMinutes } = require('../../src/utils/time');

test('localParts converts to IST ISO weekday and minutes', () => {
  // 2026-11-02 is a Monday; 10:30 UTC = 16:00 IST
  expect(localParts(new Date('2026-11-02T10:30:00Z'))).toEqual({ isoWeekday: 1, minutes: 960 });
  // Sunday 20:00 UTC = Monday 01:30 IST
  expect(localParts(new Date('2026-11-01T20:00:00Z'))).toEqual({ isoWeekday: 1, minutes: 90 });
});
test('toIst formats with +05:30 like the SAD example', () => {
  expect(toIst(new Date('2026-11-02T10:30:00Z'))).toBe('2026-11-02T16:00:00+05:30');
});
test('nextOccurrences returns the next two weekly starts after a moment', () => {
  const from = new Date('2026-11-02T11:00:00Z'); // Mon 16:30 IST
  const out = nextOccurrences({ weekday: 1, start_time: '16:00' }, from, 2).map(toIst);
  expect(out).toEqual(['2026-11-09T16:00:00+05:30', '2026-11-16T16:00:00+05:30']);
  const sameDay = nextOccurrences({ weekday: 1, start_time: '17:00' }, from, 1).map(toIst);
  expect(sameDay).toEqual(['2026-11-02T17:00:00+05:30']);
});
test('hhmmToMinutes', () => { expect(hhmmToMinutes('16:30')).toBe(990); });
