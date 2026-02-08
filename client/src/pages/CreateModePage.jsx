import { useState } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { createApi } from '../services/api';
import toast from 'react-hot-toast';

const DOCUMENT_TYPES = [
  { value: 'police_complaint', label: 'Police Complaint / FIR Application' },
  { value: 'court_petition', label: 'Court Petition' },
  { value: 'affidavit', label: 'Affidavit / Sworn Statement' },
  { value: 'adjournment_application', label: 'Adjournment Application' },
  { value: 'government_request', label: 'Government Request Letter' },
  { value: 'bail_application', label: 'Bail Application' },
  { value: 'written_statement', label: 'Written Statement (Defense)' },
];

const STEPS = ['Record / Type', 'Review Transcript', 'Generated Draft', 'Export'];

export default function CreateModePage() {
  const [step, setStep] = useState(0);
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [documentType, setDocumentType] = useState('police_complaint');
  const [language, setLanguage] = useState('hi');
  const [textInput, setTextInput] = useState('');
  const [transcript, setTranscript] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [draft, setDraft] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editableDraft, setEditableDraft] = useState('');

  const recorder = useVoiceRecorder();

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Step 1 → 2: Transcribe audio or submit text
  const handleTranscribe = async () => {
    setLoading(true);
    try {
      if (inputMode === 'voice') {
        if (!recorder.audioBlob) {
          toast.error('Please record audio first');
          return;
        }
        const formData = new FormData();
        formData.append('audio', recorder.audioBlob, 'recording.webm');
        formData.append('language', language);

        const res = await createApi.transcribe(formData);
        setTranscript(res.data.transcript);
        setMetadata(res.data.metadata);
        setDocumentId(res.data.documentId);

        if (res.data.metadata?.document_type) {
          setDocumentType(res.data.metadata.document_type);
        }
      } else {
        setTranscript(textInput);
      }
      setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transcription failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → 3: Generate draft
  const handleGenerateDraft = async () => {
    setLoading(true);
    try {
      const res = await createApi.draft({
        documentId,
        transcript,
        metadata,
        documentType,
        outputLanguage: 'english',
      });
      setDraft(res.data.draft);
      setEditableDraft(res.data.draft);
      setDocumentId(res.data.documentId || documentId);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Draft generation failed');
    } finally {
      setLoading(false);
    }
  };

  // Export
  const handleExport = async (format) => {
    setLoading(true);
    try {
      const res = await createApi.export({
        documentId,
        draft: editableDraft,
        format,
        metadata: { title: metadata?.subject || 'Legal Document', document_type: documentType },
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Create Legal Document</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        Speak or type your description. AI generates a court-ready document.
      </p>

      {/* Progress bar */}
      <div className="steps-bar">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i < step ? 'completed' : ''} ${i === step ? 'active' : ''}`} />
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {/* STEP 0: Input */}
      {step === 0 && (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className={`btn ${inputMode === 'voice' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setInputMode('voice')}>Voice Input</button>
            <button className={`btn ${inputMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setInputMode('text')}>Text Input</button>
          </div>

          <div className="form-group">
            <label>Document Type</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Input Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
              <option value="mr">Marathi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="bn">Bengali</option>
            </select>
          </div>

          {inputMode === 'voice' ? (
            <div className="recorder">
              <button
                className={`record-btn ${recorder.isRecording ? 'recording' : ''}`}
                onClick={recorder.isRecording ? recorder.stopRecording : recorder.startRecording}
              >
                <div className="dot" />
              </button>
              <span className="duration">{formatDuration(recorder.duration)}</span>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                {recorder.isRecording
                  ? 'Recording... Tap to stop'
                  : recorder.audioBlob
                    ? 'Recording ready. Tap Send or re-record.'
                    : 'Tap to start recording'}
              </p>
              {recorder.audioBlob && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={recorder.resetRecording}>Re-record</button>
                  <button className="btn btn-primary" onClick={handleTranscribe} disabled={loading}>
                    {loading ? 'Processing...' : 'Transcribe & Continue'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Describe the matter (in Hindi or English)</label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="मेरा नाम राजेश कुमार है, मेरे पड़ोसी ने मेरी ज़मीन पर कब्ज़ा कर लिया है..."
                  rows={6}
                />
              </div>
              <button className="btn btn-primary" onClick={handleTranscribe}
                disabled={loading || textInput.trim().length < 20}>
                {loading ? 'Processing...' : 'Continue'}
              </button>
            </>
          )}
        </div>
      )}

      {/* STEP 1: Review transcript & metadata */}
      {step === 1 && (
        <div className="card">
          <h2>Review Transcript</h2>
          <div className="form-group">
            <label>Transcribed Text (editable)</label>
            <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={6} />
          </div>

          {metadata && (
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <strong>Detected Information:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                {metadata.applicant_name && <span>Applicant: {metadata.applicant_name}</span>}
                {metadata.respondent_name && <span>Respondent: {metadata.respondent_name}</span>}
                {metadata.authority && <span>Authority: {metadata.authority}</span>}
                {metadata.subject && <span>Subject: {metadata.subject}</span>}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Confirm Document Type</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" onClick={handleGenerateDraft} disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generating...</> : 'Generate Draft'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Draft preview & edit */}
      {step === 2 && (
        <div className="card">
          <h2>Generated Draft</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Review and edit the draft below. Changes are preserved in the export.
          </p>
          <textarea
            value={editableDraft}
            onChange={(e) => setEditableDraft(e.target.value)}
            style={{ width: '100%', minHeight: 400, fontFamily: "'Times New Roman', serif", fontSize: 14, lineHeight: 1.8, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={() => handleExport('docx')} disabled={loading}>
              Download DOCX
            </button>
            <button className="btn btn-secondary" onClick={() => handleExport('pdf')} disabled={loading}>
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
