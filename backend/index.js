import { sendMessageController, getMessagesController, getBroadcastMessagesController, getBookingMessagesController, getConversationController } from './controller/message.controller.js';
import { Review } from './model/review.model.js';
import { TourPackage } from './model/tourPackage.model.js';

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
// MongoDB connection

const mongoUri = process.env.MONGODB_URI;
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

import express from 'express';
import cors from 'cors';
import { ROLES, User } from './model/user.model.js';
import cron from 'node-cron';
import { autoCompletePassedBookings } from './service/booking.service.js';

// Remove username index if it exists (for migration from old schema)
User.collection.dropIndex('username_1').catch(() => {});

import { signupController, loginController, requireRole, requireAuth, getAllUsersController, listUsersController, createUserController, updateUserController, deactivateUserController, getSavedPackagesController, savePackageController, unsavePackageController, getUserController, updateProfileController, changePasswordController, awardSignupBonusController } from './controller/user.controller.js';
import { getOperatorDashboardController, getOperatorProfileController, updateOperatorProfileController } from './controller/operator.controller.js';
import {
  submitKYCController,
  getMyKYCController,
  verifyKYCController,
  getAllKYCController
} from './controller/kyc.controller.js';
import {
  getAdminDashboardController,
  getActivityLogsController,
  updateUserRoleController,
  toggleUserSuspensionController,
  getOperatorsWithStatsController,
  moderateTourPackageController,
  deleteReviewController as adminDeleteReviewController,
  getPlatformMetricsController,
  getSystemSettingController,
  getAllSystemSettingsController,
  updateSystemSettingController,
  createAnnouncementController,
  getActiveAnnouncementsController,
  updateAnnouncementController,
  deleteAnnouncementController
} from './controller/admin.controller.js';

// Multer configuration for file uploads
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads', 'kyc');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for KYC document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'kyc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});




const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL || '', // Add your Vercel URL here
].filter(Boolean);

// Middleware (MUST be before routes)
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Messaging endpoints
app.post('/api/messages', sendMessageController); // Send message (supports both booking and tour)
app.post('/api/messages/send', sendMessageController); // Send message (1-to-1 or broadcast)
app.get('/api/messages', getMessagesController); // Get messages for a tour or user
app.get('/api/messages/booking/:bookingId', getBookingMessagesController); // Get messages for a specific booking
app.get('/api/messages/broadcast', getBroadcastMessagesController); // Get broadcast messages for a tour
app.get('/api/messages/conversation', getConversationController); // Get 1:1 conversation between two users
// Operator dashboard endpoint
app.get('/api/operator/:operatorId/dashboard', getOperatorDashboardController);
app.get('/api/operator/:operatorId/profile', getOperatorProfileController);
app.put('/api/operator/:operatorId/profile', updateOperatorProfileController);

// User signup endpoint
app.post('/api/signup', signupController);

// User login endpoint
app.post('/api/login', loginController);

// Example protected route (admin only)
app.post('/api/admin-only', requireRole(ROLES.ADMIN), (req, res) => {
  res.json({ success: true, message: 'Welcome, admin!' });
});

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'TripBloom API is running' });
});

// Admin user management endpoints
app.get('/api/admin/users', listUsersController); // List users with filters
app.post('/api/admin/users', createUserController); // Create user
app.put('/api/admin/users/:userId', updateUserController); // Update user info
app.delete('/api/admin/users/:userId', deactivateUserController); // Deactivate user
app.post('/api/admin/award-signup-bonus', awardSignupBonusController); // Award signup bonus to existing users

// Admin Dashboard & Analytics
app.get('/api/admin/dashboard', getAdminDashboardController); // Get admin dashboard overview
app.get('/api/admin/activity-logs', getActivityLogsController); // Get activity logs
app.get('/api/admin/metrics', getPlatformMetricsController); // Get platform metrics

// Admin User Management (Enhanced)
app.put('/api/admin/users/:userId/role', updateUserRoleController); // Update user role
app.post('/api/admin/users/:userId/suspend', toggleUserSuspensionController); // Suspend/activate user
app.get('/api/admin/operators/stats', getOperatorsWithStatsController); // Get operators with stats

// Admin Content Moderation
app.post('/api/admin/packages/:packageId/moderate', moderateTourPackageController); // Approve/reject package
app.delete('/api/admin/reviews/:reviewId', adminDeleteReviewController); // Delete review (Admin moderation)

