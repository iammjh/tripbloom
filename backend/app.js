import { getPlatformStats } from './service/stats.service.js';
import KYC from './model/kyc.model.js';
import { isAdmin, requireDepartureAccess } from './service/access.service.js';
import mongoose from 'mongoose';
import { sendMessageController, getMessagesController, getBroadcastMessagesController, getBookingMessagesController, getConversationController } from './controller/message.controller.js';
import { Review } from './model/review.model.js';
import { TourPackage } from './model/tourPackage.model.js';
import { getSupportContactsController, getOperatorKycStatusesController } from './controller/communication.controller.js';
import { chatController } from './controller/assistant.controller.js';

import express from 'express';
import cors from 'cors';
import { ROLES, User } from './model/user.model.js';


import { signupController, loginController, requireRole, requireAuth, optionalAuth, requireSelfOrAdmin, requireSelf, getAllUsersController, listUsersController, createUserController, updateUserController, deactivateUserController, getSavedPackagesController, savePackageController, unsavePackageController, getUserController, updateProfileController, changePasswordController, awardSignupBonusController } from './controller/user.controller.js';
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
  getActivityLogOptionsController,
  updateUserRoleController,
  toggleUserSuspensionController,
  getOperatorsWithStatsController,
  moderateTourPackageController,
  deleteReviewController as adminDeleteReviewController,
  getPlatformMetricsController,
  getSystemSettingController,
  getAllSystemSettingsController,
  updateSystemSettingController,
  saveAllSystemSettingsController,
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
const uploadDir = path.resolve(process.env.KYC_UPLOAD_DIR || path.join(__dirname, 'uploads', 'kyc'));
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
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };
  const expected = mimeTypes[path.extname(file.originalname).toLowerCase()];
  cb(expected && file.mimetype === expected ? null : Object.assign(new Error('Only JPEG, PNG and PDF documents are allowed.'), { status: 400 }), Boolean(expected && file.mimetype === expected));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});




const app = express();
// Render and similar hosts put one proxy in front of the API; trusting it makes req.ip the visitor's address (used by the assistant's rate limit).
app.set('trust proxy', 1);


// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL || '',
  process.env.CORS_ORIGIN || '',
].filter(Boolean);

// Middleware (MUST be before routes)
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string') return res.status(400).json({ success: false, message: 'Query parameters must be text.' });
    if ((key.endsWith('Id') || ['userA', 'userB'].includes(key)) && value && !mongoose.isValidObjectId(value)) return res.status(400).json({ success: false, message: `Invalid ${key}.` });
  }
  for (const key of ['senderId', 'recipientId', 'receiverId', 'bookingId', 'tourId', 'customerId', 'packageId', 'groupDepartureId']) {
    if (req.body?.[key] != null && req.body[key] !== '' && !mongoose.isValidObjectId(req.body[key])) return res.status(400).json({ success: false, message: `Invalid ${key}.` });
  }
  next();
});
app.param(['userId', 'customerId', 'packageId', 'departureId', 'operatorId', 'bookingId', 'reviewId', 'paymentId', 'id'], (req, res, next, value) => {
  if (!mongoose.isValidObjectId(value)) return res.status(400).json({ success: false, message: 'Invalid resource ID.' });
  next();
});
// KYC must never fall through to public static serving, including malformed/nested paths.
app.use('/uploads/kyc', requireAuth, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.path.slice(1));
    if (!filename || path.basename(filename) !== filename || !/^kyc-[a-zA-Z0-9.-]+$/.test(filename)) return res.status(404).end();
    const record = await KYC.findOne({ documentImage: { $in: [`uploads/kyc/${filename}`, `/uploads/kyc/${filename}`] } }).select('user');
    if (!record || (!isAdmin(req.user) && String(record.user) !== req.user.id)) return res.status(404).end();
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(path.join(uploadDir, filename), error => { if (error && !res.headersSent) res.status(404).end(); });
  } catch { res.status(404).end(); }
});
// This repository has only KYC uploads. Unmatched/encoded paths cannot bypass ownership checks.
app.use('/uploads', (req, res) => res.status(404).end());

