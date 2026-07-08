import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { FaTimes, FaGoogle, FaFacebook, FaEnvelope, FaLock, FaUser } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    roles: ['customer']
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
    const { setUser } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    if (isLogin) {
      // Login logic: send email and password
      try {
        const res = await axios.post('/api/login', {
          email: formData.email,
          passwordHash: formData.password
        });
        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
        }
        setMessage(res.data.message || 'Login successful!');
        // Role-based navigation
        const user = res.data.user;
        if (user && user.roles) {
          // Save user's name to localStorage
          if (user.fullName) {
            localStorage.setItem('userName', user.fullName);
          }
          // Save user's id to localStorage for dashboard queries
          if (user._id) {
            localStorage.setItem('userId', user._id);
          }
          // Save user's primary role for route protection
          if (user.roles && user.roles.length > 0) {
            const rolesLower = user.roles.map(r => r.toLowerCase());
            if (rolesLower.includes('admin')) {
              localStorage.setItem('userRole', 'admin');
            } else if (rolesLower.includes('operator') || rolesLower.includes('tour_operator')) {
              localStorage.setItem('userRole', 'operator');
            } else if (rolesLower.includes('customer')) {
              localStorage.setItem('userRole', 'customer');
            } else {
              localStorage.setItem('userRole', rolesLower[0]);
            }
          }
            // update auth context with minimal user
            setUser({ id: user._id, name: user.fullName, role: localStorage.getItem('userRole') });
          const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
          const rolesLower = roles.map(r => r.toLowerCase());
          if (rolesLower.includes('admin')) {
            navigate('/admin');
          } else if (rolesLower.includes('tour_operator') || rolesLower.includes('operator')) {
            navigate('/operator');
          } else if (rolesLower.includes('customer')) {
            navigate('/customer');
          } else {
            navigate('/');
          }
          onClose();
        }
      } catch (err) {
        setMessage(err.response?.data?.message || 'Login failed.');
      }
    } else {
      // Signup logic: send fullName, email, phone, password, roles
      try {
        const res = await axios.post('/api/signup', {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          passwordHash: formData.password,
          roles: formData.roles
        });
        setMessage(res.data.message || 'Signup successful!');
        // Optionally handle signup (e.g., auto-login, close modal)
      } catch (err) {
        setMessage(err.response?.data?.message || 'Signup failed.');
      }
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      roles: ['customer']
    });
  };

  const modalContent = (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 99999 }}>
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
          style={{ zIndex: 99998 }}
          onClick={onClose}
        ></div>
        
        {/* Modal Content */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in" style={{ zIndex: 99999 }}>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors z-10"
          >
            <FaTimes size={24} />
          </button>

          {/* Header with Gradient */}
          <div className="bg-gradient-to-r from-primary via-green-500 to-emerald-500 p-8 text-white">
            <h2 className="text-3xl font-bold mb-2">
              {isLogin ? 'Welcome Back!' : 'Join TripBloom'}
            </h2>
            <p className="text-green-50">
              {isLogin ? 'Log in to continue your journey' : 'Start your adventure today'}
            </p>
          </div>

          {/* Form Content */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name Field (Sign Up Only) */}
              {!isLogin && (
                <div className="animate-fade-in-up">
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                    <FaUser className="inline mr-2" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    required={!isLogin}
                  />
                </div>
              )}

              {/* Phone Field (Sign Up Only) */}
              {!isLogin && (
                <div className="animate-fade-in-up">
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                    📞 Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter your phone number (optional)"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              )}

              {/* Roles Field (hidden, default to customer) */}
              {!isLogin && (
                <input type="hidden" name="roles" value={formData.roles} />
              )}

              {/* Email Field */}
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                  <FaEnvelope className="inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  required
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                  <FaLock className="inline mr-2" />
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  required
                />
              </div>

              {/* Confirm Password (Sign Up Only) */}
              {!isLogin && (
                <div className="animate-fade-in-up">
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2">
                    <FaLock className="inline mr-2" />
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    required={!isLogin}
                  />
                </div>
              )}

              {/* Forgot Password (Login Only) */}
              {isLogin && (
                <div className="text-right">
                  <a href="#" className="text-sm text-primary hover:text-green-700 dark:hover:text-green-400 font-semibold">
                    Forgot Password?
                  </a>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-primary via-green-500 to-emerald-500 text-white py-3 rounded-lg font-bold text-lg hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                disabled={loading}
              >
                {loading ? (isLogin ? 'Logging In...' : 'Signing Up...') : (isLogin ? 'Log In' : 'Sign Up')}
              </button>

              {/* Message Feedback */}
              {message && (
                <div className={`text-center font-semibold mt-2 ${message.toLowerCase().includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </div>
              )}
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105">
                <FaGoogle className="text-red-500" size={20} />
                <span className="font-semibold text-gray-700 dark:text-gray-300">Google</span>
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all transform hover:scale-105">
                <FaFacebook className="text-blue-600" size={20} />
                <span className="font-semibold text-gray-700 dark:text-gray-300">Facebook</span>
              </button>
            </div>

            {/* Switch Mode */}
            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary hover:text-green-700 dark:hover:text-green-400 font-bold"
                >
                  {isLogin ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};

export default AuthModal;