// Admin System Settings
app.get('/api/admin/settings', getAllSystemSettingsController); // Get all system settings
app.get('/api/admin/settings/:key', getSystemSettingController); // Get system setting by key
app.put('/api/admin/settings/:key', updateSystemSettingController); // Update system setting

// Admin Announcements
app.post('/api/admin/announcements', createAnnouncementController); // Create announcement
app.get('/api/admin/announcements', getActiveAnnouncementsController); // Get announcements
app.put('/api/admin/announcements/:announcementId', updateAnnouncementController); // Update announcement
app.delete('/api/admin/announcements/:announcementId', deleteAnnouncementController); // Delete announcement

// Public announcements endpoint (for customers/operators)
app.get('/api/announcements', getActiveAnnouncementsController); // Get active announcements for users

// User profile routes
app.get('/api/users/:userId', getUserController); // Get user by ID
app.put('/api/users/:userId', updateProfileController); // Update own profile
app.put('/api/users/:userId/password', changePasswordController); // Change password

import { createTourPackageController, updateTourPackageController, setTourPackageActiveController, getTourPackageController, listTourPackagesController, searchTourPackagesController, deleteTourPackageController } from './controller/tourPackage.controller.js';
// ...existing code...

// Tour package management endpoints
app.post('/api/admin/packages', createTourPackageController); // Create package
app.put('/api/admin/packages/:packageId', updateTourPackageController); // Update package
app.patch('/api/admin/packages/:packageId/active', setTourPackageActiveController); // Activate/deactivate package
app.get('/api/admin/packages/:packageId', getTourPackageController); // Get package by ID
app.get('/api/admin/packages', listTourPackagesController); // List packages
app.delete('/api/admin/packages/:packageId', deleteTourPackageController); // Delete package

// Customer-facing package search/filter endpoint
app.get('/api/packages/search', searchTourPackagesController); // Search and filter packages for customers


import { createGroupDepartureController, updateGroupDepartureController, listGroupDeparturesController, getGroupDepartureByIdController, deleteGroupDepartureController, setGroupDepartureStatusController } from './controller/groupDeparture.controller.js';
import {
  assignOperatorsToDepartureController,
  listOperatorsForDepartureController,
  reassignOperatorForDepartureController,
  findFutureDeparturesForOperatorController,
  removeOperatorFromFutureDeparturesController,
  addOperatorToDepartureController,
  removeOperatorFromDepartureController
} from './controller/groupDeparture.controller.js';
// Group departure management endpoints
app.post('/api/admin/group-departures', createGroupDepartureController); // Create group departure
app.put('/api/admin/group-departures/:departureId', updateGroupDepartureController); // Update group departure
app.get('/api/admin/group-departures', listGroupDeparturesController); // List group departures
app.get('/api/admin/group-departures/:departureId', getGroupDepartureByIdController); // Get single departure
app.delete('/api/admin/group-departures/:departureId', deleteGroupDepartureController); // Delete departure
app.patch('/api/admin/group-departures/:departureId/status', setGroupDepartureStatusController); // Set group departure status

// Operator assignment endpoints for group departures
app.post('/api/group-departure/:departureId/assign-operators', assignOperatorsToDepartureController);
app.get('/api/group-departure/:departureId/operators', listOperatorsForDepartureController);
app.post('/api/group-departure/:departureId/reassign-operator', reassignOperatorForDepartureController);
app.get('/api/group-departure/operator/:operatorId/future', findFutureDeparturesForOperatorController);
app.post('/api/group-departure/operator/:operatorId/remove-future', removeOperatorFromFutureDeparturesController);

// New endpoints for individual operator add/remove
app.post('/api/admin/group-departures/:departureId/operators', addOperatorToDepartureController);
app.delete('/api/admin/group-departures/:departureId/operators/:operatorId', removeOperatorFromDepartureController);

// Seat map endpoints for group departures
import { getSeatMapController, updateSeatMapController, checkDepartureAvailabilityController, getAvailableDeparturesForPackageController } from './controller/groupDeparture.controller.js';
app.get('/api/group-departure/:departureId/seat-map', getSeatMapController);
app.put('/api/group-departure/:departureId/seat-map', updateSeatMapController);

