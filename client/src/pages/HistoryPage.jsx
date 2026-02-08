import { useState, useEffect } from 'react';
import { documentsApi } from '../services/api';
import toast from 'react-hot-toast';

export default function HistoryPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadDocuments();
  }, [filter]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') params.mode = filter;
      const res = await documentsApi.list(params);
      setDocuments(res.data.documents);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    try {
      await documentsApi.delete(id);
      setDocuments(documents.filter(d => d.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Document History</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
        Your recent documents and explanations
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'create', 'understand'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'create' ? 'Created' : 'Explained'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /> Loading...</div>
      ) : documents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          No documents yet. Create or analyze a document to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map(doc => (
            <div key={doc.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 4,
                    background: doc.mode === 'create' ? '#eff6ff' : '#f0fdf4',
                    color: doc.mode === 'create' ? 'var(--primary)' : 'var(--success)',
                  }}>
                    {doc.mode}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {doc.document_type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <strong style={{ fontSize: 14 }}>{doc.title || 'Untitled'}</strong>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatDate(doc.created_at)}
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => handleDelete(doc.id)}
                style={{ fontSize: 12, padding: '4px 12px', color: 'var(--danger)' }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