// Messaging endpoints
app.post('/api/messages', requireAuth, sendMessageController); // Send message (supports both booking and tour)
app.post('/api/messages/send', requireAuth, sendMessageController); // Send message (1-to-1 or broadcast)
app.get('/api/messages', requireAuth, getMessagesController); // Get messages for a tour or user
app.get('/api/messages/booking/:bookingId', requireAuth, getBookingMessagesController); // Get messages for a specific booking
app.get('/api/messages/broadcast', requireAuth, getBroadcastMessagesController); // Get broadcast messages for a tour
app.get('/api/messages/conversation', requireAuth, getConversationController); // Get 1:1 conversation between two users
// Operator dashboard endpoint
app.get('/api/operator/:operatorId/dashboard', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), getOperatorDashboardController);
app.get('/api/operator/:operatorId/profile', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), getOperatorProfileController);
app.put('/api/operator/:operatorId/profile', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), updateOperatorProfileController);
app.get('/api/support/contacts', requireAuth, getSupportContactsController);
app.get('/api/operator/kyc-statuses', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), getOperatorKycStatusesController);

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
// Admin user management endpoints
app.get('/api/admin/users', requireRole(ROLES.ADMIN), listUsersController); // List users with filters
app.post('/api/admin/users', requireRole(ROLES.ADMIN), createUserController); // Create user
app.put('/api/admin/users/:userId', requireRole(ROLES.ADMIN), updateUserController); // Update user info
app.delete('/api/admin/users/:userId', requireRole(ROLES.ADMIN), deactivateUserController); // Deactivate user
app.post('/api/admin/award-signup-bonus', requireRole(ROLES.ADMIN), awardSignupBonusController); // Award signup bonus to existing users

// Admin Dashboard & Analytics
app.get('/api/admin/dashboard', requireRole(ROLES.ADMIN), getAdminDashboardController); // Get admin dashboard overview
app.get('/api/admin/activity-logs/options', requireRole(ROLES.ADMIN), getActivityLogOptionsController); // Filter options: actions and administrators
app.get('/api/admin/activity-logs', requireRole(ROLES.ADMIN), getActivityLogsController); // Get activity logs
app.get('/api/admin/metrics', requireRole(ROLES.ADMIN), getPlatformMetricsController); // Get platform metrics

// Admin User Management (Enhanced)
app.put('/api/admin/users/:userId/role', requireRole(ROLES.ADMIN), updateUserRoleController); // Update user role
app.post('/api/admin/users/:userId/suspend', requireRole(ROLES.ADMIN), toggleUserSuspensionController); // Suspend/activate user
app.get('/api/admin/operators/stats', requireRole(ROLES.ADMIN), getOperatorsWithStatsController); // Get operators with stats

// Admin Content Moderation
app.post('/api/admin/packages/:packageId/moderate', requireRole(ROLES.ADMIN), moderateTourPackageController); // Approve/reject package
app.delete('/api/admin/reviews/:reviewId', requireRole(ROLES.ADMIN), adminDeleteReviewController); // Delete review (Admin moderation)

// Admin System Settings
app.get('/api/admin/settings', requireRole(ROLES.ADMIN), getAllSystemSettingsController); // Get all system settings
app.get('/api/admin/settings/:key', requireRole(ROLES.ADMIN), getSystemSettingController); // Get system setting by key
app.put('/api/admin/settings/:key', requireRole(ROLES.ADMIN), updateSystemSettingController); // Update system setting
app.post('/api/admin/settings', requireRole(ROLES.ADMIN), saveAllSystemSettingsController); // Bulk update settings

// Admin Announcements
app.post('/api/admin/announcements', requireRole(ROLES.ADMIN), createAnnouncementController); // Create announcement
app.get('/api/admin/announcements', requireRole(ROLES.ADMIN), getActiveAnnouncementsController); // Get announcements
app.put('/api/admin/announcements/:announcementId', requireRole(ROLES.ADMIN), updateAnnouncementController); // Update announcement
app.delete('/api/admin/announcements/:announcementId', requireRole(ROLES.ADMIN), deleteAnnouncementController); // Delete announcement

// Public announcements endpoint (for customers/operators)
app.get('/api/announcements', getActiveAnnouncementsController); // Get active announcements for users

// User profile routes
app.get('/api/users/:userId', requireAuth, requireSelfOrAdmin, getUserController); // Get user by ID
app.put('/api/users/:userId', requireAuth, requireSelfOrAdmin, updateProfileController); // Update own profile
app.put('/api/users/:userId/password', requireAuth, requireSelf, changePasswordController); // Change password

import { createTourPackageController, updateTourPackageController, setTourPackageActiveController, getTourPackageController, listTourPackagesController, searchTourPackagesController, deleteTourPackageController, getPublicTourPackageController } from './controller/tourPackage.controller.js';
// ...existing code...