// Customer-facing departure availability endpoints
app.get('/api/departures/:departureId/availability', checkDepartureAvailabilityController); // Check single departure availability
app.get('/api/packages/:packageId/departures/available', getAvailableDeparturesForPackageController); // Get all available departures for package

// Booking endpoints (customer)
import {
  createBookingController,
  getBookingByIdController,
  listBookingsController,
  updateBookingController,
  cancelBookingController,
  addPaymentController,
  getCustomerStatsController,
  completeBookingController,
  checkInBookingController,
  cancelUnpaidBookingsController,
  processRefundController,
  requestDateChangeController,
  approveDateChangeController,
  rejectDateChangeController,
  autoCompleteBookingsController
} from './controller/booking.controller.js';
app.post('/api/bookings', createBookingController); // Create booking
app.get('/api/bookings/:bookingId', getBookingByIdController); // Get booking by ID
app.get('/api/bookings', listBookingsController); // List bookings with filters
app.put('/api/bookings/:bookingId', updateBookingController); // Update booking
app.post('/api/bookings/:bookingId/cancel', cancelBookingController); // Cancel booking
app.post('/api/bookings/:bookingId/request-date-change', requestDateChangeController); // Request date change
app.post('/api/bookings/:bookingId/payment', addPaymentController); // Add payment
app.get('/api/customers/:customerId/stats', getCustomerStatsController); // Customer stats
app.post('/api/bookings/:bookingId/complete', completeBookingController); // Mark booking complete
app.post('/api/bookings/:bookingId/checkin', checkInBookingController); // Customer check-in
app.post('/api/admin/bookings/cancel-unpaid', cancelUnpaidBookingsController); // Cancel unpaid expired bookings
app.post('/api/admin/bookings/:bookingId/refund', processRefundController); // Process refund (Admin)
app.post('/api/admin/bookings/:bookingId/approve-date-change', approveDateChangeController); // Approve date change (Admin)
app.post('/api/admin/bookings/:bookingId/reject-date-change', rejectDateChangeController); // Reject date change (Admin)
// Admin: trigger auto-complete job on demand
app.post('/api/admin/bookings/auto-complete', requireRole(ROLES.ADMIN), autoCompleteBookingsController);

// Review endpoints (customer)
import {
  createReviewController,
  getReviewByIdController,
  listReviewsController,
  updateReviewController,
  deleteReviewController,
  moderateReviewController,
  markReviewHelpfulController,
  getPackageRatingStatsController,
  getCustomerReviewForPackageController
} from './controller/review.controller.js';
app.post('/api/reviews', createReviewController); // Create review
app.get('/api/reviews/:reviewId', getReviewByIdController); // Get review by ID
app.get('/api/reviews', listReviewsController); // List reviews with filters
app.put('/api/reviews/:reviewId', updateReviewController); // Update review
app.delete('/api/reviews/:reviewId', deleteReviewController); // Delete review
app.patch('/api/reviews/:reviewId/moderate', moderateReviewController); // Moderate review (admin)
app.post('/api/reviews/:reviewId/helpful', markReviewHelpfulController); // Mark review helpful
app.get('/api/packages/:packageId/rating-stats', getPackageRatingStatsController); // Package rating stats
app.get('/api/customers/:customerId/packages/:packageId/review', getCustomerReviewForPackageController); // Customer's review for package

// Statistics endpoints
import { getPlatformStatsController, getBookingStatsController } from './controller/stats.controller.js';
import { createContactController, listContactsController, getContactController, markContactHandledController } from './controller/contact.controller.js';
app.get('/api/stats/platform', getPlatformStatsController); // Get overall platform stats
app.get('/api/stats/bookings', getBookingStatsController); // Get booking statistics

// Contact form endpoint (store submissions)
app.post('/api/contact', createContactController);
// Admin: list and manage contact messages
app.get('/api/admin/contacts', requireRole(ROLES.ADMIN), listContactsController);
app.get('/api/admin/contacts/:id', requireRole(ROLES.ADMIN), getContactController);
app.post('/api/admin/contacts/:id/handled', requireRole(ROLES.ADMIN), markContactHandledController);

// Newsletter subscription
app.post('/api/newsletter', (req, res) => {
  const { email } = req.body;
  console.log('Newsletter subscription:', email);
  res.json({ success: true, message: 'Successfully subscribed to TripBloom newsletter!' });
});

// Get all users (for testing/demo only)
app.get('/api/users', getAllUsersController);

