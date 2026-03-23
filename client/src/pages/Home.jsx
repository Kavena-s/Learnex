import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import axios from 'axios';
import StudentNavbar from '../components/StudentNavbar';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    const token = authService.getToken();

    try {
      const res = await axios.get('http://localhost:5000/api/recommend', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecommendations(res.data.recommendations || []);
    } catch (err) {
      if (err.response?.status === 404) {
        try {
          const profileRes = await axios.get('http://localhost:5000/api/profile', {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (!profileRes.data?.profileComplete) {
            navigate('/profile-setup');
            return;
          }

          // Profile exists, so generate fresh recommendations if none are stored.
          await axios.post('http://localhost:5000/api/recommend', {}, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const refreshed = await axios.get('http://localhost:5000/api/recommend', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setRecommendations(refreshed.data.recommendations || []);
        } catch (fallbackErr) {
          if (fallbackErr.response?.status === 404 && fallbackErr.config?.url?.includes('/api/profile')) {
            navigate('/profile-setup');
            return;
          }

          setError(
            fallbackErr.response?.data?.message ||
            'Unable to load recommendations right now.'
          );
          console.error('Recommendation fallback error:', fallbackErr.response?.data || fallbackErr.message);
        }
      } else {
        setError('Failed to load recommendations');
        console.error('Load error:', err.response?.data || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (recId) => {
    try {
      const token = authService.getToken();
      await axios.put(`http://localhost:5000/api/recommend/${recId}/select`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to accept recommendation');
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-gradient-dark d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-gradient mx-auto mb-3"></div>
          <p className="text-light fs-5 fw-semibold">Analyzing Your Profile...</p>
          <p className="text-white small" style={{ opacity: 0.85 }}>Finding the best career matches for you</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-gradient-dark pb-5">
      <StudentNavbar />
      <div className="container pt-4">
        <div className="text-center mb-5 animate-fade-in-up">
          <h1 className="display-4 fw-bold text-white mb-3">Career Recommendations</h1>
          <p className="mb-2">
            <span className="badge badge-gradient px-3 py-2">Showing Top Match</span>
          </p>
          <p className="text-white fs-5 mx-auto" style={{ maxWidth: '680px', opacity: 0.9 }}>
            Discover career paths perfectly matched to your skills and interests
          </p>
        </div>

        {error && (
          <div
            className="alert border-0 rounded-4 mb-4 mx-auto"
            style={{ maxWidth: '700px', background: 'rgba(220, 53, 69, 0.22)', color: '#ffd2d2' }}
          >
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <div className="row g-4">
          {recommendations.slice(0, 2).map((rec, idx) => (
            <div key={rec._id} className="col-12 col-md-6 col-lg-4">
              <div className="card-modern h-100 p-4 position-relative animate-fade-in-up">
                {idx === 0 && (
                  <span className="badge badge-gradient position-absolute" style={{ top: '16px', right: '16px' }}>
                    Top Match
                  </span>
                )}

                <div className="d-flex flex-column h-100">
                  <h2 className="h3 fw-bold text-dark mb-3 pe-5">{rec.roleName}</h2>

                  <div className="mb-4">
                    <div className="d-flex align-items-end gap-2 mb-2">
                      <span className="display-5 fw-bold gradient-text">{rec.matchPercentage}%</span>
                      <span className="text-muted small pb-2">Match</span>
                    </div>
                    <div className="progress" style={{ height: '10px', borderRadius: '12px' }}>
                      <div
                        className="progress-bar progress-gradient"
                        role="progressbar"
                        style={{ width: `${rec.matchPercentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <p className="text-muted mb-4" style={{ minHeight: '72px' }}>{rec.explanation}</p>

                  <div className="mb-4 p-3 rounded" style={{ background: '#fff4f4', border: '1px solid #ffd8d8' }}>
                    <h3 className="h6 fw-semibold text-danger mb-2">
                      <i className="bi bi-book me-2"></i>
                      Skills to Master
                    </h3>
                    <div className="d-flex flex-wrap gap-2">
                      {rec.missingSkills.length > 0 ? (
                        rec.missingSkills.slice(0, 3).map((skill) => (
                          <span key={skill} className="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-success small fw-semibold">All skills aligned</span>
                      )}
                    </div>
                  </div>

                  <button onClick={() => handleAccept(rec._id)} className="btn btn-gradient w-100 mt-auto">
                    Choose This Path
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {recommendations.length === 0 && !loading && !error && (
          <div className="text-center py-5 animate-fade-in-up">
            <p className="display-6 mb-3 text-white">No recommendations found</p>
            <p className="text-white mb-4" style={{ opacity: 0.9 }}>Complete your profile to get personalized career recommendations</p>
            <button onClick={() => navigate('/profile-setup')} className="btn btn-gradient px-4">
              Complete Your Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

