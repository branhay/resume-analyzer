import { useRef, useState } from 'react';

const MAX_SIZE = 5 * 1024 * 1024;

export default function UploadForm({ onAnalyze, loading }) {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState('');
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  const pick = (f) => {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) return setErr('Use a PDF or DOCX file.');
    if (f.size > MAX_SIZE) return setErr('File is over 5 MB.');
    setErr('');
    setFile(f);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!file) return setErr('Choose a resume first.');
    onAnalyze(file, jd.trim());
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <form className="sheet upload" onSubmit={submit}>
      <h2>Check a resume</h2>

      <div
        className={`drop${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          hidden
          onChange={(e) => pick(e.target.files[0])}
        />
        {file ? (
          <>
            <strong>{file.name}</strong>
            <span>{Math.ceil(file.size / 1024)} KB. Tap to choose a different file.</span>
          </>
        ) : (
          <>
            <strong>Drop your resume here</strong>
            <span>or tap to choose a PDF or DOCX, up to 5 MB</span>
          </>
        )}
      </div>

      <label htmlFor="jd">
        Job description <span className="optional">(optional)</span>
      </label>
      <textarea
        id="jd"
        rows={7}
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="Paste the job posting to check your keyword match against it"
      />

      {err && <p className="form-error">{err}</p>}

      <button type="submit" className="primary" disabled={loading}>
        {loading ? 'Analyzing…' : 'Analyze resume'}
      </button>
    </form>
  );
}
