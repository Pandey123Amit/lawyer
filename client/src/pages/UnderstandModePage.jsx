import { useState, useRef } from 'react';
import { understandApi } from '../services/api';
import toast from 'react-hot-toast';

const SECTION_LABELS = {
  about: { title: '1. What This Document Is About', className: '' },
  important_points: { title: '2. Important Points', className: '' },
  directions: { title: '3. Directions / Orders', className: '' },
  deadlines: { title: '4. Deadlines and Dates', className: 'deadlines' },
  next_steps: { title: '5. Next Procedural Steps', className: 'steps' },
  disclaimer: { title: '6. Disclaimer', className: 'disclaimer' },
};

export default function UnderstandModePage() {
  const [inputMode, setInputMode] = useState('upload'); // 'upload' or 'text'
  const [file, setFile] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [language, setLanguage] = useState('english');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      let res;
      if (inputMode === 'upload') {
        if (!file) { toast.error('Please select a file'); return; }
        const formData = new FormData();
        formData.append('document', file);
        formData.append('language', language);
        res = await understandApi.upload(formData);
      } else {
        if (textInput.trim().length < 20) { toast.error('Please enter more text'); return; }
        res = await understandApi.explainText({ text: textInput, language });
      }
      setResult(res.data);
      toast.success('Analysis complete');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    if (!result?.explanation) return;
    try {
      const res = await understandApi.export({ explanation: result.explanation, format });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `explanation.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Understand Legal Document</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        Upload a court order, legal notice, or any legal document to get a plain-language explanation.
      </p>

      {!result ? (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className={`btn ${inputMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setInputMode('upload')}>Upload File</button>
            <button className={`btn ${inputMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setInputMode('text')}>Paste Text</button>
          </div>

          <div className="form-group">
            <label>Explanation Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
            </select>
          </div>

          {inputMode === 'upload' ? (
            <div
              className={`upload-zone ${file ? 'active' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.tiff"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files[0])}
              />
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {file ? (
                <p style={{ color: 'var(--text)', fontWeight: 500, marginTop: 8 }}>
                  {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </p>
              ) : (
                <>
                  <p><strong>Click or drag a file here</strong></p>
                  <p>Supports PDF, PNG, JPG, TIFF (max 15 MB)</p>
                </>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label>Paste document text</label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={10}
                placeholder="Paste the text of the legal document here..."
              />
            </div>
          )}

          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 16 }}
            onClick={handleAnalyze} disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Analyzing document...
              </span>
            ) : 'Analyze Document'}
          </button>
        </div>
      ) : (
        <div>
          {/* Structured explanation sections */}
          {result.sections && Object.entries(SECTION_LABELS).map(([key, config]) => (
            result.sections[key] ? (
              <div key={key} className={`explanation-section ${config.className}`}>
                <h3>{config.title}</h3>
                <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {result.sections[key]}
                </div>
              </div>
            ) : null
          ))}

          {/* Fallback: raw explanation if sections failed to parse */}
          {!result.sections && (
            <div className="card">
              <div className="draft-preview">{result.explanation}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => handleExport('pdf')}>
              Download as PDF
            </button>
            <button className="btn btn-secondary" onClick={() => handleExport('docx')}>
              Download as DOCX
            </button>
            <button className="btn btn-secondary" onClick={() => { setResult(null); setFile(null); setTextInput(''); }}>
              Analyze Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