// Tour package management endpoints
app.post('/api/admin/packages', requireRole(ROLES.ADMIN), createTourPackageController); // Create package
app.put('/api/admin/packages/:packageId', requireRole(ROLES.ADMIN), updateTourPackageController); // Update package
app.patch('/api/admin/packages/:packageId/active', requireRole(ROLES.ADMIN), setTourPackageActiveController); // Activate/deactivate package
app.get('/api/admin/packages/:packageId', requireRole(ROLES.ADMIN), getTourPackageController); // Get package by ID
app.get('/api/admin/packages', requireRole(ROLES.ADMIN), listTourPackagesController); // List packages
app.delete('/api/admin/packages/:packageId', requireRole(ROLES.ADMIN), deleteTourPackageController); // Delete package

// Customer-facing package search/filter endpoint
app.get('/api/packages/search', searchTourPackagesController); // Search and filter packages for customers
app.post('/api/assistant/chat', chatController); // Customer AI assistant (public; rate-limited per client in the controller)
app.get('/api/packages/:packageId', getPublicTourPackageController);


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
app.post('/api/admin/group-departures', requireRole(ROLES.ADMIN), createGroupDepartureController); // Create group departure
app.put('/api/admin/group-departures/:departureId', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), updateGroupDepartureController); // Update group departure
app.get('/api/admin/group-departures', requireRole(ROLES.ADMIN), listGroupDeparturesController); // List group departures
app.get('/api/admin/group-departures/:departureId', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), getGroupDepartureByIdController); // Get single departure
app.delete('/api/admin/group-departures/:departureId', requireRole(ROLES.ADMIN), deleteGroupDepartureController); // Delete departure
app.patch('/api/admin/group-departures/:departureId/status', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), setGroupDepartureStatusController); // Set group departure status

// Operator assignment endpoints for group departures
app.post('/api/group-departure/:departureId/assign-operators', requireRole(ROLES.ADMIN), assignOperatorsToDepartureController);
app.get('/api/group-departure/:departureId/operators', requireAuth, listOperatorsForDepartureController);
app.post('/api/group-departure/:departureId/reassign-operator', requireRole(ROLES.ADMIN), reassignOperatorForDepartureController);
app.get('/api/group-departure/operator/:operatorId/future', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), findFutureDeparturesForOperatorController);
app.post('/api/group-departure/operator/:operatorId/remove-future', requireRole(ROLES.ADMIN), removeOperatorFromFutureDeparturesController);

// New endpoints for individual operator add/remove
app.post('/api/admin/group-departures/:departureId/operators', requireRole(ROLES.ADMIN), addOperatorToDepartureController);
app.delete('/api/admin/group-departures/:departureId/operators/:operatorId', requireRole(ROLES.ADMIN), removeOperatorFromDepartureController);

// Seat map endpoints for group departures
import { getSeatMapController, updateSeatMapController, checkDepartureAvailabilityController, getAvailableDeparturesForPackageController } from './controller/groupDeparture.controller.js';
app.get('/api/group-departure/:departureId/seat-map', requireAuth, getSeatMapController);
app.put('/api/group-departure/:departureId/seat-map', requireAuth, updateSeatMapController);

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
  autoCompleteBookingsController,
  updateOperatorNotesController,
  listPendingPaymentsController,
  verifyPaymentController
} from './controller/booking.controller.js';
app.post('/api/bookings', requireAuth, createBookingController); // Create booking
app.get('/api/bookings/:bookingId', requireAuth, getBookingByIdController); // Get booking by ID
app.get('/api/bookings', requireAuth, listBookingsController); // List bookings with filters
app.put('/api/bookings/:bookingId', requireAuth, updateBookingController); // Update booking
app.patch('/api/bookings/:bookingId/operator-notes', requireRole(ROLES.ADMIN, ROLES.TOUR_OPERATOR), updateOperatorNotesController);
app.post('/api/bookings/:bookingId/cancel', requireAuth, cancelBookingController); // Cancel booking
app.post('/api/bookings/:bookingId/request-date-change', requireAuth, requestDateChangeController); // Request date change
app.post('/api/bookings/:bookingId/payment', requireAuth, addPaymentController); // Add payment
app.get('/api/customers/:customerId/stats', requireAuth, getCustomerStatsController); // Customer stats
app.post('/api/bookings/:bookingId/complete', requireRole(ROLES.ADMIN), completeBookingController); // Mark booking complete
app.post('/api/bookings/:bookingId/checkin', requireAuth, checkInBookingController); // Customer check-in
app.post('/api/admin/bookings/cancel-unpaid', requireRole(ROLES.ADMIN), cancelUnpaidBookingsController); // Cancel unpaid expired bookings
app.post('/api/admin/bookings/:bookingId/refund', requireRole(ROLES.ADMIN), processRefundController); // Process refund (Admin)
app.post('/api/admin/bookings/:bookingId/approve-date-change', requireRole(ROLES.ADMIN), approveDateChangeController); // Approve date change (Admin)
app.post('/api/admin/bookings/:bookingId/reject-date-change', requireRole(ROLES.ADMIN), rejectDateChangeController); // Reject date change (Admin)
// Admin: trigger auto-complete job on demand
app.post('/api/admin/bookings/auto-complete', requireRole(ROLES.ADMIN), autoCompleteBookingsController);

