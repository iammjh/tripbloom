import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import Notifications from './components/ui/Notifications.jsx'
import ConfirmDialog from './components/ui/ConfirmDialog.jsx'

import axios from 'axios';

// Configure Axios global request interceptor to automatically append JWT token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Configure global fetch wrapper to append JWT token
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');

  options.headers = {
    ...options.headers
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  return originalFetch(url, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <AuthProvider>
        <App />
        <Notifications />
        <ConfirmDialog />
      </AuthProvider>
  </React.StrictMode>,
)
