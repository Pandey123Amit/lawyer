import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <header className="header">
      <Link to="/" style={{ textDecoration: 'none', color: 'white' }}>
        <h1>Nyay<span>Mitra</span></h1>
      </Link>
      {user && (
        <nav>
          <Link to="/create" className={isActive('/create')}>Create</Link>
          <Link to="/understand" className={isActive('/understand')}>Understand</Link>
          <Link to="/history" className={isActive('/history')}>History</Link>
          <button onClick={logout}>Logout</button>
        </nav>
      )}
    </header>
  );
}
