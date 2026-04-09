import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import authService from '../services/authService';

export default function Assessment() {
  const { assessmentId } = useParams();
  const [searchParams] = useSearchParams();
  const skillName = searchParams.get('skill') || 'Assessment';
  const navigate = useNavigate();
  
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [answers, setAnswers] = useState([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [examComplete, setExamComplete] = useState(false);
  const [result, setResult] = useState(null);
  const [attemptHistory, setAttemptHistory] = useState([]);

  const containerRef = useRef(null);

  const handleAuthFailure = useCallback((defaultMessage = 'Session expired. Please login again.') => {
    authService.logout();
    alert(defaultMessage);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    fetchAssessment();
  }, [assessmentId]);

  const fetchAttemptHistory = async () => {
    try {
      const token = authService.getToken();
      const res = await axios.get('http://localhost:5000/api/assessments/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const skillSummary = res.data.summary?.[skillName];
      const levelHistory = skillSummary?.[assessment?.level || 'beginner']?.history || [];
      setAttemptHistory(levelHistory.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      console.error('Failed to fetch attempt history:', err);
    }
  };

  const fetchAssessment = async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        handleAuthFailure('Your session is missing or expired. Please login again.');
        return;
      }
      // To get the actual questions, we trigger active check
      const res = await axios.get(`http://localhost:5000/api/assessments/active/${encodeURIComponent(skillName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Assessment data received:', res.data);

      if (!res.data.hasActive) {
        setError(res.data.wasExpired ? 'Assessment time is over. Please start a new attempt.' : 'Assessment is no longer active or expired.');
        return;
      }

      const activeId = String(res.data.assessmentId || '');
      const currentId = String(assessmentId || '');

      // If URL points to a stale attempt, move to the currently active one.
      if (activeId && activeId !== currentId) {
        navigate(`/assessment/${activeId}?skill=${res.data.skillName || skillName}`, { replace: true });
        return;
      }

      console.log('Setting assessment with questions:', res.data.questions?.length || 0);
      setAssessment(res.data);
      setAnswers(new Array(res.data.totalQuestions).fill(-1));
    } catch (err) {
      console.error('Fetch assessment error:', err);
      if (err.response?.status === 401) {
        handleAuthFailure('Your session expired during assessment load. Please login and continue.');
        return;
      }
      setError('Failed to load assessment');
    } finally {
      setLoading(false);
    }
  };

  const submitAssessment = useCallback(async (forced = false) => {
    if (submitting || examComplete) return;
    setSubmitting(true);
    
    try {
      const token = authService.getToken();
      if (!token) {
        handleAuthFailure('Your session expired before submission. Please login again.');
        setSubmitting(false);
        return;
      }
      const res = await axios.post(`http://localhost:5000/api/assessments/${assessmentId}/submit`, {
        answers,
        forcedSubmission: forced
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setResult(res.data);
      setExamComplete(true);
      // Exit fullscreen if we are in it
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
      }
      // Fetch attempt history
      fetchAttemptHistory();
    } catch (err) {
      if (err.response?.status === 401) {
        handleAuthFailure('Your session expired during submission. Please login and retry.');
        setSubmitting(false);
        return;
      }
      alert(err.response?.data?.message || 'Failed to submit assessment');
      setSubmitting(false);
    }
  }, [assessmentId, answers, submitting, examComplete, handleAuthFailure]);

  // Tab Switch (Visibility) Detection
  useEffect(() => {
    if (examComplete || !assessment) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        try {
          const token = authService.getToken();
          if (!token) return;
          const res = await axios.post(`http://localhost:5000/api/assessments/${assessmentId}/warning`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setWarningCount(res.data.warningsCount);
          
          if (res.data.exceeded) {
            alert('SECURE EXAM VIOLATION: You have switched tabs too many times. Your exam will now be auto-submitted.');
            submitAssessment(true);
          } else {
            alert(`WARNING (${res.data.warningsCount}/${res.data.maxWarnings}): Please do not switch tabs during the exam. doing so again may result in auto-submission.`);
          }
        } catch (e) {
          console.error('Failed to log warning', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [examComplete, assessment, assessmentId, submitAssessment]);

  // Full Screen Enforcement
  const enterFullScreen = () => {
    if (containerRef.current) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullScreen(true);
      }).catch(err => {
        alert('Error attempting to enable full-screen mode: ' + err.message);
      });
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const handleOptionSelect = (qIndex, oIndex) => {
    const newAnswers = [...answers];
    newAnswers[qIndex] = oIndex;
    setAnswers(newAnswers);
  };

  const currentLevel = assessment?.level || 'beginner';
  const answeredCount = answers.filter((a) => a !== -1).length;
  const unansweredCount = Math.max(0, (assessment?.totalQuestions || 0) - answeredCount);
  const canReattemptCurrentLevel = Number(result?.score || 0) < 90;

  const handleReattempt = async () => {
    try {
      const token = authService.getToken();
      const res = await axios.post(
        'http://localhost:5000/api/assessments/start',
        { skillName, level: assessment?.level || 'beginner' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/assessment/${res.data.assessmentId}?skill=${skillName}`);
    } catch (err) {
      if (err.response?.status === 401) {
        handleAuthFailure('Your session expired. Please login again.');
        return;
      }
      const serverMessage = err.response?.data?.message;
      const serverDetails = err.response?.data?.error;
      const fallback = err.message || 'Failed to start reattempt';
      alert(serverMessage || serverDetails || fallback);
    }
  };

  if (loading) return <div className="d-flex align-items-center justify-content-center" style={{minHeight: '100vh'}}>Loading Assessment...</div>;
  if (error) return (
    <div className="d-flex align-items-center justify-content-center p-4 text-center" style={{minHeight: '100vh'}}>
      <div>
        <p className="text-danger">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary mt-4">Return to Dashboard</button>
      </div>
    </div>
  );

  if (examComplete && result) {
    return (
      <div className="d-flex align-items-center justify-content-center p-4" style={{minHeight: '100vh', backgroundColor: '#f8f9fa'}}>
        <div className="bg-white rounded shadow p-4" style={{maxWidth: '900px', width: '100%'}}>
          <h2 className="text-center mb-3 fw-bold" style={{fontSize: '2rem'}}>Assessment Complete</h2>
          <p className="text-center text-muted mb-4 text-capitalize">
            {skillName} - {assessment?.level || 'beginner'} level
          </p>
          <div className="text-center mb-4" style={{fontSize: '4rem'}}>{result.score >= 90 ? '🏆' : result.score >= 50 ? '👍' : '📚'}</div>

          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="p-3 rounded" style={{backgroundColor: '#e7f1ff'}}>
                <p className="text-muted mb-1 fw-semibold" style={{fontSize: '0.9rem'}}>Score</p>
                <p className="fw-bold text-primary mb-0" style={{fontSize: '1.8rem'}}>{result.score}%</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 rounded" style={{backgroundColor: '#d1f4e0'}}>
                <p className="text-muted mb-1 fw-semibold" style={{fontSize: '0.9rem'}}>Correct</p>
                <p className="fw-bold text-success mb-0" style={{fontSize: '1.8rem'}}>{result.correctAnswers} / {result.totalQuestions}</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 rounded" style={{backgroundColor: '#fff3cd'}}>
                <p className="text-muted mb-1 fw-semibold" style={{fontSize: '0.9rem'}}>Level Target</p>
                <p className="fw-bold text-warning mb-0" style={{fontSize: '1.8rem'}}>90%</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded mb-4 border" style={{backgroundColor: '#f8f9fa'}}>
            <h3 className="fw-bold mb-2">Level Recommendation</h3>
            <p className="mb-0" style={{fontSize: '1.1rem'}}>{result.recommendation.message}</p>
          </div>

          <div className={`p-4 rounded mb-4 border ${result.score >= 90 ? 'alert-success' : 'alert-danger'}`}>
            {result.score >= 90
              ? 'Great work! You met the 90+ target for this level. Continue with the next level from Dashboard.'
              : 'Target not met. Reattempt this level to achieve 90+ and unlock final eligibility.'}
          </div>

          {result.weakConcepts?.length > 0 && (
            <div className="mb-4">
              <p className="fw-semibold text-danger mb-2">Concepts to review:</p>
              <div className="d-flex flex-wrap gap-2">
                {result.weakConcepts.map(c => <span key={c} className="badge bg-danger">{c}</span>)}
              </div>
            </div>
          )}

          {attemptHistory.length > 0 && (
            <div className="mb-4">
              <h3 className="fw-bold mb-3">Attempt History ({attemptHistory.length} attempt{attemptHistory.length !== 1 ? 's' : ''})</h3>
              <div className="d-flex flex-column gap-2">
                {attemptHistory.map((attempt, idx) => (
                  <div key={attempt.assessmentId} className={`d-flex justify-content-between align-items-center p-3 rounded border ${
                    attempt.score >= 90 ? 'bg-success bg-opacity-10 border-success' : 
                    attempt.score >= 50 ? 'bg-info bg-opacity-10 border-info' : 
                    'bg-danger bg-opacity-10 border-danger'
                  }`}>
                    <div className="d-flex align-items-center gap-3">
                      <span className="text-muted fw-semibold" style={{fontSize: '0.9rem'}}>#{attemptHistory.length - idx}</span>
                      <span className={`fw-bold ${
                        attempt.score >= 90 ? 'text-success' : 
                        attempt.score >= 50 ? 'text-info' : 
                        'text-danger'
                      }`} style={{fontSize: '1.2rem'}}>{attempt.score}%</span>
                      {attempt.score >= 90 && <span>✅ Passed</span>}
                      {idx === 0 && <span className="badge bg-primary">Latest</span>}
                    </div>
                    <span className="text-muted" style={{fontSize: '0.9rem'}}>{new Date(attempt.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="d-flex justify-content-center gap-3 flex-wrap">
            {canReattemptCurrentLevel ? (
              <button onClick={handleReattempt} className="btn btn-success btn-lg px-4 shadow">
                Reattempt Level
              </button>
            ) : (
              <button onClick={() => navigate('/dashboard')} className="btn btn-outline-success btn-lg px-4 shadow">
                Level Cleared (90+) 
              </button>
            )}
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary btn-lg px-4 shadow">
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{minHeight: '100vh', backgroundColor: '#fff'}}>
      {!isFullScreen ? (
        <div className="d-flex align-items-center justify-content-center text-white text-center p-4" style={{minHeight: '100vh', backgroundColor: '#212529'}}>
          <div style={{maxWidth: '500px'}}>
            <h1 className="fw-bold mb-3" style={{fontSize: '2rem'}}>Secure Exam Mode</h1>
            <p className="mb-2 text-capitalize" style={{color: '#e9ecef'}}>{skillName} - {currentLevel} level</p>
            <p className="mb-4" style={{color: '#dee2e6'}}>This assessment requires full-screen mode to prevent cheating. Tab switching is monitored, and exceeding 3 warnings will result in auto-submission.</p>
            <button onClick={enterFullScreen} className="btn btn-primary btn-lg px-5 py-3 fw-bold shadow">
              Enter Full Screen to Begin
            </button>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column" style={{height: '100vh', overflow: 'hidden', backgroundColor: '#f8f9fa'}}>
          <header className="bg-white border-bottom p-3 d-flex justify-content-between align-items-center" style={{flexShrink: 0}}>
            <div>
              <h1 className="fw-bold text-capitalize mb-1" style={{fontSize: '1.3rem'}}>{skillName} - {currentLevel} Assessment</h1>
              <p className="text-muted mb-0" style={{fontSize: '0.9rem'}}>Answered {answeredCount}/{assessment.totalQuestions} | Unanswered {unansweredCount}</p>
            </div>
            
            <div className="d-flex align-items-center gap-3">
              {warningCount > 0 && (
                <div className="badge bg-danger fw-bold px-3 py-2" style={{fontSize: '0.95rem'}}>
                  Warnings: {warningCount}/3
                </div>
              )}
              <div className="fw-bold px-3 py-2 rounded border" style={{backgroundColor: '#e7f1ff', color: '#0d6efd', borderColor: '#b6d4fe'}}>
                🔒 Secure Mode Active
              </div>
              <button 
                onClick={() => submitAssessment(false)} 
                disabled={submitting}
                className="btn btn-success px-4 py-2 fw-bold shadow"
              >
                {submitting ? 'Submitting...' : 'Submit Assessment'}
              </button>
            </div>
          </header>

          <main className="flex-grow-1 overflow-auto p-4">
            <div className="mx-auto" style={{maxWidth: '900px'}}>
              {assessment?.questions && assessment.questions.length > 0 ? (
                assessment.questions.map((q, qIndex) => (
                  <div key={qIndex} className="bg-white p-4 rounded shadow-sm border mb-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <h3 className="fw-bold mb-0" style={{fontSize: '1.1rem', color: '#212529'}}>
                        <span className="text-muted me-2">{qIndex + 1}.</span> 
                        {q.questionText}
                      </h3>
                    </div>

                  <div className="d-flex flex-column gap-2">
                    {q.options.map((option, oIndex) => (
                      <label 
                        key={oIndex} 
                        className={`d-flex align-items-start p-3 rounded border ${
                          answers[qIndex] === oIndex 
                            ? 'border-primary' 
                            : 'border-secondary border-opacity-25'
                        }`}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: answers[qIndex] === oIndex ? '#e7f1ff' : '#f8f9fa',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (answers[qIndex] !== oIndex) {
                            e.currentTarget.style.backgroundColor = '#e9ecef';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (answers[qIndex] !== oIndex) {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }
                        }}
                      >
                        <input
                          type="radio"
                          name={`q${qIndex}`}
                          className="form-check-input mt-1"
                          checked={answers[qIndex] === oIndex}
                          onChange={() => handleOptionSelect(qIndex, oIndex)}
                        />
                        <span className="ms-3" style={{color: '#212529'}}>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
              ) : (
                <div className="text-center text-muted p-5">
                  <p>Loading questions...</p>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}

