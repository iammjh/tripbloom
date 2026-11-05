import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { notify } from '../utils/notifyStore.js';
import Modal from './ui/Modal.jsx';
import TourGallery from './tour-detail/TourGallery.jsx';
import TourFacts from './tour-detail/TourFacts.jsx';
import TourInfo from './tour-detail/TourInfo.jsx';
import BookingCard from './tour-detail/BookingCard.jsx';
import { getAvailableDepartures, getBookingSchedule } from '../api/catalog';


const TourDetailModal = ({ isOpen, onClose, packageData, userRole = 'CUSTOMER' }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isCustomBooking, setIsCustomBooking] = useState(false);
  const [userRewardPoints, setUserRewardPoints] = useState(0);
  const [availableDepartures, setAvailableDepartures] = useState([]);
  const [departuresError, setDeparturesError] = useState('');
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

  // Load what the booking form needs each time a tour opens. The dialog handles background scroll.
  useEffect(() => {
    if (isOpen && packageData) {
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
    }
  }, [isOpen, packageData?._id]);

  if (!isOpen || !packageData) return null;

  const fetchAvailableDepartures = async () => {
    setDeparturesError('');
    setAvailableDepartures([]);
    setSelectedDepartureId('');
    try {
      const departures = await getAvailableDepartures(packageData._id);
      
      if (departures) {
        // Filter future departures with available seats and sort by start date
        const futureDepartures = departures
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
      setDeparturesError('Available dates could not be loaded. Please close this tour and try again.');
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
      notify.message('KYC verification is required to book international tour packages. Please complete your KYC verification in your profile settings.');
      return;
    }
    
    // Validation
    if (packageData.type === 'GROUP' && !selectedDepartureId) {
      notify.message('Please select a departure date for this group tour.');
      return;
    }
    
    if (packageData.type !== 'GROUP' && !bookingData.startDate) {
      notify.message('Please select a start date for your tour.');
      return;
    }

    if (!bookingData.numTravelers || bookingData.numTravelers < 1) {
      notify.message('Please specify number of travelers.');
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
          notify.message(`Please fill in all details for Traveler ${i + 1} (Name, Age, Phone)`);
          return;
        }
      }
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      notify.message('Please log in to make a booking.');
      return;
    }

    try {
      const selectedDeparture = availableDepartures.find(dep => dep._id === selectedDepartureId);
      const { startDate, endDate, totalAmount } = getBookingSchedule(
        packageData, selectedDeparture, bookingData.startDate, bookingData.numTravelers
      );

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
        notify.message('Booking request submitted successfully! You can view and manage your booking in the dashboard.');
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
        notify.message(response.data.message || 'Failed to submit booking.');
      }
    } catch (error) {
      console.error('Booking error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit booking. Please try again.';
      notify.message(errorMessage);
    }
  };

  const handleCustomize = () => {
    // For personal tours, allow customization - open booking form with custom mode
    setIsCustomBooking(true);
    setShowBookingForm(true);
  };

  const isGroupTour = packageData.type === 'GROUP';
  const selectedDeparture = availableDepartures.find(dep => dep._id === selectedDepartureId);
  const pricePerTraveler = isGroupTour && selectedDeparture
    ? selectedDeparture.pricePerPerson : packageData.basePrice;
  const canCustomize = !isGroupTour && userRole === 'CUSTOMER';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={packageData.title}
      description={`${packageData.defaultDays} days, ${packageData.defaultNights} nights · ${isGroupTour ? 'Group tour' : 'Personal tour'}`}
      size="xl"
      rootClassName="dark"
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <TourGallery
            title={packageData.title}
            images={images}
            activeImageIndex={activeImageIndex}
            setActiveImageIndex={setActiveImageIndex}
            prevImage={prevImage}
            nextImage={nextImage}
          />
          <TourFacts packageData={packageData} isGroupTour={isGroupTour} />
          <TourInfo packageData={packageData} />
        </div>

        <div className="lg:col-span-2">
          <BookingCard
            userRole={userRole}
            availableDepartures={availableDepartures}
            bookingData={bookingData}
            canCustomize={canCustomize}
            departuresError={departuresError}
            handleBooking={handleBooking}
            handleCustomize={handleCustomize}
            isCustomBooking={isCustomBooking}
            isFirstTravelerSelf={isFirstTravelerSelf}
            isGroupTour={isGroupTour}
            kycLoading={kycLoading}
            kycStatus={kycStatus}
            packageData={packageData}
            pricePerTraveler={pricePerTraveler}
            selectedDepartureId={selectedDepartureId}
            setBookingData={setBookingData}
            setIsCustomBooking={setIsCustomBooking}
            setIsFirstTravelerSelf={setIsFirstTravelerSelf}
            setSelectedDepartureId={setSelectedDepartureId}
            setShowBookingForm={setShowBookingForm}
            showBookingForm={showBookingForm}
            userProfileData={userProfileData}
            userRewardPoints={userRewardPoints}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TourDetailModal;
