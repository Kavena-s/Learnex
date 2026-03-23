import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import ProfileSetup from './pages/ProfileSetup'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Assessment from './pages/Assessment'
import FacultyDashboard from './pages/faculty/FacultyDashboard'
import FacultyStudents from './pages/faculty/FacultyStudents'
import FacultyDatasets from './pages/faculty/FacultyDatasets'
import FacultyQuestionBank from './pages/faculty/FacultyQuestionBank'
import FacultyAssessments from './pages/faculty/FacultyAssessments'
import FacultyAnalytics from './pages/faculty/FacultyAnalytics'
import './index.css'

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-gradient-dark">
        <div className="text-center">
          <div className="spinner-gradient mx-auto mb-4"></div>
          <p className="text-light fs-5 fw-semibold">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user?.authenticated) {
    return <Navigate to="/login" replace />
  }

  const hasRequiredRole =
    !requiredRole ||
    user.role === requiredRole ||
    (requiredRole === 'faculty' && user.role === 'admin')

  if (!hasRequiredRole) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Temporary Faculty Dashboard Placeholder removed - now using actual faculty pages

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/profile-setup"
        element={
          <ProtectedRoute requiredRole="student">
            <ProfileSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute requiredRole="student">
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRole="student">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assessment/:assessmentId"
        element={
          <ProtectedRoute requiredRole="student">
            <Assessment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/dashboard"
        element={
          <ProtectedRoute requiredRole="faculty">
            <FacultyDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/students"
        element={
          <ProtectedRoute requiredRole="faculty">
            <FacultyStudents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/datasets"
        element={
          <ProtectedRoute requiredRole="faculty">
            <FacultyDatasets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/questions"
        element={
          <ProtectedRoute requiredRole="faculty">
            <FacultyQuestionBank />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/assessments"
        element={
          <ProtectedRoute requiredRole="faculty">
            <FacultyAssessments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/analytics"
        element={
          <ProtectedRoute requiredRole="faculty">
            <FacultyAnalytics />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/dashboard" element={<Navigate to="/faculty/dashboard" replace />} />
      <Route path="/admin/students" element={<Navigate to="/faculty/students" replace />} />
      <Route path="/admin/datasets" element={<Navigate to="/faculty/datasets" replace />} />
      <Route path="/admin/questions" element={<Navigate to="/faculty/questions" replace />} />
      <Route path="/admin/assessments" element={<Navigate to="/faculty/assessments" replace />} />
      <Route path="/admin/analytics" element={<Navigate to="/faculty/analytics" replace />} />
      <Route path="/" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

