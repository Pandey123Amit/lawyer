import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', bar_council_id: '' });
  const [loading, setLoading] = useState(false);
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(form);
        toast.success('Account created successfully');
      } else {
        await login(form.email, form.password);
        toast.success('Welcome back!');
      }
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div style={{ maxWidth: 420, margin: '48px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)' }}>
          Nyay<span style={{ color: 'var(--accent)' }}>Mitra</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>AI Legal Document Assistant</p>
      </div>

      <div className="card">
        <h2>{isRegister ? 'Create Account' : 'Sign In'}</h2>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={form.name} onChange={update('name')} required placeholder="Adv. Rajesh Kumar" />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={update('email')} required placeholder="advocate@email.com" />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={update('password')} required minLength={6} placeholder="Min 6 characters" />
          </div>

          {isRegister && (
            <>
              <div className="form-group">
                <label>Phone (optional)</label>
                <input type="tel" value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" />
              </div>
              <div className="form-group">
                <label>Bar Council ID (optional)</label>
                <input type="text" value={form.bar_council_id} onChange={update('bar_council_id')} placeholder="UP/1234/2020" />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing...</>
              : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--text-muted)' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button onClick={() => setIsRegister(!isRegister)}
            style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