// User saved packages endpoints
app.get('/api/users/:userId/saved', getSavedPackagesController);
app.post('/api/users/:userId/save/:packageId', savePackageController);
app.delete('/api/users/:userId/save/:packageId', unsavePackageController);




// Popular destinations (mock data)
app.get('/api/destinations', (req, res) => {
  const destinations = [
    { id: 1, name: 'Bali Paradise', duration: '7 Days', price: 1299, image: 'bali.jpg', type: 'International' },
    { id: 2, name: 'Swiss Alps Adventure', duration: '10 Days', price: 2499, image: 'swiss.jpg', type: 'International' },
    { id: 3, name: 'Maldives Retreat', duration: '5 Days', price: 1899, image: 'maldives.jpg', type: 'International' },
    { id: 4, name: 'Santorini Sunset Tour', duration: '6 Days', price: 1599, image: 'santorini.jpg', type: 'International' },
  ];
  res.json(destinations);
});

// Tour packages
app.get('/api/packages', (req, res) => {
  const packages = [
    { id: 1, tier: 'Silver', price: 499, features: ['Standard Hotels', 'Basic Transport', 'Breakfast Included'] },
    { id: 2, tier: 'Gold', price: 899, features: ['3-Star Hotels', 'AC Transport', 'All Meals', 'Local Guide'] },
    { id: 3, tier: 'Platinum', price: 1499, features: ['4-Star Hotels', 'Premium Transport', 'All Meals', 'Expert Guide', 'Activities'] },
    { id: 4, tier: 'Diamond Elite', price: 2999, features: ['5-Star Resorts', 'Luxury Transport', 'Fine Dining', 'Personal Concierge', 'VIP Experiences'] },
  ];
  res.json(packages);
});


// Reviews endpoints
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({ status: 'APPROVED' })
      .populate('customerId', 'fullName email')
      .populate('packageId', 'title')
      .sort({ createdAt: -1 })
      .limit(20);
    
    const formattedReviews = reviews.map(review => ({
      id: review._id,
      name: review.customerId?.fullName || 'Anonymous',
      rating: review.rating,
      comment: review.comment,
      avatar: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 99) + 1}.jpg`,
      packageName: review.packageId?.title,
      verified: review.verified,
      createdAt: review.createdAt
    }));
    
    res.json(formattedReviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.get('/api/reviews/package/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;
    const reviews = await Review.find({ 
      packageId, 
      status: 'APPROVED' 
    })
      .populate('customerId', 'fullName')
      .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching package reviews:', error);
    res.status(500).json({ error: 'Failed to fetch package reviews' });
  }
});

// KYC endpoints
app.post('/api/kyc/submit', requireAuth, upload.single('documentImage'), submitKYCController); // Submit KYC (requires auth)
app.get('/api/kyc/my-kyc', requireAuth, getMyKYCController); // Get user's own KYC
app.get('/api/admin/kyc', requireRole(ROLES.ADMIN), getAllKYCController); // Get all KYC submissions (admin only)
app.put('/api/admin/kyc/:id/verify', requireRole(ROLES.ADMIN), verifyKYCController); // Verify KYC (admin only)

// Statistics endpoint for landing page
app.get('/api/stats', async (req, res) => {
  try {
    const [totalPackages, totalUsers, totalReviews] = await Promise.all([
      TourPackage.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'CUSTOMER' }),
      Review.countDocuments({ status: 'APPROVED' })
    ]);
    
    res.json({
      success: true,
      stats: {
        packages: totalPackages,
        customers: totalUsers,
        reviews: totalReviews,
        destinations: 50 // Can be calculated from package destinations
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch statistics',
      stats: { packages: 0, customers: 0, reviews: 0, destinations: 0 }
    });
  }
});
// Start server - MUST BE LAST
// Schedule: run hourly at minute 0 to auto-complete passed bookings
cron.schedule('0 * * * *', async () => {
  console.log('[Scheduler] Running auto-complete job for bookings');
  try {
    const res = await autoCompletePassedBookings();
    console.log(`[Scheduler] Auto-complete finished: ${res.completedCount || 0} bookings completed`);
  } catch (err) {
    console.error('[Scheduler] Error running auto-complete job:', err);
  }
});
app.listen(PORT, () => {
  console.log(`🌸 TripBloom server running on port ${PORT}`);
});