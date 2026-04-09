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

function aggregateByName(items, keyField = 'name', valueField = 'count') {
  const map = new Map();

  (items || []).forEach((item) => {
    const key = String(item?.[keyField] || '').trim();
    if (!key) return;

    const normalized = key.toLowerCase();
    const existing = map.get(normalized) || {
      [keyField]: key,
      [valueField]: 0,
      affectedStudents: 0,
    };

    existing[valueField] += Number(item?.[valueField]) || 0;
    existing.affectedStudents += Number(item?.affectedStudents) || 0;

    if (!map.has(normalized)) {
      existing[keyField] = key;
    }

    map.set(normalized, existing);
  });

  return Array.from(map.values()).sort((a, b) => b[valueField] - a[valueField]);
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
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchAnalytics();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  const data = useMemo(() => {
    const engagement = analytics?.engagement || {};
    const readiness = analytics?.readiness || {};
    const assessments = analytics?.assessments || {};
    const skillGaps = analytics?.skillGaps || {};
    const domainPopularity = analytics?.domainPopularity || {};

    const topRoles = aggregateByName(domainPopularity.topRoles || [], 'roleName', 'count').slice(0, 8);
    const missingSkills = aggregateByName(skillGaps.topMissingSkills || [], 'skillName', 'count').slice(0, 10);
    const topDomains = aggregateByName(domainPopularity.byDomain || [], '_id', 'count').slice(0, 6);

    const readinessDistribution = readiness.distribution || {
      excellent: 0,
      good: 0,
      moderate: 0,
      low: 0,
    };

    return {
      engagement,
      readiness,
      assessments,
      skillGaps,
      topRoles,
      missingSkills,
      topDomains,
      readinessDistribution,
    };
  }, [analytics]);

  if (loading) {
    return (
      <FacultyLayout>
        <div className="d-flex justify-content-center p-5">
          <div className="spinner-gradient"></div>
        </div>
      </FacultyLayout>
    );
  }

  return (
    <FacultyLayout>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h2 className="text-white fw-bold mb-0">Platform Analytics</h2>
        <small className="text-white" style={{ opacity: 0.85 }}>
          Generated: {analytics?.generatedAt ? new Date(analytics.generatedAt).toLocaleString() : 'now'}
        </small>
      </div>

      <div className="row g-3 mb-3">
        <MetricCard label="Average Readiness" value={`${data.readiness.averageReadiness || 0}%`} />
        <MetricCard label="Final Pass Rate" value={`${data.assessments.passRate || 0}%`} />
        <MetricCard label="Skill Gaps" value={data.skillGaps.totalSkillGaps || 0} />
        <MetricCard label="Final Attempts" value={data.assessments.totalAttempts || 0} />
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Final Assessment Performance</h5>
            <ProgressRow label="Pass Rate" value={data.assessments.passRate} color="#20c997" />
            <p className="mb-2 text-muted">Average Score: <strong>{data.assessments.averageScore || 0}%</strong></p>
            <p className="mb-2 text-muted">Passed: <strong>{data.assessments.passed || 0}</strong> | Failed: <strong>{data.assessments.failed || 0}</strong></p>
            <hr />
            <div className="d-flex flex-column gap-2">
              {Object.entries(data.assessments.byLevel || {}).map(([level, info]) => (
                <div key={level} className="d-flex justify-content-between">
                  <span className="text-capitalize">{level}</span>
                  <span className="text-muted">{info?.passed || 0}/{info?.total || 0} passed</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Readiness Distribution</h5>
            <div className="d-flex flex-column gap-2">
              <div className="d-flex justify-content-between"><span>Excellent</span><strong>{data.readinessDistribution.excellent || 0}</strong></div>
              <div className="d-flex justify-content-between"><span>Good</span><strong>{data.readinessDistribution.good || 0}</strong></div>
              <div className="d-flex justify-content-between"><span>Moderate</span><strong>{data.readinessDistribution.moderate || 0}</strong></div>
              <div className="d-flex justify-content-between"><span>Low</span><strong>{data.readinessDistribution.low || 0}</strong></div>
            </div>
            <hr />
            <p className="mb-0 text-muted">Average Readiness: <strong>{data.readiness.averageReadiness || 0}%</strong></p>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Career Domain Demand</h5>
            {!data.topDomains.length ? (
              <p className="text-muted mb-0">No domain demand data yet.</p>
            ) : (
              data.topDomains.map((domain) => (
                <div key={domain._id} className="d-flex justify-content-between border-bottom py-2">
                  <span>{domain._id}</span>
                  <span className="badge text-bg-secondary">{domain.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card-modern p-3 h-100">
            <h5 className="mb-3">Top Career Paths</h5>
            {!data.topRoles.length ? (
              <p className="text-muted mb-0">No role selections yet.</p>
            ) : (
              data.topRoles.map((role) => (
                <div key={role.roleName} className="d-flex justify-content-between border-bottom py-2">
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
            {!data.missingSkills.length ? (
              <p className="text-muted mb-0">No skill gap data yet.</p>
            ) : (
              <div className="row g-2">
                {data.missingSkills.map((skill) => (
                  <div className="col-12 col-md-6 col-lg-4" key={skill.skillName}>
                    <div className="border rounded p-2 d-flex justify-content-between">
                      <span>{skill.skillName}</span>
                      <strong>{skill.count}</strong>
                    </div>
                    <small className="text-muted">Affected students: {skill.affectedStudents || 0}</small>
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

