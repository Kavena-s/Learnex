import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalized);
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

const authService = {
  // Google login
  loginWithGoogle: async (email, name, idToken) => {
    try {
      const response = await axios.post(`${API_URL}/auth/google`, {
        email,
        name,
        idToken,
      });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('role', response.data.role);
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get stored token
  getToken: () => {
    return localStorage.getItem('token');
  },

  // Get user role
  getRole: () => {
    return localStorage.getItem('role');
  },

  // Get user info from JWT (survives refresh)
  getUserFromToken: () => {
    const token = localStorage.getItem('token');
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name || '',
    };
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  },

  // Get axios instance with auth header
  getAxiosInstance: () => {
    const instance = axios.create({
      baseURL: API_URL,
      headers: {
        Authorization: `Bearer ${authService.getToken()}`,
      },
    });
    return instance;
  },
};

export default authService;

