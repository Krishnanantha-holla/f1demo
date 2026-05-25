import { useState } from 'react';
import { api } from '../api';

export default function AIAnalysisPanel({ topic, context, subjectType, subjectId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (subjectType && subjectId) {
        const res = await api.aiSummary(subjectType, subjectId);
        setAnalysis(res.summary);
      } else {
        const res = await api.aiAnalyze(topic, context || '');
        setAnalysis(res.analysis);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="ai-panel card">
      <div className="card-header">
        <span className="card-title">🏎️ AI Insights</span>
        <button className="ai-generate-btn" onClick={generate} disabled={loading}>
          {loading ? 'Analyzing...' : analysis ? 'Refresh' : 'Generate Analysis'}
        </button>
      </div>
      <div className="card-body">
        {error && <p className="ai-error">{error}</p>}
        {!analysis && !loading && !error && (
          <p className="ai-placeholder">Click "Generate Analysis" for AI-powered insights on {topic || subjectId || 'this topic'}.</p>
        )}
        {analysis && <div className="ai-analysis-text">{analysis}</div>}
      </div>
    </div>
  );
}
