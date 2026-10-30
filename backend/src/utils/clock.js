// Injectable clock so tests can "move time forward" (TC-08) without waiting.
let offsetMs = 0;
module.exports = {
  now: () => new Date(Date.now() + offsetMs),
  advance: (ms) => { offsetMs += ms; },
  reset: () => { offsetMs = 0; },
};
