export default function History({ items, onOpen, onDelete, activeId }) {
  return (
    <section className="sheet history">
      <h2>Past checks</h2>
      {items.length === 0 ? (
        <p className="muted">Resumes you analyze will show up here.</p>
      ) : (
        <ul>
          {items.map((it) => (
            <li key={it._id} className={it._id === activeId ? 'active' : ''}>
              <button type="button" className="hist-open" onClick={() => onOpen(it._id)}>
                <span className="hist-score">{it.atsScore}</span>
                <span className="hist-name">
                  {it.filename}
                  <small>{new Date(it.createdAt).toLocaleDateString()}</small>
                </span>
              </button>
              <button
                type="button"
                className="hist-del"
                aria-label={`Delete ${it.filename}`}
                onClick={() => onDelete(it._id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
