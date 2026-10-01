export default function ScoreRing({ score }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  const tone = score >= 75 ? 'good' : score >= 50 ? 'fair' : 'poor';
  const label = score >= 75 ? 'Strong' : score >= 50 ? 'Needs work' : 'Weak';

  return (
    <div className={`stamp ${tone}`} role="img" aria-label={`ATS score ${score} out of 100, ${label}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="58" className="outer" />
        <circle cx="60" cy="60" r={r} className="track" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="arc"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="stamp-text">
        <span className="num">{score}</span>
        <span className="lbl">{label}</span>
      </div>
    </div>
  );
}
