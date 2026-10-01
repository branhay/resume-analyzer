import ScoreRing from './ScoreRing';

function Section({ title, children }) {
  return (
    <section className="block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export default function ResultView({ data }) {
  const {
    filename, atsScore, ruleScore, llmScore, llmUsed, summary, createdAt,
    checks = [], strengths = [], weaknesses = [], suggestions = [],
    matchedKeywords = [], missingKeywords = [], rewrittenBullets = [],
  } = data;

  return (
    <article className="sheet result">
      <header className="result-head">
        <ScoreRing score={atsScore} />
        <div className="result-meta">
          <h2>{filename}</h2>
          <p className="muted">Checked {new Date(createdAt).toLocaleString()}</p>
          <p className="breakdown">
            Format checks {ruleScore}/100
            {llmUsed && <>, AI review {llmScore}/100</>}
          </p>
          {!llmUsed && (
            <p className="note">The AI review was unavailable, so this score uses format checks only.</p>
          )}
        </div>
      </header>

      {summary && <p className="summary">{summary}</p>}

      {suggestions.length > 0 && (
        <Section title="What to fix">
          <ol className="fixes">
            {suggestions.map((s, i) => (
              <li key={i}>
                {s.section && <span className="tag">{s.section}</span>}
                <p className="issue">{s.issue}</p>
                <p className="fix">{s.fix}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {rewrittenBullets.length > 0 && (
        <Section title="Stronger bullet points">
          <ul className="rewrites">
            {rewrittenBullets.map((b, i) => (
              <li key={i}>
                <p className="before"><span>Before</span>{b.original}</p>
                <p className="after"><span>After</span>{b.improved}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(missingKeywords.length > 0 || matchedKeywords.length > 0) && (
        <Section title="Keywords">
          {missingKeywords.length > 0 && (
            <>
              <p className="muted">Missing from your resume. Add the ones that truly apply to you.</p>
              <ul className="chips">
                {missingKeywords.map((k) => <li key={k} className="chip missing">{k}</li>)}
              </ul>
            </>
          )}
          {matchedKeywords.length > 0 && (
            <>
              <p className="muted">Already present</p>
              <ul className="chips">
                {matchedKeywords.map((k) => <li key={k} className="chip found">{k}</li>)}
              </ul>
            </>
          )}
        </Section>
      )}

      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="two-col">
          {strengths.length > 0 && (
            <Section title="Strengths">
              <ul className="plain">{strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </Section>
          )}
          {weaknesses.length > 0 && (
            <Section title="Weaknesses">
              <ul className="plain">{weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </Section>
          )}
        </div>
      )}

      <Section title="Format checks">
        <ul className="checks">
          {checks.map((c) => (
            <li key={c.name} className={c.passed ? 'pass' : 'fail'}>
              <span className="mark" aria-hidden="true">{c.passed ? '✓' : '✗'}</span>
              <span>
                <strong>{c.name}</strong>
                <span className="sr-only">{c.passed ? ' passed' : ' failed'}</span>
                {c.detail && <small>{c.detail}</small>}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </article>
  );
}
