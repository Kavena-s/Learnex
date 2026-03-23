import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import StudentNavbar from '../components/StudentNavbar';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [learningMaterials, setLearningMaterials] = useState(null);
  const [showLearningResources, setShowLearningResources] = useState(false);
  const [assessmentSummary, setAssessmentSummary] = useState(null);

  useEffect(() => {
    fetchDashboard();
    fetchLearningMaterials();
    fetchAssessmentSummary();
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = authService.getToken();
      const res = await axios.get('http://localhost:5000/api/recommend/readiness', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/home');
      } else {
        setError('Failed to load dashboard data');
        console.error('Dashboard error:', err.response?.data || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLearningMaterials = async () => {
    try {
      const token = authService.getToken();
      const res = await axios.get('http://localhost:5000/api/profile/learning-materials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLearningMaterials(res.data);
    } catch (err) {
      console.log('Learning materials not available:', err.response?.data?.message);
    }
  };

  const fetchAssessmentSummary = async () => {
    try {
      const token = authService.getToken();
      const res = await axios.get('http://localhost:5000/api/assessments/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssessmentSummary(res.data);
    } catch (err) {
      console.log('Assessment summary not available:', err.response?.data?.message || err.message);
    }
  };

  const levelOrder = ['beginner', 'intermediate', 'advanced'];

  const canAttemptLevel = (skillName, level) => {
    const skillSummary = assessmentSummary?.summary?.[skillName];
    if (!skillSummary) return level === 'beginner';
    if (level === 'beginner') return true;
    if (level === 'intermediate') return (skillSummary.beginner?.attempts || 0) > 0;
    return (skillSummary.intermediate?.attempts || 0) > 0;
  };

  const startAssessment = async (skillName, level) => {
    try {
      const token = authService.getToken();
      const res = await axios.post(
        'http://localhost:5000/api/assessments/start',
        { skillName, level: level || 'beginner' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/assessment/${res.data.assessmentId}?skill=${skillName}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start assessment');
      if (err.response?.data?.activeAssessmentId) {
        navigate(`/assessment/${err.response.data.activeAssessmentId}?skill=${skillName}`);
      }
    }
  };

  const requestFinalAssessment = async () => {
    if (!confirm('Are you ready to request the final assessment for your selected career path? The faculty will review your request.')) {
      return;
    }

    try {
      const token = authService.getToken();
      await axios.post(
        'http://localhost:5000/api/assessments/request-final',
        { roleId: data?.role?._id || data?.role?.roleId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Final assessment request submitted successfully! Faculty will review and schedule it.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request final assessment');
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-gradient-dark d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-gradient mx-auto mb-3"></div>
          <p className="text-light fs-5">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-vh-100 bg-gradient-dark d-flex align-items-center justify-content-center">
        <div className="alert alert-danger rounded-4 border-0">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-gradient-dark pb-5">
      <StudentNavbar />

      <main className="container py-4">
        <div className="row g-4">
          <div className="col-12 col-lg-4">
            <div className="glass-effect p-4 h-100">
              <h5 className="text-white mb-3">Target Role</h5>
              <p className="text-light mb-1 fw-semibold">{data?.role?.name}</p>
              <p className="text-white small mb-3" style={{ opacity: 0.85 }}>Min CGPA: {data?.role?.minCGPA}</p>
              <div className="card-modern text-center p-4">
                <p className="text-muted mb-1">Readiness Index</p>
                <div className="display-4 fw-bold gradient-text">{data?.readinessIndex?.overall || 0}%</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card-modern p-4 mb-4">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
                <h5 className="mb-0">Request Final Assessment</h5>
                <button
                  onClick={requestFinalAssessment}
                  className="btn btn-gradient"
                  disabled={!assessmentSummary?.finalAssessmentEligible}
                >
                  Request Assessment
                </button>
              </div>
              <p className="text-muted mb-0">
                Complete beginner, intermediate, and advanced levels for all required skills with 90+ score to unlock final assessment.
              </p>
              {!assessmentSummary?.finalAssessmentEligible && (
                <small className="text-danger d-block mt-2">
                  Final assessment locked. Complete all required levels with at least 90 score.
                </small>
              )}
            </div>

            <div className="card-modern p-4">
              <h5 className="mb-3">Skill Gap Analysis</h5>
              <div className="d-flex flex-column gap-3">
                {Object.entries(data?.skillConfidence || {}).map(([skill, info]) => (
                  <div key={skill} className="border rounded-3 p-3">
                    <div className="d-flex flex-column gap-3">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <strong>{skill}</strong>
                          <span className={`badge ${info.hasSkill ? 'text-bg-success' : 'text-bg-danger'}`}>
                            {info.hasSkill ? 'Acquired' : 'Missing'}
                          </span>
                        </div>
                        <div className="progress" style={{ height: '10px' }}>
                          <div
                            className="progress-bar"
                            style={{ width: `${info.score}%`, background: info.score >= 80 ? '#198754' : info.score >= 50 ? '#ffc107' : '#dc3545' }}
                          ></div>
                        </div>
                        <small className="text-muted">{info.score}% confidence</small>
                      </div>

                      <div className="d-flex flex-wrap gap-2">
                        {levelOrder.map((level) => {
                          const levelData = assessmentSummary?.summary?.[skill]?.[level];
                          const bestScore = levelData?.bestScore || 0;
                          const attempts = levelData?.attempts || 0;
                          const enabled = canAttemptLevel(skill, level);

                          return (
                            <button
                              key={`${skill}-${level}`}
                              onClick={() => startAssessment(skill, level)}
                              className="btn btn-gradient-blue btn-sm"
                              disabled={!enabled}
                              title={enabled ? '' : `Complete previous level before ${level}`}
                            >
                              {attempts > 0 ? `Reattempt ${level}` : `Take ${level}`}
                              {attempts > 0 ? ` (${bestScore}%)` : ''}
                            </button>
                          );
                        })}
                      </div>

                      <div className="small text-muted">
                        {(() => {
                          const levelData = assessmentSummary?.summary?.[skill];
                          const beginnerData = levelData?.beginner;
                          const intermediateData = levelData?.intermediate;
                          const advancedData = levelData?.advanced;
                          
                          return (
                            <div>
                              <div className="mb-1">
                                <strong>Best Scores:</strong> B {beginnerData?.bestScore || 0}% | I {intermediateData?.bestScore || 0}% | A {advancedData?.bestScore || 0}%
                              </div>
                              {(beginnerData?.history?.length > 0 || intermediateData?.history?.length > 0 || advancedData?.history?.length > 0) && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-primary" style={{ cursor: 'pointer' }}>
                                    View all attempts ({(beginnerData?.attempts || 0) + (intermediateData?.attempts || 0) + (advancedData?.attempts || 0)} total)
                                  </summary>
                                  <div className="mt-2 p-2 bg-light rounded">
                                    {['beginner', 'intermediate', 'advanced'].map(lvl => {
                                      const lvlData = levelData?.[lvl];
                                      if (!lvlData?.history || lvlData.history.length === 0) return null;
                                      return (
                                        <div key={lvl} className="mb-2">
                                          <strong className="text-capitalize">{lvl}:</strong>
                                          <div className="ms-3 small">
                                            {lvlData.history.map((h, idx) => (
                                              <div key={h.assessmentId} className="d-flex justify-content-between">
                                                <span>#{lvlData.history.length - idx}: {h.score}%</span>
                                                <span className="text-muted">{new Date(h.date).toLocaleDateString()}</span>
                                              </div>
                                            )).reverse()}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="card-modern p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Learning Resources</h5>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setShowLearningResources((prev) => !prev)}
                >
                  {showLearningResources ? 'Hide' : 'Show'}
                </button>
              </div>

              {learningMaterials && learningMaterials.missingSkillsCount > 0 ? (
                <>
                  <p className="text-muted">
                    You have {learningMaterials.missingSkillsCount} missing skills. Use these curated resources.
                  </p>
                  {showLearningResources && (
                    <div className="row g-3">
                      {learningMaterials.materials?.map((material, idx) => (
                        <div key={idx} className="col-12 col-md-6">
                          <div className="border rounded-3 p-3 h-100">
                            <h6>{material.skill}</h6>
                            <div className="d-flex flex-column gap-2">
                              {material.resources?.map((resource, ridx) => (
                                <a
                                  key={ridx}
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-decoration-none"
                                >
                                  {resource.type}: {resource.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted mb-0">No learning resources required right now. Great progress!</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

