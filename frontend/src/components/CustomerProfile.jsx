import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaEnvelope, FaPhone, FaLock, FaSave, FaArrowLeft, FaIdCard, FaCheckCircle, FaClock, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';

const CustomerProfile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Profile info state
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    age: '',
    rewardPoints: 0,
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'password', or 'kyc'
  const [kycData, setKycData] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycForm, setKycForm] = useState({
    documentType: 'passport',
    documentNumber: '',
    documentPhoto: null,
  });

  useEffect(() => {
    // Load current user data
    const loadProfile = async () => {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) {
        navigate('/');
        return;
      }

      try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (data.success && data.user) {
          setProfileData({
            fullName: data.user.fullName || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            age: data.user.age || '',
            rewardPoints: data.user.rewardPoints || 0,
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };
    loadProfile();
    loadKYC();
  }, [user, navigate]);

  const loadKYC = async () => {
    const userId = user?.id || localStorage.getItem('userId');
    if (!userId) return;

    try {
      const res = await fetch('/api/kyc/my-kyc', {
        headers: {
          'x-user-id': userId
        }
      });
      const data = await res.json();
      if (data.success && data.kyc) {
        setKycData(data.kyc);
      }
    } catch (err) {
      console.error('Failed to load KYC:', err);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const userId = user?.id || localStorage.getItem('userId');
    if (!userId) {
      setError('User not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profileData.fullName,
          phone: profileData.phone,
          age: profileData.age && profileData.age !== '' ? parseInt(profileData.age) : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Profile updated successfully!');
        // Update state with server response to reflect saved values
        if (data.user) {
          setProfileData({
            fullName: data.user.fullName || '',
            email: data.user.email || profileData.email,
            phone: data.user.phone || '',
            age: data.user.age !== undefined && data.user.age !== null ? data.user.age : '',
            rewardPoints: data.user.rewardPoints || profileData.rewardPoints,
          });
        }
        // Update localStorage if name changed
        if (profileData.fullName) {
          localStorage.setItem('userName', profileData.fullName);
        }
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All password fields are required');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const userId = user?.id || localStorage.getItem('userId');
    if (!userId) {
      setError('User not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Password changed successfully! Please log in again.');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        // Log out user after password change
        setTimeout(() => {
          logout();
          navigate('/');
        }, 2000);
      } else {
        setError(data.message || 'Failed to change password');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKYCSubmit = async (e) => {
    e.preventDefault();
    setKycLoading(true);
    setMessage(null);
    setError(null);
    // If currently approved, warn user that resubmitting will set status back to pending
    if (kycData && (kycData.status || '').toString().toLowerCase() === 'approved') {
      const ok = window.confirm('Your KYC is already verified. Resubmitting will set status back to PENDING and require admin re-verification. Do you want to continue?');
      if (!ok) {
        setKycLoading(false);
        return;
      }
    }
    try {
      const userId = user?.id || localStorage.getItem('userId');
      if (!userId) {
        setError('User not found. Please log in again.');
        setKycLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('documentType', kycForm.documentType);
      formData.append('documentNumber', kycForm.documentNumber);
      if (kycForm.documentPhoto) {
        formData.append('documentImage', kycForm.documentPhoto);
      }

      const res = await fetch('/api/kyc/submit', {
        method: 'POST',
        headers: {
          'x-user-id': userId
        },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setMessage('KYC submitted successfully! Awaiting verification.');
        loadKYC();
        setKycForm({
          documentType: 'passport',
          documentNumber: '',
          documentPhoto: null,
        });
      } else {
        setError(data.message || 'Failed to submit KYC');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setKycLoading(false);
    }
  };

  const getKYCStatusBadge = (status) => {
    const s = (status || '').toString().toUpperCase();
    switch (s) {
      case 'VERIFIED':
      case 'APPROVED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><FaCheckCircle className="mr-1" /> Verified</span>;
      case 'PENDING':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><FaClock className="mr-1" /> Pending</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><FaTimesCircle className="mr-1" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">Not Submitted</span>;
    }
  };

  // Normalized status string for checks in the component (handles backend values like 'pending'/'approved')
  const kycStatus = kycData && kycData.status ? kycData.status.toString().toUpperCase() : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/customer')}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Profile Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your account information and security</p>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600">{message}</p>
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'profile'
                  ? 'bg-primary text-white border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FaUser className="inline mr-2" />
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors ${
                activeTab === 'password'
                  ? 'bg-primary text-white border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FaLock className="inline mr-2" />
              Change Password
            </button>
              <button
              onClick={() => setActiveTab('kyc')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors relative ${
                activeTab === 'kyc'
                  ? 'bg-primary text-white border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FaIdCard className="inline mr-2" />
              KYC Verification
              {kycData && (kycStatus === 'VERIFIED' || kycStatus === 'APPROVED') && (
                <FaCheckCircle className="absolute top-3 right-3 text-green-500" size={12} />
              )}
            </button>
          </div>

          {/* Reward Points Banner */}
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Your Reward Points</p>
                <p className="text-white text-3xl font-bold">⭐ {profileData.rewardPoints} Points</p>
                <p className="text-yellow-100 text-xs mt-1">1 point = 1 BDT | Use up to 20% discount on bookings</p>
              </div>
              <div className="text-white text-right">
                <p className="text-sm">Points Value</p>
                <p className="text-2xl font-bold">৳{profileData.rewardPoints}</p>
              </div>
            </div>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FaUser className="inline mr-2" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FaEnvelope className="inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FaPhone className="inline mr-2" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FaUser className="inline mr-2" />
                  Age
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={profileData.age}
                  onChange={(e) => setProfileData({ ...profileData, age: e.target.value })}
                  placeholder="Enter your age"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaSave className="mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FaLock className="inline mr-2" />
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FaLock className="inline mr-2" />
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                  minLength={6}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FaLock className="inline mr-2" />
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                  <FaExclamationTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span>You will be logged out after changing your password. Please log in again with your new password.</span>
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FaLock className="mr-2" />
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}

          {/* KYC Tab */}
          {activeTab === 'kyc' && (
            <div className="p-6 space-y-6">
              {/* KYC Status */}
              {kycData && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">KYC Status</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Submitted on: {new Date(kycData.createdAt).toLocaleDateString()}
                      </p>
                      {kycStatus === 'REJECTED' && kycData.rejectionReason && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                          Rejection Reason: {kycData.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div>{getKYCStatusBadge(kycData.status)}</div>
                  </div>
                  
                  {(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED') && (
                    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                      <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5 font-semibold">
                        <FaCheckCircle className="text-green-600 flex-shrink-0" /> You can now book international tour packages!
                      </p>
                    </div>
                  )}
                  
                  {kycStatus === 'PENDING' && (
                    <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5 font-semibold">
                        <FaClock className="text-yellow-600 flex-shrink-0 animate-pulse" /> Your KYC is under review. We'll notify you once verified.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Info Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">📋 Why KYC Verification?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  KYC (Know Your Customer) verification is required for booking international tour packages. This ensures secure travel documentation and compliance with international travel regulations.
                </p>
              </div>

              {/* KYC Form or Verified message */}
              {(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED') ? (
                <div className="p-6">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">KYC Verified</h3>
                    <p className="text-sm text-green-700 dark:text-green-200">Your identity has been verified by an administrator.</p>
                    {kycData && (kycData.verifiedBy || kycData.verifiedAt) && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {kycData.verifiedBy ? `Verified by: ${kycData.verifiedBy}` : null}
                        {kycData.verifiedAt ? `${kycData.verifiedBy ? ' • ' : ''}On: ${new Date(kycData.verifiedAt).toLocaleString()}` : null}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    If you need to update your documents, contact support or create a request from your account.
                  </div>
                </div>
              ) : (!kycData || kycStatus === 'REJECTED') && (
                <form onSubmit={handleKYCSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Document Type
                      </label>
                      <select
                        value={kycForm.documentType}
                        onChange={(e) => setKycForm({ ...kycForm, documentType: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                        required
                      >
                        <option value="passport">Passport</option>
                        <option value="national_id">National ID</option>
                        <option value="driving_license">Driving License</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Document Number
                      </label>
                      <input
                        type="text"
                        value={kycForm.documentNumber}
                        onChange={(e) => setKycForm({ ...kycForm, documentNumber: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder={kycForm.documentType === 'passport' ? 'e.g., BD1234567' : kycForm.documentType === 'national_id' ? 'e.g., 1234567890123' : 'e.g., DL123456'}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upload Document Image
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setKycForm({ ...kycForm, documentPhoto: e.target.files[0] })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                      required
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Upload a clear photo of your selected document (JPG, PNG, or PDF - Max 5MB)
                    </p>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                      <FaExclamationTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>Please ensure all information matches your official documents. Incorrect information may delay verification.</span>
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={kycLoading}
                      className="flex items-center px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FaIdCard className="mr-2" />
                      {kycLoading ? 'Submitting...' : 'Submit KYC'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;
