import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Welcome, {user?.name}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
          AI-powered legal document assistant for Indian lawyers and clerks
        </p>
      </div>

      <div className="mode-cards">
        <Link to="/create" className="mode-card">
          <div className="icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <h3>Create Document</h3>
          <p>
            Speak in Hindi, get a court-ready legal document in English.
            Supports police complaints, petitions, affidavits, and more.
          </p>
        </Link>

        <Link to="/understand" className="mode-card">
          <div className="icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h3>Understand Document</h3>
          <p>
            Upload a court order or legal notice. Get a plain-language
            explanation with key dates, deadlines, and next steps.
          </p>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 32 }}>
        <h2>Supported Document Types</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
          {[
            'Police Complaint / FIR',
            'Court Petition',
            'Affidavit',
            'Adjournment Application',
            'Government Request',
            'Bail Application',
            'Written Statement',
            'Legal Notice',
          ].map((type) => (
            <div key={type} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, color: 'var(--text-muted)' }}>
              {type}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
