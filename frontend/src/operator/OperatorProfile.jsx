import { LuCalendar, LuCircleCheck, LuCircleX, LuClock, LuIdCard, LuMail, LuMapPin, LuPhone, LuSave, LuStar, LuToggleLeft, LuToggleRight, LuUser } from 'react-icons/lu';
import { userMessage } from '../utils/errorMessage.js';
import { notify } from '../utils/notifyStore.js';
import React, { useState, useEffect } from 'react';


const OperatorProfile = () => {
  const operatorId = localStorage.getItem('userId');
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    languages: '',
    bio: '',
    availability: 'AVAILABLE'
  });
  const [stats, setStats] = useState({
    completedTours: 0,
    totalTravelers: 0,
    rating: 0,
    totalReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // KYC state for operator (operators can submit their own KYC)
  const [kycData, setKycData] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycForm, setKycForm] = useState({ documentType: 'passport', documentNumber: '', documentPhoto: null });

  useEffect(() => {
    fetchProfile();
  }, [operatorId]);

  useEffect(() => {
    // load operator's existing KYC (if any)
    loadKYC();
  }, [operatorId]);

  const fetchProfile = async () => {
    try {
      console.log('Fetching profile for operatorId:', operatorId);
      
      if (!operatorId) {
        console.error('No operatorId found in localStorage');
        notify.message('No operator ID found. Please log in again.');
        setLoading(false);
        return;
      }
      
      const res = await fetch(`/api/operator/${operatorId}/dashboard`);
      console.log('API Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API Error:', errorText);
        throw new Error('Failed to fetch profile');
      }
      
      const data = await res.json();
      



      
      // Only fetch existing fields from database (fullName, email, phone)
      if (data.profile) {
        const profileData = {
          fullName: data.profile.fullName || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          address: '',
          languages: '',
          bio: '',
          availability: data.profile.availability || 'AVAILABLE'
        };
        

        setProfile(profileData);
      } else {
        console.error('No profile data received from API');
        notify.error('We could not find your operator profile. Please refresh the page or contact support.');
      }

      // Calculate stats from departures
      const completedCount = (data.groupDepartures || []).filter(d => 
        new Date(d.endDate) < new Date()
      ).length;
      
      const totalTravelers = (data.groupDepartures || []).reduce((sum, d) => 
        sum + (d.bookedSeats || 0), 0
      );

      setStats({
        completedTours: completedCount,
        totalTravelers: totalTravelers,
        rating: 0, // Not stored in DB yet
        totalReviews: 0 // Not stored in DB yet
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      notify.error(userMessage(error, 'We could not load your profile. Please refresh the page.'));
      setLoading(false);
    }
  };

  // loadKYC removed — operator KYC management is handled by admins

  const handleChange = (field, value) => {
    setProfile({ ...profile, [field]: value });
  };

  const persistProfile = async patch => {
    const res = await fetch(`/api/operator/${operatorId}/profile`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (!res.ok || !data.profile) throw new Error(data.message || data.error || 'Unable to save profile.');
    setProfile(previous => ({ ...previous, ...data.profile }));
    if (data.profile.fullName) localStorage.setItem('userName', data.profile.fullName);
    return data.profile;
  };

  const toggleAvailability = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await persistProfile({ availability: profile.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE' });
    } catch (error) { notify.error(userMessage(error, 'Your changes could not be saved. Please try again.')); }
    finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await persistProfile({ fullName: profile.fullName, email: profile.email, phone: profile.phone });
      notify.message('Profile saved successfully.');
    } catch (error) { notify.error(userMessage(error, 'Your changes could not be saved. Please try again.')); }
    finally { setSaving(false); }
  };

  const loadKYC = async () => {
    const userId = operatorId;
    if (!userId) return;
    setKycLoading(true);
    try {
      const res = await fetch('/api/kyc/my-kyc', { headers: { 'x-user-id': userId } });
      const data = await res.json();
      if (data && data.success && data.kyc) setKycData(data.kyc);
    } catch (err) {
      console.error('Failed to load operator KYC:', err);
    } finally {
      setKycLoading(false);
    }
  };

  const handleKYCSubmit = async (e) => {
    e.preventDefault();
    setKycLoading(true);
    try {
      const userId = operatorId;
      if (!userId) {
        notify.message('Operator not logged in');
        setKycLoading(false);
        return;
      }
      const formData = new FormData();
      formData.append('documentType', kycForm.documentType);
      formData.append('documentNumber', kycForm.documentNumber);
      if (kycForm.documentPhoto) formData.append('documentImage', kycForm.documentPhoto);

      const res = await fetch('/api/kyc/submit', { method: 'POST', headers: { 'x-user-id': userId }, body: formData });
      const data = await res.json();
      if (data.success) {
        notify.message('KYC submitted successfully. Awaiting verification.');
        setKycForm({ documentType: 'passport', documentNumber: '', documentPhoto: null });
        loadKYC();
      } else {
        notify.message('Failed to submit KYC: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('KYC submit error', err);
      notify.message('Network error submitting KYC');
    } finally {
      setKycLoading(false);
    }
  };

  const getKYCStatusBadge = (status) => {
    const s = (status || '').toString().toUpperCase();
    switch (s) {
      case 'VERIFIED':
      case 'APPROVED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><LuCircleCheck aria-hidden="true" className="mr-1" /> Verified</span>;
      case 'PENDING':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><LuClock aria-hidden="true" className="mr-1" /> Pending</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><LuCircleX aria-hidden="true" className="mr-1" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400">Not Submitted</span>;
    }
  };

  const kycStatus = kycData && kycData.status ? kycData.status.toString().toUpperCase() : null;

  // Operator KYC submission removed — handled by admin workflows.

  // KYC badge and status logic removed for operators

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <LuUser aria-hidden="true" className="mr-3 text-orange-600" />
          Operator Profile
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <h2 className="text-xl font-bold mb-6">Performance Stats</h2>
          
          <div className="space-y-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-100">Completed Tours</p>
                  <p className="text-3xl font-bold">{stats.completedTours}</p>
                </div>
                <LuCalendar aria-hidden="true" className="text-4xl text-white/50" />
              </div>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-100">Total Travelers</p>
                  <p className="text-3xl font-bold">{stats.totalTravelers}</p>
                </div>
                <LuUser aria-hidden="true" className="text-4xl text-white/50" />
              </div>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-100">Rating</p>
                  <p className="text-3xl font-bold flex items-center">
                    {stats.rating} <LuStar aria-hidden="true" className="ml-2 text-yellow-300" />
                  </p>
                  <p className="text-xs text-orange-100">{stats.totalReviews} reviews</p>
                </div>
                <LuStar aria-hidden="true" className="text-4xl text-white/50" />
              </div>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Contact Information</h2>
          
          
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <LuUser aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <LuMail aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Phone
                </label>
                <div className="relative">
                  <LuPhone aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+1234567890"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Address <span className="text-xs text-gray-500">(Not in database yet)</span>
              </label>
              <div className="relative">
                <LuMapPin aria-hidden="true" className="absolute left-3 top-3 text-gray-400" />
                <textarea
                  value={profile.address}
                  placeholder="This field will be available when added to database schema"
                  rows="2"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                  disabled
                ></textarea>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Languages <span className="text-xs text-gray-500">(Not in database yet)</span>
              </label>
              <input
                type="text"
                value={profile.languages}
                placeholder="This field will be available when added to database schema"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Bio / About Me <span className="text-xs text-gray-500">(Not in database yet)</span>
              </label>
              <textarea
                value={profile.bio}
                rows="4"
                placeholder="This field will be available when added to database schema"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                disabled
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      {/* Availability Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Availability Status</h2>
        
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Current Status: 
              <span className={`ml-3 ${profile.availability === 'AVAILABLE' ? 'text-green-600' : 'text-red-600'}`}>
                {profile.availability === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE'}
              </span>
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {profile.availability === 'AVAILABLE' 
                ? 'You are available for new tour assignments'
                : 'You are currently unavailable for new assignments'
              }
            </p>
          </div>
          
          <button
            onClick={toggleAvailability}
            disabled={saving}
            className={`flex items-center px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 ${
              profile.availability === 'AVAILABLE'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {profile.availability === 'AVAILABLE' ? (
              <>
                <LuToggleRight aria-hidden="true" className="mr-3 text-2xl" />
                Available
              </>
            ) : (
              <>
                <LuToggleLeft aria-hidden="true" className="mr-3 text-2xl" />
                Unavailable
              </>
            )}
          </button>
        </div>

        
      </div>

      {/* KYC Section for Operator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">KYC Verification</h2>
        <div className="mb-4">
          <p className="text-sm text-gray-600">Your KYC status:</p>
          <div className="mt-2">{ getKYCStatusBadge(kycData?.status) }</div>
        </div>

        {kycStatus === 'VERIFIED' || kycStatus === 'APPROVED' ? (
          <div className="p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">KYC Verified</h3>
            <p className="text-sm text-green-700 dark:text-green-200">Your identity has been verified by an administrator.</p>
            {(kycData?.verifiedBy || kycData?.verifiedAt) && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {kycData?.verifiedBy ? `Verified by: ${kycData.verifiedBy}` : null}
                {kycData?.verifiedAt ? `${kycData?.verifiedBy ? ' • ' : ''}On: ${new Date(kycData.verifiedAt).toLocaleString()}` : null}
              </p>
            )}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">If you need to update your documents, please contact support.</div>
          </div>
        ) : (
          <div>
            {kycData && kycData.status && (kycData.status.toString().toLowerCase() === 'pending') && (
              <div className="mb-4 text-sm text-gray-600">Submitted on: {new Date(kycData.createdAt).toLocaleString()}</div>
            )}

            <form onSubmit={handleKYCSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Type</label>
                  <select value={kycForm.documentType} onChange={(e) => setKycForm({...kycForm, documentType: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700">
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver's License</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Number</label>
                  <input value={kycForm.documentNumber} onChange={(e) => setKycForm({...kycForm, documentNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document Image</label>
                <input type="file" accept="image/*" onChange={(e) => setKycForm({...kycForm, documentPhoto: e.target.files && e.target.files[0]})} />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={kycLoading} className="px-6 py-3 bg-primary text-white rounded-lg">
                  {kycLoading ? 'Submitting…' : (kycData && kycData.status ? 'Resubmit KYC' : 'Submit KYC')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LuSave aria-hidden="true" className="mr-3" />
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
};

export default OperatorProfile;