app.get('/api/admin/payments', requireRole(ROLES.ADMIN), listPendingPaymentsController);
app.post('/api/admin/bookings/:bookingId/payments/:paymentId/verify', requireRole(ROLES.ADMIN), verifyPaymentController);

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
app.post('/api/reviews', requireAuth, createReviewController); // Create review
app.get('/api/reviews/:reviewId', optionalAuth, getReviewByIdController); // Get review by ID
app.get('/api/reviews', optionalAuth, listReviewsController); // List reviews with filters
app.put('/api/reviews/:reviewId', requireAuth, updateReviewController); // Update review
app.delete('/api/reviews/:reviewId', requireAuth, deleteReviewController); // Delete review
app.patch('/api/reviews/:reviewId/moderate', requireRole(ROLES.ADMIN), moderateReviewController); // Moderate review (admin)
app.post('/api/reviews/:reviewId/helpful', requireAuth, markReviewHelpfulController); // Mark review helpful
app.get('/api/packages/:packageId/rating-stats', getPackageRatingStatsController); // Package rating stats
app.get('/api/customers/:customerId/packages/:packageId/review', requireAuth, requireSelfOrAdmin, getCustomerReviewForPackageController); // Customer's review for package

// Statistics endpoints
import { getPlatformStatsController, getBookingStatsController } from './controller/stats.controller.js';
import { createContactController, listContactsController, getContactController, markContactHandledController } from './controller/contact.controller.js';
app.get('/api/stats/platform', getPlatformStatsController); // Get overall platform stats
app.get('/api/stats/bookings', requireRole(ROLES.ADMIN), getBookingStatsController); // Get booking statistics

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
app.get('/api/users', requireRole(ROLES.ADMIN), getAllUsersController);

// User saved packages endpoints
app.get('/api/users/:userId/saved', requireAuth, requireSelfOrAdmin, getSavedPackagesController);
app.post('/api/users/:userId/save/:packageId', requireAuth, requireSelfOrAdmin, savePackageController);
app.delete('/api/users/:userId/save/:packageId', requireAuth, requireSelfOrAdmin, unsavePackageController);




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


app.get('/api/reviews/package/:packageId', (req, res, next) => {
  req.query.packageId = req.params.packageId;
  return listReviewsController(req, res, next);
});

// KYC endpoints
app.post('/api/kyc/submit', requireAuth, upload.single('documentImage'), submitKYCController); // Submit KYC (requires auth)
app.get('/api/kyc/my-kyc', requireAuth, getMyKYCController); // Get user's own KYC
app.get('/api/admin/kyc', requireRole(ROLES.ADMIN), getAllKYCController); // Get all KYC submissions (admin only)
app.put('/api/admin/kyc/:id/verify', requireRole(ROLES.ADMIN), verifyKYCController); // Verify KYC (admin only)

// Statistics endpoint for landing page
app.get('/api/stats', async (req, res) => {
  const result = await getPlatformStats();
  if (result.error) return res.status(500).json({ success: false, error: result.error });
  res.json({ success: true, stats: { packages: result.stats.totalPackages, customers: result.stats.totalCustomers, reviews: result.stats.totalReviews, destinations: result.stats.totalDestinations } });
});

for (const layer of app._router.stack) {
  if (!layer.route) continue;
  for (const handler of layer.route.stack) {
    const original = handler.handle;
    if (original.constructor.name === 'AsyncFunction') handler.handle = (req, res, next) => Promise.resolve(original(req, res, next)).catch(next);
  }
}
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status || (error.name === 'CastError' || error.name === 'ValidationError' ? 400 : 500)).json({ success: false, message: error.status ? error.message : 'Unable to process the request.' });
});
export default app;
