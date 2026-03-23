import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function FacultyLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/faculty/dashboard', icon: 'bi-speedometer2' },
    { name: 'Students', path: '/faculty/students', icon: 'bi-people' },
    { name: 'Datasets', path: '/faculty/datasets', icon: 'bi-collection' },
    { name: 'Questions', path: '/faculty/questions', icon: 'bi-patch-question' },
    { name: 'Assessments', path: '/faculty/assessments', icon: 'bi-journal-check' },
    { name: 'Analytics', path: '/faculty/analytics', icon: 'bi-bar-chart' }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-vh-100 bg-gradient-dark">
      <nav className="navbar navbar-expand-lg bg-dark bg-opacity-50 border-bottom border-light border-opacity-10">
        <div className="container-fluid px-4">
          <Link to="/faculty/dashboard" className="navbar-brand text-white fw-bold d-flex align-items-center gap-2">
            <span>LearnEx</span>
            <span className="badge text-bg-danger">FACULTY</span>
          </Link>

          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#facultyNav">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="facultyNav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {navItems.map((item) => (
                <li className="nav-item" key={item.path}>
                  <Link
                    to={item.path}
                    className={`nav-link ${location.pathname === item.path ? 'active text-info fw-semibold' : 'text-white'}`}
                    style={location.pathname === item.path ? {} : { opacity: 0.85 }}
                  >
                    <i className={`bi ${item.icon} me-1`}></i>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="d-flex align-items-center gap-3">
              <div className="text-end d-none d-md-block">
                <div className="text-white small fw-semibold">{user?.name || 'Faculty'}</div>
                <div className="text-white small" style={{ opacity: 0.85 }}>{user?.email}</div>
              </div>
              <button onClick={handleLogout} className="btn btn-outline-light btn-sm">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container py-4">{children}</main>
    </div>
  );
}

