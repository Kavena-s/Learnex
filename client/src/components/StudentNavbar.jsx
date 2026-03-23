import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StudentNavbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: '/home', label: 'Recommendations' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/profile-setup', label: 'Profile' },
  ];

  return (
    <nav className="navbar navbar-dark navbar-expand-lg bg-dark bg-opacity-50 border-bottom border-light border-opacity-10">
      <div className="container py-2">
        <Link to="/home" className="navbar-brand text-white fw-bold mb-0">LearnEx</Link>

        <button
          className="navbar-toggler border-light"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#studentNavbar"
          aria-controls="studentNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="studentNavbar">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <li className="nav-item" key={item.to}>
                  <Link
                    to={item.to}
                    className={`nav-link ${active ? 'text-white fw-semibold' : 'text-white'}`}
                    style={active ? {} : { opacity: 0.85 }}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="d-flex align-items-center gap-3">
            <small className="text-white d-none d-md-inline" style={{ opacity: 0.85 }}>{user?.email}</small>
            <button onClick={logout} className="btn btn-outline-light btn-sm">Logout</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
