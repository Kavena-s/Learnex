import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = authService.getToken();
    const role = authService.getRole();
    const tokenUser = authService.getUserFromToken();
    
    if (token && role) {
      setUser({
        role,
        email: tokenUser?.email || '',
        name: tokenUser?.name || '',
        id: tokenUser?.id || null,
        authenticated: true,
      });
    }
    
    setLoading(false);
  }, []);

  const login = (userData, firebaseUser) => {
    setUser({
      ...userData,
      firebaseUser,
      authenticated: true,
    });
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: authService.isAuthenticated(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

