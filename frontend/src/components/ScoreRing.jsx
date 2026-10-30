// The match score as a ring: the highlighter-yellow arc is the score out of 100.
export default function ScoreRing({ score, size = 84 }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`Match score ${score} out of 100`}>
      <svg viewBox="0 0 80 80" width={size} height={size}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--mark)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 40 40)" />
      </svg>
      <div className="ring-num"><strong>{Math.round(score)}</strong><span>of 100</span></div>
    </div>
  );
}
