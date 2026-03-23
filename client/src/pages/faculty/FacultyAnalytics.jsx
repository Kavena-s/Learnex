import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';

function MetricCard({ label, value }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card-modern p-3 h-100">
        <small className="text-muted">{label}</small>
        <div className="h3 mb-0">{value}</div>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, color = '#0d6efd' }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between mb-1">
        <span>{label}</span>
        <strong>{safe}%</strong>
      </div>
      <div className="progress" style={{ height: '10px' }}>
        <div className="progress-bar" style={{ width: `${safe}%`, backgroundColor: color }}></div>
      </div>
    </div>
  );
}

export default function FacultyAnalytics() {
  useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();

    const intervalId = setInterval(() => {
      fetchAnalytics();
    }, 30000);

    const handleFocus = () => fetchAnalytics();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = authService.getToken();
      const res = await axios.get('http://localhost:5000/api/faculty/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const topRoles = useMemo(
    () => (analytics?.domainPopularity?.topRoles || []).slice(0, 6),
    [analytics]
  );

  const missingSkills = useMemo(
    () => (analytics?.skillGaps?.topMissingSkills || []).slice(0, 8),
    [analytics]
  );

  if (loading) {
    return (
      <FacultyLayout>
        <div className="d-flex justify-content-center p-5">
          <div className="spinner-gradient"></div>
        </div>
      </FacultyLayout>
    );
  }

  const engagement = analytics?.engagement || {};
  const readiness = analytics?.readiness || {};
  const assessments = analytics?.assessments || {};

  return (
    <FacultyLayout>
      <h2 className="text-white fw-bold mb-3">Platform Analytics</h2>

      <div className="row g-3 mb-3">
        <MetricCard label="Students" value={engagement.totalStudents || 0} />
        <MetricCard label="Profiles" value={engagement.studentsWithProfiles || 0} />
        <MetricCard label="Selected Roles" value={engagement.studentsWithSelectedRole || 0} />
        <MetricCard label="Assessment Attempts" value={assessments.totalAttempts || 0} />
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Student Progress Rates</h5>
            <ProgressRow label="Profile Completion" value={engagement.profileCompletionRate} color="#198754" />
            <ProgressRow label="Role Selection" value={engagement.roleSelectionRate} color="#0d6efd" />
            <ProgressRow label="Assessment Participation" value={engagement.assessmentParticipationRate} color="#fd7e14" />
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Readiness Distribution</h5>
            <div className="d-flex flex-column gap-2">
              <div className="d-flex justify-content-between"><span>Excellent</span><strong>{readiness.distribution?.excellent || 0}</strong></div>
              <div className="d-flex justify-content-between"><span>Good</span><strong>{readiness.distribution?.good || 0}</strong></div>
              <div className="d-flex justify-content-between"><span>Moderate</span><strong>{readiness.distribution?.moderate || 0}</strong></div>
              <div className="d-flex justify-content-between"><span>Low</span><strong>{readiness.distribution?.low || 0}</strong></div>
            </div>
            <hr />
            <p className="mb-0 text-muted">Average Readiness: <strong>{readiness.averageReadiness || 0}%</strong></p>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Assessment Performance</h5>
            <ProgressRow label="Pass Rate" value={assessments.passRate} color="#20c997" />
            <p className="mb-2 text-muted">Average Score: <strong>{assessments.averageScore || 0}%</strong></p>
            <p className="mb-0 text-muted">Passed: <strong>{assessments.passed || 0}</strong> | Failed: <strong>{assessments.failed || 0}</strong></p>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Top Career Paths</h5>
            {!topRoles.length ? (
              <p className="text-muted mb-0">No role selections yet.</p>
            ) : (
              topRoles.map((role) => (
                <div key={role._id} className="d-flex justify-content-between border-bottom py-2">
                  <span>{role.roleName}</span>
                  <span className="badge text-bg-primary">{role.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12">
          <div className="card-modern p-3">
            <h5 className="mb-3">Top Missing Skills (Gap Trend)</h5>
            {!missingSkills.length ? (
              <p className="text-muted mb-0">No skill gap data yet.</p>
            ) : (
              <div className="row g-2">
                {missingSkills.map((skill) => (
                  <div className="col-12 col-md-6 col-lg-4" key={skill.skillName}>
                    <div className="border rounded p-2 d-flex justify-content-between">
                      <span>{skill.skillName}</span>
                      <strong>{skill.count}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </FacultyLayout>
  );
}

