import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { DarkModeProvider } from './context/DarkModeContext'
import { AuthProvider } from './context/AuthContext'

import axios from 'axios';

// Configure Axios global request interceptor to automatically append JWT token and user tracking headers
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (userId) {
      config.headers['x-user-id'] = userId;
    }
    if (userRole) {
      config.headers['x-user-role'] = userRole;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Configure global fetch wrapper to append JWT token and user tracking headers
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole');

  options.headers = {
    ...options.headers
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  if (userId) {
    options.headers['x-user-id'] = userId;
  }
  if (userRole) {
    options.headers['x-user-role'] = userRole;
  }

  return originalFetch(url, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DarkModeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DarkModeProvider>
  </React.StrictMode>,
)
