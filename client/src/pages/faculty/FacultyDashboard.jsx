import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';

function RateRow({ label, value, colorClass = 'bg-primary' }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between mb-1">
        <small className="text-muted">{label}</small>
        <small className="fw-semibold">{safe}%</small>
      </div>
      <div className="progress" style={{ height: '8px' }}>
        <div className={`progress-bar ${colorClass}`} style={{ width: `${safe}%` }}></div>
      </div>
    </div>
  );
}

function getRateTone(rate) {
  const safe = Math.max(0, Math.min(100, Number(rate) || 0));
  if (safe >= 80) {
    return { bar: 'bg-success', badge: 'text-bg-success', label: 'Healthy' };
  }
  if (safe >= 60) {
    return { bar: 'bg-warning', badge: 'text-bg-warning', label: 'Watchlist' };
  }
  return { bar: 'bg-danger', badge: 'text-bg-danger', label: 'At Risk' };
}

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
    }, 30000);

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
    { title: 'Career Paths', value: stats?.totalRoles || 0, icon: 'bi-diagram-3', link: '/faculty/datasets' },
    { title: 'Pending Final Requests', value: stats?.pendingAssessments?.length || 0, icon: 'bi-hourglass-split', link: '/faculty/assessments' }
  ];

  const engagement = stats?.engagement || {};
  const finalMetrics = stats?.assessments || {};
  const passRateTone = getRateTone(finalMetrics.passRate);

  return (
    <FacultyLayout>
      <div className="mb-4">
        <h2 className="text-white fw-bold mb-1">Faculty Dashboard</h2>
        <p className="text-white mb-0" style={{ opacity: 0.9 }}>Welcome back, {user?.name || 'Faculty'}</p>
        <small className="text-white" style={{ opacity: 0.85 }}>
          Auto-refresh: every 30s {isRefreshing ? '• updating...' : ''}
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

      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="mb-0">Final Assessment Snapshot</h5>
              <Link to="/faculty/analytics" className="btn btn-sm btn-outline-primary">Open Analytics</Link>
            </div>
            <RateRow label="Final Pass Rate" value={finalMetrics.passRate} colorClass={passRateTone.bar} />
            <div className="d-flex flex-wrap gap-3">
              <span className={`badge ${passRateTone.badge}`}>{passRateTone.label}</span>
              <span className="badge text-bg-success">Passed: {finalMetrics.passed || 0}</span>
              <span className="badge text-bg-danger">Failed: {finalMetrics.failed || 0}</span>
              <span className="badge text-bg-primary">Average Score: {finalMetrics.averageScore || 0}%</span>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-2">Student Engagement</h5>
            <RateRow label="Profile Completion" value={engagement.profileCompletionRate} colorClass="bg-info" />
            <RateRow label="Role Selection" value={engagement.roleSelectionRate} colorClass="bg-primary" />
            <RateRow label="Assessment Participation" value={engagement.assessmentParticipationRate} colorClass="bg-warning" />
            <div className="small text-muted">
              Profiles: {engagement.studentsWithProfiles || 0} | Selected Roles: {engagement.studentsWithSelectedRole || 0}
            </div>
          </div>
        </div>
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
                    <div><small className="text-muted">Requested: {new Date(assessment.requestedAt || assessment.createdAt).toLocaleString()}</small></div>
                  </div>
                  <span className="badge text-bg-warning">Pending</span>
                </div>
              ))}
              {!stats?.pendingAssessments?.length && (
                <div className="border rounded p-3 text-center">
                  <small className="text-muted d-block mb-2">No pending requests</small>
                  <Link to="/faculty/assessments" className="btn btn-sm btn-outline-secondary">View Assessments</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <div className="card-modern p-3">
            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <h6 className="mb-0">Quick Actions</h6>
              <div className="d-flex flex-wrap gap-2">
                <Link to="/faculty/assessments" className="btn btn-sm btn-primary">Review Final Requests</Link>
                <Link to="/faculty/questions" className="btn btn-sm btn-outline-primary">Manage Question Bank</Link>
                <Link to="/faculty/datasets?tab=roles" className="btn btn-sm btn-outline-dark">Update Career Paths</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FacultyLayout>
  );
}

