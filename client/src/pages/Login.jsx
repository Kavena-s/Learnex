import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../services/firebase';
import authService from '../services/authService';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get Firebase credentials
      const firebaseUser = await signInWithGoogle();
      
      // Send to backend to get JWT token
      const backendResponse = await authService.loginWithGoogle(
        firebaseUser.email,
        firebaseUser.name,
        firebaseUser.idToken
      );

      // Update auth context with Firebase user object
      login(
        {
          role: backendResponse.role,
          email: firebaseUser.email,
          name: firebaseUser.name,
        },
        firebaseUser
      );

      // Redirect based on role
      if (backendResponse.role === 'faculty' || backendResponse.role === 'admin') {
        navigate('/faculty/dashboard');
      } else {
        // If profile doesn't exist, redirect to profile creation
        if (!backendResponse.profileExists) {
          navigate('/profile-setup');
        } else {
          navigate('/home');
        }
      }
    } catch (err) {
      console.error('Sign in failed:', err);
      setError(
        err.response?.data?.message ||
        err.message ||
        'Sign in failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-gradient-dark position-relative overflow-hidden py-4 px-3">
      <div className="container" style={{ maxWidth: '520px', zIndex: 2 }}>
        <div className="glass-effect p-4 p-md-5 animate-fade-in-up">
          <div className="text-center mb-4 mb-md-5">
            <div
              className="d-inline-flex align-items-center justify-content-center mb-3 mb-md-4 animate-float"
              style={{ width: '78px', height: '78px', background: 'var(--primary-gradient)', borderRadius: '18px' }}
            >
              <i className="bi bi-mortarboard-fill text-white" style={{ fontSize: '2rem' }}></i>
            </div>
            <h1 className="display-6 fw-bold text-white mb-2">LearnEx</h1>
            <p className="text-white mb-0" style={{ opacity: 0.9 }}>AI-Powered Student Career Recommendation</p>
          </div>

          {error && (
            <div className="alert border-0 rounded-4 mb-4" role="alert" style={{ background: 'rgba(220, 53, 69, 0.22)', color: '#ffd2d2' }}>
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="btn btn-gradient-blue w-100 py-3 mb-4 d-flex align-items-center justify-content-center gap-3"
            style={{ borderRadius: '14px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <div className="card border-0 mb-4" style={{ background: 'rgba(79, 172, 254, 0.12)', borderRadius: '14px' }}>
            <div className="card-body text-center py-3">
              <p className="text-white fw-semibold mb-1">
                <i className="bi bi-shield-check me-2"></i>
                Institutional Login Required
              </p>
              <p className="text-white small mb-0" style={{ opacity: 0.85 }}>Use your valid @bitsathy.ac.in email address</p>
            </div>
          </div>

          <div className="row g-2 text-center">
            <div className="col-4">
              <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <i className="bi bi-robot text-info"></i>
                <small className="d-block text-white mt-1">AI Powered</small>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <i className="bi bi-bullseye text-warning"></i>
                <small className="d-block text-white mt-1">Personalized</small>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <i className="bi bi-graph-up text-success"></i>
                <small className="d-block text-white mt-1">Data-Driven</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

