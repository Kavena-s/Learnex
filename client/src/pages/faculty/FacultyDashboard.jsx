import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboardStats = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (silent) setIsRefreshing(true);

    try {
      const token = authService.getToken();
      const res = await axios.get('http://localhost:5000/api/faculty/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();

    const intervalId = setInterval(() => {
      fetchDashboardStats({ silent: true });
    }, 10000);

    const handleFocus = () => fetchDashboardStats({ silent: true });
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchDashboardStats({ silent: true });
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (loading) {
    return (
      <FacultyLayout>
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '40vh' }}>
          <div className="spinner-gradient"></div>
        </div>
      </FacultyLayout>
    );
  }

  const statCards = [
    { title: 'Total Students', value: stats?.totalStudents || 0, icon: 'bi-people', link: '/faculty/students' },
    { title: 'Question Bank', value: stats?.totalQuestions || 0, icon: 'bi-patch-question', link: '/faculty/questions' },
    { title: 'Active Assessments', value: stats?.activeAssessments || 0, icon: 'bi-journal-check', link: '/faculty/assessments' },
    { title: 'Career Paths', value: stats?.totalRoles || 0, icon: 'bi-diagram-3', link: '/faculty/datasets' }
  ];

  return (
    <FacultyLayout>
      <div className="mb-4">
        <h2 className="text-white fw-bold mb-1">Faculty Dashboard</h2>
        <p className="text-white mb-0" style={{ opacity: 0.9 }}>Welcome back, {user?.name || 'Faculty'}</p>
        <small className="text-white" style={{ opacity: 0.85 }}>
          Auto-refresh: every 10s {isRefreshing ? '• updating...' : ''}
          {lastUpdated ? ` • Last updated ${lastUpdated.toLocaleTimeString()}` : ''}
        </small>
      </div>

      <div className="row g-3 mb-4">
        {statCards.map((card) => (
          <div className="col-12 col-md-6 col-lg-3" key={card.title}>
            <Link to={card.link} className="text-decoration-none">
              <div className="card-modern p-3 h-100">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div className="text-muted small">{card.title}</div>
                    <div className="h3 mb-0 fw-bold text-dark">{card.value}</div>
                  </div>
                  <i className={`bi ${card.icon} fs-2 text-primary`}></i>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5>Recent Students</h5>
            <div className="d-flex flex-column gap-2">
              {(stats?.recentStudents || []).slice(0, 5).map((student, idx) => (
                <div key={idx} className="border rounded p-2 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">{student.name}</div>
                    <small className="text-muted">{student.email}</small>
                  </div>
                  <small className="text-muted">{new Date(student.createdAt).toLocaleDateString()}</small>
                </div>
              ))}
              {!stats?.recentStudents?.length && <small className="text-muted">No students yet</small>}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5>Pending Assessment Requests</h5>
            <div className="d-flex flex-column gap-2">
              {(stats?.pendingAssessments || []).slice(0, 5).map((assessment, idx) => (
                <div key={idx} className="border rounded p-2 d-flex justify-content-between align-items-center bg-warning-subtle">
                  <div>
                    <div className="fw-semibold">{assessment.studentName}</div>
                    <small className="text-muted">{assessment.skillName} - {assessment.level}</small>
                  </div>
                  <span className="badge text-bg-warning">Pending</span>
                </div>
              ))}
              {!stats?.pendingAssessments?.length && <small className="text-muted">No pending requests</small>}
            </div>
          </div>
        </div>
      </div>
    </FacultyLayout>
  );
}

