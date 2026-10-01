import { useEffect, useState } from 'react';
import UploadForm from './components/UploadForm';
import ResultView from './components/ResultView';
import History from './components/History';
import { analyzeResume, getHistory, getAnalysis, deleteAnalysis } from './api';

export default function App() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    try {
      setHistory(await getHistory());
    } catch {
      /* backend may be offline; the analyze call will show the error */
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleAnalyze = async (file, jd) => {
    setLoading(true);
    setError('');
    try {
      setResult(await analyzeResume(file, jd));
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async (id) => {
    setError('');
    try {
      setResult(await getAnalysis(id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAnalysis(id);
      if (result?._id === id) setResult(null);
      loadHistory();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Resume Analyzer</h1>
        <p>Upload a resume to get an ATS score and specific fixes.</p>
      </header>

      <main className="layout">
        <div className="side">
          <UploadForm onAnalyze={handleAnalyze} loading={loading} />
          <History items={history} onOpen={handleOpen} onDelete={handleDelete} activeId={result?._id} />
        </div>

        <div className="main">
          {error && <p className="banner-error" role="alert">{error}</p>}

          {loading && (
            <div className="sheet placeholder" aria-live="polite">
              <h2>Reviewing your resume</h2>
              <p>Reading the file and running the review. This takes 10 to 20 seconds.</p>
            </div>
          )}

          {!loading && result && <ResultView key={result._id} data={result} />}

          {!loading && !result && (
            <div className="sheet placeholder">
              <h2>No resume checked yet</h2>
              <p>Upload a PDF or DOCX to see your score. Add a job description to find the keywords you're missing.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
