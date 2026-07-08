import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { 
  FaTimes, FaMapMarkerAlt, FaStar, FaCalendarAlt, 
  FaUsers, FaBed, FaUtensils, FaCar, FaUserTie, FaClock, 
  FaCheck, FaPlane, FaShieldAlt, FaCamera, FaHeart,
  FaChevronLeft, FaChevronRight, FaEdit, FaCompressAlt,
  FaExclamationTriangle, FaIdCard, FaCheckCircle, FaTimesCircle
} from 'react-icons/fa';

const TourDetailModal = ({ isOpen, onClose, packageData, userRole = 'CUSTOMER' }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showImages, setShowImages] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isCustomBooking, setIsCustomBooking] = useState(false);
  const [userRewardPoints, setUserRewardPoints] = useState(0);
  const [availableDepartures, setAvailableDepartures] = useState([]);
  const [selectedDepartureId, setSelectedDepartureId] = useState('');
  const [isFirstTravelerSelf, setIsFirstTravelerSelf] = useState(false);
  const [userProfileData, setUserProfileData] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [bookingData, setBookingData] = useState({
    numTravelers: 1,
    startDate: '',
    customizations: '',
    bookingFor: 'self', // 'self' or 'others'
    pointsToUse: 0,
    travelers: [
      { fullName: '', age: '', phone: '' }
    ],
    customPreferences: {
      excludeItems: [],
      addItems: '',
      dietary: '',
      accommodation: '',
      transport: '',
      activities: ''
    }
  });

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      // Fetch user's reward points
      const fetchRewardPoints = async () => {
        const userId = localStorage.getItem('userId');
        if (userId) {
          try {
            const res = await fetch(`/api/users/${userId}`);
            const data = await res.json();
            if (data.success && data.user) {
              setUserRewardPoints(data.user.rewardPoints || 0);
              // Store user profile data for auto-fill
              setUserProfileData({
                fullName: data.user.fullName || '',
                age: data.user.age || '',
                phone: data.user.phone || ''
              });
            }
          } catch (err) {
            console.error('Failed to fetch reward points:', err);
          }
        }
      };
      fetchRewardPoints();
      
      // Fetch KYC status for international packages
      if (packageData.isInternational && userRole === 'CUSTOMER') {
        fetchKYCStatus();
      }
      
      // Fetch available departures for GROUP packages
      if (packageData.type === 'GROUP') {
        fetchAvailableDepartures();
      }
      
      return () => {
        // Restore scroll position without jump
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      };
    }
  }, [isOpen]);

  if (!isOpen || !packageData) return null;

  const fetchAvailableDepartures = async () => {
    try {
      const res = await axios.get('/api/admin/group-departures', {
        params: { 
          packageId: packageData._id,
          status: 'OPEN'
        }
      });
      
      if (res.data.departures) {
        // Filter future departures with available seats and sort by start date
        const futureDepartures = res.data.departures
          .filter(dep => {
            const hasAvailableSeats = dep.bookedSeats < dep.totalSeats;
            const isFuture = new Date(dep.startDate) > new Date();
            return hasAvailableSeats && isFuture;
          })
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
        setAvailableDepartures(futureDepartures);
      }
    } catch (err) {
      console.error('Failed to fetch available departures:', err);
      setAvailableDepartures([]);
    }
  };

  const fetchKYCStatus = async () => {
    setKycLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setKycStatus('NOT_SUBMITTED');
        setKycLoading(false);
        return;
      }

      const res = await axios.get('/api/kyc/my-kyc', {
        headers: { 'x-user-id': userId }
      });
      if (res.data.success && res.data.kyc) {
        setKycStatus(res.data.kyc.status ? res.data.kyc.status.toString().toUpperCase() : null);
      } else {
        setKycStatus('NOT_SUBMITTED');
      }
    } catch (err) {
      console.error('Failed to fetch KYC status:', err);
      setKycStatus('NOT_SUBMITTED');
    } finally {
      setKycLoading(false);
    }
  };

  // Get images based on destinations
  const getPackageImages = () => {
    const images = [];
    
    // First, use uploaded photos if available
    if (packageData.photos && packageData.photos.length > 0) {
      packageData.photos.forEach(photoUrl => {
        if (photoUrl && photoUrl.trim()) {
          images.push(photoUrl);
        }
      });
      // If we have photos, return them
      if (images.length > 0) return images;
    }
    
    // Otherwise, fallback to destination-based images
    packageData.destinations?.forEach(dest => {
      const location = (dest.country || dest.city || '').toLowerCase();
      if (location.includes('bali')) images.push('https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=500&fit=crop');
      else if (location.includes('maldives')) images.push('https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&h=500&fit=crop');
      else if (location.includes('paris')) images.push('https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=500&fit=crop');
      else if (location.includes('dubai')) images.push('https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=500&fit=crop');
      else if (location.includes('thailand')) images.push('https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&h=500&fit=crop');
      else if (location.includes('cox')) images.push('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=500&fit=crop');
      else if (location.includes('sundarban')) images.push('https://images.unsplash.com/photo-1511497584788-876760111969?w=800&h=500&fit=crop');
      else images.push('https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=500&fit=crop');
    });
    
    // Default images if none found
    if (images.length === 0) {
      images.push(
        'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&h=500&fit=crop',
        'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&h=500&fit=crop'
      );
    }
    
    return images;
  };

  const images = getPackageImages();

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleBooking = async () => {
    // Check KYC for international packages
    if (packageData.isInternational && !(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED')) {
      alert('KYC verification is required to book international tour packages. Please complete your KYC verification in your profile settings.');
      return;
    }
    
    // Validation
    if (packageData.type === 'GROUP' && !selectedDepartureId) {
      alert('Please select a departure date for this group tour.');
      return;
    }
    
    if (packageData.type !== 'GROUP' && !bookingData.startDate) {
      alert('Please select a start date for your tour.');
      return;
    }

    if (!bookingData.numTravelers || bookingData.numTravelers < 1) {
      alert('Please specify number of travelers.');
      return;
    }

    // Validate traveler information
    // For GROUP tours with multiple travelers, always require full details
    // For other bookings, only validate if booking for others
    const requiresAllTravelerDetails = (bookingData.numTravelers > 1 && bookingData.bookingFor === 'self') || bookingData.bookingFor === 'others';
    
    if (requiresAllTravelerDetails) {
      for (let i = 0; i < bookingData.numTravelers; i++) {
        const traveler = bookingData.travelers[i];
        if (!traveler || !traveler.fullName || !traveler.age || !traveler.phone) {
          alert(`Please fill in all details for Traveler ${i + 1} (Name, Age, Phone)`);
          return;
        }
      }
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('Please log in to make a booking.');
      return;
    }

    try {
      // Get start and end dates
      let startDate, endDate;
      
      if (packageData.type === 'GROUP') {
        // For GROUP tours, use the selected departure's dates
        const selectedDeparture = availableDepartures.find(dep => dep._id === selectedDepartureId);
        if (!selectedDeparture) {
          alert('Selected departure not found. Please try again.');
          return;
        }
        startDate = new Date(selectedDeparture.startDate);
        endDate = new Date(selectedDeparture.endDate);
      } else {
        // For PERSONAL tours, calculate end date based on package duration
        startDate = new Date(bookingData.startDate);
        const durationDays = packageData.duration || 3;
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + durationDays);
      }

      // Build travelers array
      let travelers = [];
      
      // For GROUP tours with multiple travelers, always use form data
      if (packageData.type === 'GROUP' && bookingData.numTravelers > 1) {
        travelers = bookingData.travelers.slice(0, bookingData.numTravelers).map(t => ({
          fullName: t.fullName,
          age: parseInt(t.age),
          phone: t.phone
        }));
      } else if (bookingData.bookingFor === 'self') {
        // Get user info from localStorage or context
        const userFullName = localStorage.getItem('userFullName') || 'Customer';
        const userPhone = localStorage.getItem('userPhone') || '';
        
        for (let i = 0; i < bookingData.numTravelers; i++) {
          travelers.push({
            fullName: i === 0 ? userFullName : `Guest ${i}`,
            age: 30, // Default age
            phone: i === 0 ? userPhone : '',
            userId: i === 0 ? userId : undefined
          });
        }
      } else {
        // Use the traveler details provided
        travelers = bookingData.travelers.slice(0, bookingData.numTravelers).map(t => ({
          fullName: t.fullName,
          age: parseInt(t.age),
          phone: t.phone
        }));
      }

      const totalAmount = packageData.basePrice * bookingData.numTravelers;

      // Map package type to booking type
      // Package types: PERSONAL, GROUP
      // Booking types: PRIVATE, GROUP, CUSTOM
      let bookingType = 'GROUP';
      if (packageData.type === 'PERSONAL') {
        bookingType = 'PRIVATE';
      } else if (packageData.type === 'GROUP') {
        bookingType = 'GROUP';
      }

      // Build customization text including custom preferences if it's a custom booking
      let customizationText = bookingData.customizations || '';
      if (isCustomBooking) {
        const prefs = [];
        if (bookingData.customPreferences.excludeItems.length > 0) {
          prefs.push(`Exclude: ${bookingData.customPreferences.excludeItems.join(', ')}`);
        }
        if (bookingData.customPreferences.addItems) {
          prefs.push(`Add: ${bookingData.customPreferences.addItems}`);
        }
        if (bookingData.customPreferences.dietary) {
          prefs.push(`Dietary: ${bookingData.customPreferences.dietary}`);
        }
        if (bookingData.customPreferences.accommodation) {
          prefs.push(`Accommodation: ${bookingData.customPreferences.accommodation}`);
        }
        if (bookingData.customPreferences.transport) {
          prefs.push(`Transport: ${bookingData.customPreferences.transport}`);
        }
        if (bookingData.customPreferences.activities) {
          prefs.push(`Activity Level: ${bookingData.customPreferences.activities}`);
        }
        if (prefs.length > 0) {
          customizationText = prefs.join(' | ') + (customizationText ? ' | ' + customizationText : '');
        }
      }

      const bookingPayload = {
        customerId: userId,
        packageId: packageData._id,
        bookingType: bookingType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        numTravelers: bookingData.numTravelers,
        travelers: travelers,
        totalAmount: totalAmount,
        currency: packageData.currency || 'BDT',
        customizations: customizationText,
        pointsToUse: bookingData.pointsToUse || 0
      };
      
      // Add groupDepartureId for GROUP bookings
      if (packageData.type === 'GROUP') {
        bookingPayload.groupDepartureId = selectedDepartureId;
      }

      const response = await axios.post('/api/bookings', bookingPayload);
      
      if (response.data.success) {
        alert('Booking request submitted successfully! You can view and manage your booking in the dashboard.');
        setShowBookingForm(false);
        setIsCustomBooking(false);
        setSelectedDepartureId('');
        setBookingData({ 
          numTravelers: 1, 
          startDate: '', 
          customizations: '', 
          bookingFor: 'self',
          travelers: [{ fullName: '', age: '', phone: '' }],
          customPreferences: {
            excludeItems: [],
            addItems: '',
            dietary: '',
            accommodation: '',
            transport: '',
            activities: ''
          }
        });
        onClose();
      } else {
        alert(response.data.message || 'Failed to submit booking.');
      }
    } catch (error) {
      console.error('Booking error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to submit booking. Please try again.';
      alert(errorMessage);
    }
  };

  const handleCustomize = () => {
    // For personal tours, allow customization - open booking form with custom mode
    setIsCustomBooking(true);
    setShowBookingForm(true);
  };

  const isGroupTour = packageData.type === 'GROUP';
  const canCustomize = !isGroupTour && userRole === 'CUSTOMER';

  const modalContent = (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 99999 }}>
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        ></div>
        
        {/* Modal Content */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-scale-in" style={{ zIndex: 99999 }}>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 p-2 rounded-full shadow-lg transition-all"
          >
            <FaTimes size={20} />
          </button>

          {/* Image Gallery (collapsible) */}
          <div className="relative overflow-hidden group" style={{height: showImages ? '24rem' : '4rem', transition: 'height 260ms ease'}}>
            <img
              src={images[activeImageIndex]}
              alt={packageData.title}
              className="w-full h-full object-cover"
              style={{objectPosition: 'center bottom', transition: 'transform 260ms ease'}}
            />
            {/* when collapsed we overlay a thin title bar */}
            {!showImages && (
              <div className="absolute inset-0 flex items-end">
                <div className="w-full bg-gradient-to-t from-black/70 to-transparent p-3">
                  <h2 className="text-lg font-semibold text-white">{packageData.title}</h2>
                </div>
              </div>
            )}
            
            {/* Image overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
            
            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <FaChevronLeft className="text-gray-800 dark:text-white" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-800/80 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <FaChevronRight className="text-gray-800 dark:text-white" />
                </button>
              </>
            )}

            {/* Collapse / Expand Photos Button */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowImages(v => !v); }}
              className="absolute right-20 top-4 z-20 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 p-2 rounded-full shadow-lg transition-all"
              title={showImages ? 'Collapse photos' : 'Show photos'}
            >
              <FaCompressAlt size={16} />
            </button>

            {/* Image indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === activeImageIndex ? 'bg-white w-8' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>

            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-4xl font-bold mb-2">{packageData.title}</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full flex items-center gap-2">
                      <FaClock />
                      {packageData.defaultDays}D/{packageData.defaultNights}N
                    </span>
                    <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
                      {isGroupTour ? '🚌 Group Tour' : '✨ Personal Tour'}
                    </span>
                    {packageData.isInternational && (
                      <span className="px-4 py-1.5 bg-orange-500/30 backdrop-blur-sm rounded-full">
                        ✈️ International
                      </span>
                    )}
                    {packageData.category && (
                      <span className="px-4 py-1.5 bg-yellow-500/80 backdrop-blur-sm rounded-full font-semibold">
                        {packageData.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right bg-white/10 backdrop-blur-sm px-6 py-3 rounded-xl">
                  <div className="text-sm opacity-90">Starting from</div>
                  <div className="text-5xl font-bold">${packageData.basePrice?.toLocaleString()}</div>
                  <div className="text-xs opacity-75">per person</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto" style={{maxHeight: showImages ? '50vh' : 'calc(100vh - 6rem)', transition: 'max-height 260ms ease'}}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                {/* Description */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FaPlane className="text-primary" />
                    About This Tour
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                    {packageData.description || 'Embark on an unforgettable journey filled with amazing experiences, cultural discoveries, and breathtaking scenery. This carefully curated tour package offers the perfect blend of adventure and relaxation.'}
                  </p>
                </div>

                {/* Destinations Timeline */}
                {packageData.destinations && packageData.destinations.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                      <FaMapMarkerAlt className="text-primary" />
                      Your Journey
                    </h3>
                    <div className="relative">
                      <div className="absolute left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-blue-400 to-green-400"></div>
                      
                      <div className="space-y-6">
                        {packageData.destinations
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((dest, index) => (
                            <div key={index} className="relative pl-16">
                              <div className="absolute left-3 top-4 w-6 h-6 bg-gradient-to-br from-primary to-green-500 rounded-full border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center text-white text-xs font-bold">
                                {dest.order || index + 1}
                              </div>
                              
                              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                      {dest.name}
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                      <FaMapMarkerAlt className="text-primary" />
                                      {dest.city && `${dest.city}, `}{dest.country}
                                    </p>
                                  </div>
                                  <span className="px-4 py-2 bg-primary text-white rounded-full text-sm font-bold shadow-md">
                                    Day {dest.order || index + 1}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* What's Included */}
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <FaCheck className="text-green-500" />
                    What's Included
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packageData.inclusions?.transport && (
                      <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-blue-500 text-white p-3 rounded-lg">
                          <FaCar className="text-2xl" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white mb-1">Transportation</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">{packageData.inclusions.transport}</div>
                        </div>
                      </div>
                    )}
                    {packageData.inclusions?.hotel && (
                      <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-purple-500 text-white p-3 rounded-lg">
                          <FaBed className="text-2xl" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white mb-1">Accommodation</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">{packageData.inclusions.hotel}</div>
                        </div>
                      </div>
                    )}
                    {packageData.inclusions?.meals && (
                      <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-orange-500 text-white p-3 rounded-lg">
                          <FaUtensils className="text-2xl" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white mb-1">Meals</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">{packageData.inclusions.meals}</div>
                        </div>
                      </div>
                    )}
                    {packageData.inclusions?.guide && (
                      <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-green-500 text-white p-3 rounded-lg">
                          <FaUserTie className="text-2xl" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white mb-1">Tour Guide</div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">Expert local guide included</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extras/Activities */}
                {packageData.extras && packageData.extras.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FaStar className="text-yellow-500" />
                      Special Features
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {packageData.extras.map((extra, index) => (
                        <span 
                          key={index}
                          className="px-5 py-2.5 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 text-gray-800 dark:text-gray-200 rounded-full text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
                        >
                          ✨ {extra}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Tour Operator Information for GROUP tours */}
                {packageData.type === 'GROUP' && packageData.assignedOperators && packageData.assignedOperators.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FaUserTie className="text-primary" />
                      Tour Operator
                    </h3>
                    <div className="space-y-3">
                      {packageData.assignedOperators.map((operator, index) => (
                        <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-4">
                            <div className="bg-primary text-white p-3 rounded-full">
                              <FaUserTie className="text-2xl" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-2">
                                {operator.fullName || 'Tour Operator'}
                              </h4>
                              {operator.phone && (
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                  <span className="font-semibold">📞 Phone:</span>
                                  <a 
                                    href={`tel:${operator.phone}`}
                                    className="text-primary hover:underline font-medium"
                                  >
                                    {operator.phone}
                                  </a>
                                </div>
                              )}
                              {operator.email && (
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 mt-1">
                                  <span className="font-semibold">✉️ Email:</span>
                                  <a 
                                    href={`mailto:${operator.email}`}
                                    className="text-primary hover:underline font-medium text-sm"
                                  >
                                    {operator.email}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar - Booking Card */}
              <div className="lg:col-span-1">
                <div className="sticky top-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 p-6 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-600">
                  <div className="mb-6 text-center">
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-2">Price per person</div>
                    <div className="text-5xl font-bold text-primary mb-1">
                      ${packageData.basePrice?.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-yellow-500">
                      <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
                      <span className="text-gray-600 dark:text-gray-400 text-sm ml-2">(4.8/5)</span>
                    </div>
                  </div>

                  {/* KYC Warning for International Packages */}
                  {packageData.isInternational && userRole === 'CUSTOMER' && (
                    <div className={`mb-4 p-4 rounded-lg border ${
                      (kycStatus === 'VERIFIED' || kycStatus === 'APPROVED') 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}>
                      {kycLoading ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400">Checking KYC status...</p>
                      ) : (kycStatus === 'VERIFIED' || kycStatus === 'APPROVED') ? (
                        <div className="flex items-start gap-2 text-green-700 dark:text-green-300">
                          <FaIdCard className="mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-1.5"><FaCheckCircle className="text-green-600 flex-shrink-0" /> KYC Verified</p>
                            <p className="text-xs mt-1">You're all set to book this international tour package!</p>
                          </div>
                        </div>
                      ) : kycStatus === 'PENDING' ? (
                        <div className="flex items-start gap-2 text-yellow-700 dark:text-yellow-300">
                          <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-1.5"><FaClock className="text-yellow-600 animate-pulse flex-shrink-0" /> KYC Pending Verification</p>
                            <p className="text-xs mt-1">Your KYC is under review. You can book once it's verified.</p>
                          </div>
                        </div>
                      ) : kycStatus === 'REJECTED' ? (
                        <div className="flex items-start gap-2 text-red-700 dark:text-red-300">
                          <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-1.5"><FaTimesCircle className="text-red-600 flex-shrink-0" /> KYC Rejected</p>
                            <p className="text-xs mt-1">Please resubmit your KYC in profile settings to book international tours.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-yellow-700 dark:text-yellow-300">
                          <FaExclamationTriangle className="mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold flex items-center gap-1.5"><FaExclamationTriangle className="text-yellow-600 flex-shrink-0" /> KYC Required</p>
                            <p className="text-xs mt-1">This is an international tour. Complete KYC verification in your profile to book.</p>
                            <a href="/customer/profile" className="text-xs underline mt-1 block">Go to Profile Settings →</a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!showBookingForm ? (
                    <div className="space-y-3">
                      {isGroupTour ? (
                        <>
                          <button
                            onClick={() => {
                              setIsCustomBooking(false);
                              setShowBookingForm(true);
                            }}
                            disabled={packageData.isInternational && !(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED')}
                            className={`w-full py-4 bg-gradient-to-r from-primary to-green-600 text-white font-bold rounded-xl transition-all shadow-lg ${
                              packageData.isInternational && !(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED')
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:from-green-600 hover:to-primary hover:shadow-xl transform hover:scale-105'
                            }`}
                          >
                            Book This Tour
                          </button>
                          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                            🚌 Group tours have fixed schedules and cannot be customized
                          </p>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setIsCustomBooking(false);
                              setShowBookingForm(true);
                            }}
                            disabled={packageData.isInternational && !(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED')}
                            className={`w-full py-4 bg-gradient-to-r from-primary to-green-600 text-white font-bold rounded-xl transition-all shadow-lg ${
                              packageData.isInternational && !(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED')
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:from-green-600 hover:to-primary hover:shadow-xl transform hover:scale-105'
                            }`}
                          >
                            Book As-Is
                          </button>
                          {canCustomize && (
                            <button 
                              onClick={handleCustomize}
                              disabled={packageData.isInternational && !(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED')}
                              className={`w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                                  packageData.isInternational && !(kycStatus === 'VERIFIED' || kycStatus === 'APPROVED')
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:from-pink-600 hover:to-purple-500 hover:shadow-xl transform hover:scale-105'
                              }`}
                            >
                              <FaEdit />
                              Customize Your Tour
                            </button>
                          )}
                          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                            ✨ Personal tours can be customized to your preferences
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-4">Book Your Adventure</h4>
                      
                      {/* Booking For Selection - Not shown for GROUP tours */}
                      {packageData.type !== 'GROUP' && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Booking For
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="bookingFor"
                                value="self"
                                checked={bookingData.bookingFor === 'self'}
                                onChange={(e) => setBookingData({
                                  ...bookingData, 
                                  bookingFor: e.target.value,
                                  travelers: [{ fullName: '', age: '', phone: '' }]
                                })}
                                className="mr-2"
                              />
                              <span className="text-gray-700 dark:text-gray-300">Myself</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="radio"
                                name="bookingFor"
                                value="others"
                                checked={bookingData.bookingFor === 'others'}
                                onChange={(e) => {
                                  const travelers = [];
                                  for (let i = 0; i < bookingData.numTravelers; i++) {
                                    travelers.push({ fullName: '', age: '', phone: '' });
                                  }
                                  setBookingData({
                                    ...bookingData, 
                                    bookingFor: e.target.value,
                                    travelers
                                  });
                                }}
                                className="mr-2"
                              />
                              <span className="text-gray-700 dark:text-gray-300">Others</span>
                            </label>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Number of Travelers
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={bookingData.numTravelers}
                          onChange={(e) => {
                            const count = parseInt(e.target.value) || 1;
                            const travelers = [];
                            for (let i = 0; i < count; i++) {
                              travelers.push(bookingData.travelers[i] || { fullName: '', age: '', phone: '' });
                            }
                            // Update travelers array when booking for multiple people or for others
                            const shouldUpdateTravelers = count > 1 || bookingData.bookingFor === 'others';
                            setBookingData({
                              ...bookingData, 
                              numTravelers: count,
                              travelers: shouldUpdateTravelers ? travelers : bookingData.travelers
                            });
                          }}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      {/* Traveler Information for 'others' OR when booking for multiple travelers (PERSONAL or GROUP) */}
                      {((bookingData.numTravelers > 1 && bookingData.bookingFor === 'self') || bookingData.bookingFor === 'others') && (
                        <div className="space-y-4 max-h-80 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-900 dark:text-white sticky top-0 bg-white dark:bg-gray-800 pb-2">
                            Traveler Details <span className="text-red-500">*</span>
                          </h5>
                          {Array.from({ length: bookingData.numTravelers }).map((_, index) => {
                            const handleThisIsMeToggle = (checked) => {
                              setIsFirstTravelerSelf(checked);
                              if (checked && userProfileData) {
                                // Auto-fill first traveler with user's data
                                const newTravelers = [...bookingData.travelers];
                                newTravelers[0] = {
                                  fullName: userProfileData.fullName,
                                  age: userProfileData.age,
                                  phone: userProfileData.phone,
                                  userId: localStorage.getItem('userId') || null
                                };
                                setBookingData({...bookingData, travelers: newTravelers});
                              }
                            };
                            
                            return (
                            <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                Traveler {index + 1}
                              </p>
                              
                              {/* Add "This is me" checkbox for first traveler */}
                              {index === 0 && (
                                <div className="mb-3">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isFirstTravelerSelf}
                                      onChange={(e) => handleThisIsMeToggle(e.target.checked)}
                                      className="mr-2 w-4 h-4 text-primary focus:ring-2 focus:ring-primary rounded"
                                    />
                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                      ✓ This is me (auto-fill my information)
                                    </span>
                                  </label>
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  placeholder="Full Name *"
                                  value={bookingData.travelers[index]?.fullName || ''}
                                  onChange={(e) => {
                                    const newTravelers = [...bookingData.travelers];
                                    newTravelers[index] = {
                                      ...newTravelers[index],
                                      fullName: e.target.value
                                    };
                                    setBookingData({...bookingData, travelers: newTravelers});
                                  }}
                                  readOnly={index === 0 && isFirstTravelerSelf}
                                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white text-sm ${
                                    index === 0 && isFirstTravelerSelf ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''
                                  }`}
                                  required
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="number"
                                    placeholder="Age *"
                                    min="1"
                                    max="120"
                                    value={bookingData.travelers[index]?.age || ''}
                                    onChange={(e) => {
                                      const newTravelers = [...bookingData.travelers];
                                      newTravelers[index] = {
                                        ...newTravelers[index],
                                        age: e.target.value
                                      };
                                      setBookingData({...bookingData, travelers: newTravelers});
                                    }}
                                    readOnly={index === 0 && isFirstTravelerSelf}
                                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white text-sm ${
                                      index === 0 && isFirstTravelerSelf ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''
                                    }`}
                                    required
                                  />
                                  <input
                                    type="tel"
                                    placeholder="Phone Number *"
                                    value={bookingData.travelers[index]?.phone || ''}
                                    onChange={(e) => {
                                      const newTravelers = [...bookingData.travelers];
                                      newTravelers[index] = {
                                        ...newTravelers[index],
                                        phone: e.target.value
                                      };
                                      setBookingData({...bookingData, travelers: newTravelers});
                                    }}
                                    readOnly={index === 0 && isFirstTravelerSelf}
                                    className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white text-sm ${
                                      index === 0 && isFirstTravelerSelf ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : ''
                                    }`}
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Departure Selection for GROUP tours OR Date Selection for PERSONAL tours */}
                      {packageData.type === 'GROUP' ? (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Select Departure Date <span className="text-red-500">*</span>
                          </label>
                          {availableDepartures.length > 0 ? (
                            <select
                              value={selectedDepartureId}
                              onChange={(e) => setSelectedDepartureId(e.target.value)}
                              required
                              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                            >
                              <option value="">-- Select a departure --</option>
                              {availableDepartures.map((departure) => {
                                const startDate = new Date(departure.startDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                });
                                const endDate = new Date(departure.endDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                });
                                const availableSeats = departure.totalSeats - departure.bookedSeats;
                                return (
                                  <option key={departure._id} value={departure._id}>
                                    {startDate} to {endDate} ({availableSeats} seats available)
                                  </option>
                                );
                              })}
                            </select>
                          ) : (
                            <div className="w-full px-4 py-3 border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm">
                              No available departures at the moment. Please contact us for more information.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Preferred Start Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={bookingData.startDate}
                            onChange={(e) => setBookingData({...bookingData, startDate: e.target.value})}
                            min={new Date().toISOString().split('T')[0]}
                            required
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      )}

                      {/* Customization Options - Only show if this is a custom booking */}
                      {isCustomBooking && (
                        <div className="border-2 border-purple-300 dark:border-purple-700 rounded-lg p-4 space-y-4 bg-purple-50 dark:bg-purple-900/20">
                          <h5 className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                            <FaEdit /> Customize Your Tour
                          </h5>
                          
                          {/* Exclude Items */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Exclude from Package (Select items you don't want)
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {['Accommodation', 'Meals', 'Transport', 'Guide', 'Activities', 'Insurance'].map((item) => (
                                <label key={item} className="flex items-center cursor-pointer text-sm">
                                  <input
                                    type="checkbox"
                                    checked={bookingData.customPreferences.excludeItems.includes(item)}
                                    onChange={(e) => {
                                      const newExcluded = e.target.checked
                                        ? [...bookingData.customPreferences.excludeItems, item]
                                        : bookingData.customPreferences.excludeItems.filter(i => i !== item);
                                      setBookingData({
                                        ...bookingData,
                                        customPreferences: {
                                          ...bookingData.customPreferences,
                                          excludeItems: newExcluded
                                        }
                                      });
                                    }}
                                    className="mr-2"
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">{item}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Add Custom Items/Activities */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Add Custom Activities or Destinations
                            </label>
                            <textarea
                              value={bookingData.customPreferences.addItems}
                              onChange={(e) => setBookingData({
                                ...bookingData,
                                customPreferences: {
                                  ...bookingData.customPreferences,
                                  addItems: e.target.value
                                }
                              })}
                              rows="2"
                              placeholder="E.g., Visit local markets, Photography session, Hiking, specific destinations..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm resize-none"
                            />
                          </div>

                          {/* Dietary Preferences */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Dietary Preferences
                            </label>
                            <input
                              type="text"
                              value={bookingData.customPreferences.dietary}
                              onChange={(e) => setBookingData({
                                ...bookingData,
                                customPreferences: {
                                  ...bookingData.customPreferences,
                                  dietary: e.target.value
                                }
                              })}
                              placeholder="E.g., Vegetarian, Vegan, Halal, Allergies..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                            />
                          </div>

                          {/* Accommodation Preference */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Accommodation Preference
                            </label>
                            <select
                              value={bookingData.customPreferences.accommodation}
                              onChange={(e) => setBookingData({
                                ...bookingData,
                                customPreferences: {
                                  ...bookingData.customPreferences,
                                  accommodation: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value="">No Preference</option>
                              <option value="budget">Budget (Hostel/Guesthouse)</option>
                              <option value="standard">Standard (3-Star Hotel)</option>
                              <option value="luxury">Luxury (4-5 Star Hotel)</option>
                              <option value="resort">Resort</option>
                              <option value="boutique">Boutique Hotel</option>
                            </select>
                          </div>

                          {/* Transport Preference */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Transport Preference
                            </label>
                            <select
                              value={bookingData.customPreferences.transport}
                              onChange={(e) => setBookingData({
                                ...bookingData,
                                customPreferences: {
                                  ...bookingData.customPreferences,
                                  transport: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value="">No Preference</option>
                              <option value="private-car">Private Car/Van</option>
                              <option value="shared">Shared Transport</option>
                              <option value="luxury">Luxury Vehicle</option>
                              <option value="public">Public Transport</option>
                            </select>
                          </div>

                          {/* Activity Level */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Preferred Activity Level
                            </label>
                            <select
                              value={bookingData.customPreferences.activities}
                              onChange={(e) => setBookingData({
                                ...bookingData,
                                customPreferences: {
                                  ...bookingData.customPreferences,
                                  activities: e.target.value
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                            >
                              <option value="">No Preference</option>
                              <option value="relaxed">Relaxed (Leisure focused)</option>
                              <option value="moderate">Moderate (Balanced)</option>
                              <option value="active">Active (Adventure focused)</option>
                              <option value="extreme">Extreme (High adventure)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          {isCustomBooking ? 'Additional Notes (Optional)' : 'Special Requests (Optional)'}
                        </label>
                        <textarea
                          value={bookingData.customizations}
                          onChange={(e) => setBookingData({...bookingData, customizations: e.target.value})}
                          rows="3"
                          placeholder={isCustomBooking ? "Any other special requirements..." : "Any special requirements or preferences..."}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white resize-none"
                        />
                      </div>

                      {/* Reward Points Section */}
                      {userRewardPoints > 0 && (
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-400 dark:border-yellow-600 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                                ⭐ Available Reward Points
                              </p>
                              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                You have {userRewardPoints} points (1 point = 1 BDT)
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Use Points for Discount (Max 20% of total)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="0"
                                max={Math.min(userRewardPoints, Math.floor((packageData.basePrice * bookingData.numTravelers) * 0.2))}
                                value={bookingData.pointsToUse}
                                onChange={(e) => {
                                  const points = parseInt(e.target.value) || 0;
                                  const maxPoints = Math.min(userRewardPoints, Math.floor((packageData.basePrice * bookingData.numTravelers) * 0.2));
                                  setBookingData({...bookingData, pointsToUse: Math.min(points, maxPoints)});
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-gray-700 dark:text-white"
                                placeholder="Enter points to use"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const maxPoints = Math.min(userRewardPoints, Math.floor((packageData.basePrice * bookingData.numTravelers) * 0.2));
                                  setBookingData({...bookingData, pointsToUse: maxPoints});
                                }}
                                className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600"
                              >
                                Use Max
                              </button>
                            </div>
                            {bookingData.pointsToUse > 0 && (
                              <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1.5 font-semibold">
                                <FaMoneyBillWave className="text-green-600 flex-shrink-0" /> Discount: -{bookingData.pointsToUse} BDT
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Price per person:</span>
                          <span className="font-bold text-gray-900 dark:text-white">${packageData.basePrice}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Travelers:</span>
                          <span className="font-bold text-gray-900 dark:text-white">×{bookingData.numTravelers}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                          <span className="font-bold text-gray-900 dark:text-white">${(packageData.basePrice * bookingData.numTravelers).toLocaleString()}</span>
                        </div>
                        {bookingData.pointsToUse > 0 && (
                          <div className="flex justify-between mb-2 text-green-600 dark:text-green-400">
                            <span className="font-semibold">Points Discount:</span>
                            <span className="font-semibold">-${bookingData.pointsToUse}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-300 dark:border-gray-700 mt-2 pt-2 flex justify-between">
                          <span className="font-bold text-gray-900 dark:text-white">Total:</span>
                          <span className="font-bold text-2xl text-primary">
                            ${((packageData.basePrice * bookingData.numTravelers) - (bookingData.pointsToUse || 0)).toLocaleString()}
                          </span>
                        </div>
                        {bookingData.pointsToUse > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            You'll save ${bookingData.pointsToUse} with your reward points!
                          </p>
                        )}
                      </div>

                      <button 
                        onClick={handleBooking}
                        className="w-full py-4 bg-gradient-to-r from-primary to-green-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-primary transition-all shadow-lg"
                      >
                        Confirm Booking
                      </button>
                      <button 
                        onClick={() => setShowBookingForm(false)}
                        className="w-full py-3 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Trust Badges */}
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <FaShieldAlt className="text-green-500" />
                      <span>Secure payment & booking</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <FaCamera className="text-blue-500" />
                      <span>Photo memories included</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                      <FaHeart className="text-red-500" />
                      <span>Best price guarantee</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default TourDetailModal;
