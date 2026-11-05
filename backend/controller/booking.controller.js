import { listPendingPayments, verifyManualPayment } from '../service/manualPayment.service.js';
// booking.controller.js
import {
  createBooking,
  getBookingById,
  listBookings,
  updateBooking,
  cancelBooking,
  addPayment,
  getCustomerBookingStats,
  completeBooking,
  cancelUnpaidExpiredBookings,
  processRefund,
  requestDateChange,
  approveDateChange,
  rejectDateChange
} from '../service/booking.service.js';
import { autoCompletePassedBookings } from '../service/booking.service.js';
import { checkInBooking } from '../service/booking.service.js';
import { updateOperatorNotes } from '../service/booking.service.js';
import { GroupDeparture } from '../model/groupDeparture.model.js';

const rolesFor = user => (user?.roles || []).map(role => role.toLowerCase());
const isOperatorRole = roles => roles.includes('operator') || roles.includes('tour_operator');

async function isBookingOperator(booking, userId) {
  const departureId = booking.groupDepartureId?._id || booking.groupDepartureId;
  if (departureId) return Boolean(await GroupDeparture.exists({ _id: departureId, 'operators.operatorId': userId }));
  return (booking.assignedOperator?._id || booking.assignedOperator)?.toString() === userId;
}

function visibleBooking(booking, user, includeOperatorNotes = false) {
  const roles = rolesFor(user);
  if (roles.includes('admin') || includeOperatorNotes) return booking;
  const value = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
  delete value.operatorNotes;
  return value;
}

// Create a new booking
export async function createBookingController(req, res) {
  const {
    customerId,
    packageId,
    bookingType,
    groupDepartureId,
    startDate,
    endDate,
    numTravelers,
    travelers,
    totalAmount,
    currency,
    reservedSeats,
    customizations
  } = req.body;

  // Validate required fields
  if (!customerId || !packageId || !bookingType || !startDate || !endDate || !numTravelers || !travelers || !totalAmount) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  // BOLA Check: Customers can only create bookings for themselves
  const user = req.user;
  const userRoles = user.roles || [];
  const isAdmin = userRoles.map(r => r.toLowerCase()).includes('admin');
  if (!isAdmin && customerId !== user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: cannot create booking for another user'
    });
  }

  const result = await createBooking({
    customerId,
    packageId,
    bookingType,
    groupDepartureId,
    startDate,
    endDate,
    numTravelers,
    travelers,
    totalAmount,
    currency,
    reservedSeats,
    customizations
  });

  if (result.error) {
    return res.status(result.status || 400).json({
      success: false,
      message: result.error
    });
  }

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    booking: visibleBooking(result.booking, req.user)
  });
}

// Get booking by ID
export async function getBookingByIdController(req, res) {
  const { bookingId } = req.params;

  const result = await getBookingById(bookingId);

  if (result.error) {
    return res.status(404).json({
      success: false,
      message: result.error
    });
  }

  // BOLA Check: Customers can only view their own bookings
  const booking = result.booking;
  const user = req.user;
  const userRoles = user.roles || [];
  const isAdmin = userRoles.map(r => r.toLowerCase()).includes('admin');
  const isOperator = userRoles.map(r => r.toLowerCase()).includes('operator') || userRoles.map(r => r.toLowerCase()).includes('tour_operator');
  const isOwner = booking.customerId?._id?.toString() === user.id || booking.customerId?.toString() === user.id;
  const isAssignedOperator = isOperator && await isBookingOperator(booking, user.id);

  if (!isAdmin && !isOwner && !(isOperator && isAssignedOperator)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: access to this booking is restricted.'
    });
  }

  res.json({
    success: true,
    booking: visibleBooking(result.booking, req.user, isAssignedOperator)
  });
}

// List bookings with filters
export async function listBookingsController(req, res) {
  const {
    customerId,
    packageId,
    groupDepartureId,
    status,
    bookingType,
    startDate,
    endDate,
    assignedOperator
  } = req.query;

  // BOLA Check: Customers can only list their own bookings
  const user = req.user;
  const userRoles = user.roles || [];
  const isAdmin = userRoles.map(r => r.toLowerCase()).includes('admin');
  const isOperator = userRoles.map(r => r.toLowerCase()).includes('operator') || userRoles.map(r => r.toLowerCase()).includes('tour_operator');

  let queryCustomerId = customerId;
  if (!isAdmin && !isOperator) {
    queryCustomerId = user.id;
  }

  const result = await listBookings({
    customerId: queryCustomerId,
    packageId,
    groupDepartureId,
    status,
    bookingType,
    startDate,
    endDate,
    operatorId: !isAdmin && isOperator ? user.id : undefined,
    assignedOperator: isAdmin ? assignedOperator : undefined
  });

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    bookings: result.bookings.map(booking => visibleBooking(booking, user, isOperator)),
    count: result.bookings.length
  });
}

// Update booking
export async function updateBookingController(req, res) {
  const { bookingId } = req.params;
  const { travelers, operatorNotes } = req.body;

  // BOLA Check: Customers can only update their own bookings
  const bookingResult = await getBookingById(bookingId);
  if (bookingResult.error) {
    return res.status(404).json({ success: false, message: bookingResult.error });
  }
  const booking = bookingResult.booking;
  const user = req.user;
  const userRoles = user.roles || [];
  const isAdmin = userRoles.map(r => r.toLowerCase()).includes('admin');
  const isOwner = booking.customerId?._id?.toString() === user.id || booking.customerId?.toString() === user.id;

  if (operatorNotes !== undefined && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Operator notes require administrator or assigned-operator access.' });
  }

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ success: false, message: 'Forbidden: cannot update this booking' });
  }

  const result = await updateBooking({
    bookingId,
    travelers,
    operatorNotes
  });

  if (result.error) {
    return res.status(result.status || 400).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: 'Booking updated successfully',
    booking: visibleBooking(result.booking, req.user)
  });
}

// Internal notes have their own authorization boundary and do not change booking lifecycle fields.
export async function updateOperatorNotesController(req, res) {
  try {
    const roles = rolesFor(req.user);
    const isAdmin = roles.includes('admin');
    if (!req.user || (!isAdmin && !isOperatorRole(roles))) {
      return res.status(403).json({ success: false, message: 'Operator access required.' });
    }
    const existing = await getBookingById(req.params.bookingId);
    if (existing.error) return res.status(404).json({ success: false, message: existing.error });
    if (!isAdmin && !await isBookingOperator(existing.booking, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden: you are not assigned to this booking.' });
    }
    const result = await updateOperatorNotes({ bookingId: req.params.bookingId, operatorNotes: req.body.operatorNotes });
    if (result.error) return res.status(result.error === 'Booking not found' ? 404 : 400).json({ success: false, message: result.error });
    return res.json({ success: true, booking: visibleBooking(result.booking, req.user, true) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save operator notes.' });
  }
}

// Cancel booking
export async function cancelBookingController(req, res) {
  const { bookingId } = req.params;
  const { reason } = req.body;
  const userId = req.user.id; // Extract directly from verified user context

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: 'Cancellation reason is required'
    });
  }

  // BOLA Check: Customers can only cancel their own bookings
  const bookingResult = await getBookingById(bookingId);
  if (bookingResult.error) {
    return res.status(404).json({ success: false, message: bookingResult.error });
  }
  const booking = bookingResult.booking;
  const userRoles = req.user.roles || [];
  const isAdmin = userRoles.map(r => r.toLowerCase()).includes('admin');
  const isOwner = booking.customerId?._id?.toString() === userId || booking.customerId?.toString() === userId;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ success: false, message: 'Forbidden: cannot cancel this booking' });
  }

  const result = await cancelBooking({
    bookingId,
    userId,
    reason
  });

  if (result.error) {
    return res.status(result.status || 400).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    booking: visibleBooking(result.booking, req.user),
    refundAmount: result.refundAmount
  });
}

// Add payment to booking
export async function addPaymentController(req, res) {
  const { bookingId } = req.params;
  const { amount, method, transactionRef } = req.body;

  if (!amount || !method) {
    return res.status(400).json({
      success: false,
      message: 'Payment amount and method are required'
    });
  }

  // BOLA Check: Customers can only pay for their own bookings
  const bookingResult = await getBookingById(bookingId);
  if (bookingResult.error) {
    return res.status(404).json({ success: false, message: bookingResult.error });
  }
  const booking = bookingResult.booking;
  const user = req.user;
  const userRoles = user.roles || [];
  const isAdmin = userRoles.map(r => r.toLowerCase()).includes('admin');
  const isOwner = booking.customerId?._id?.toString() === user.id || booking.customerId?.toString() === user.id;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ success: false, message: 'Forbidden: cannot add payment to this booking' });
  }

  const result = await addPayment({
    bookingId,
    amount,
    method,
    transactionRef
  });

  if (result.error) {
    return res.status(result.status || 400).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: result.payment?.status === 'PENDING' ? 'Payment submitted for administrator verification' : 'This reference was already submitted; its saved status is unchanged.',
    payment: result.payment,
    booking: visibleBooking(result.booking, req.user)
  });
}

// Customer check-in for a booking
export async function checkInBookingController(req, res) {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id; // Extract from verified user context

    // BOLA Check: Customers can only check in their own bookings
    const bookingResult = await getBookingById(bookingId);
    if (bookingResult.error) {
      return res.status(404).json({ success: false, message: bookingResult.error });
    }
    const booking = bookingResult.booking;
    const isOwner = booking.customerId?._id?.toString() === userId || booking.customerId?.toString() === userId;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: cannot check in for this booking' });
    }

    const result = await checkInBooking(bookingId, userId);
    if (result.error) {
      return res.status(result.status || 400).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Checked in successfully', booking: visibleBooking(result.booking, req.user) });
  } catch (err) {
    console.error('Check-in controller error:', err);
    res.status(500).json({ success: false, message: 'Server error during check-in' });
  }
}
// Get customer booking statistics
export async function getCustomerStatsController(req, res) {
  const { customerId } = req.params;

  // BOLA Check: Customers can only query their own stats
  const user = req.user;
  const userRoles = user.roles || [];
  const isAdmin = userRoles.map(r => r.toLowerCase()).includes('admin');
  const isOperator = userRoles.map(r => r.toLowerCase()).includes('operator') || userRoles.map(r => r.toLowerCase()).includes('tour_operator');

  if (!isAdmin && !isOperator && customerId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden: access is restricted' });
  }

  const result = await getCustomerBookingStats(customerId);

  if (result.error) {
    return res.status(500).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    stats: result.stats
  });
}

// Complete a booking
export async function completeBookingController(req, res) {
  const { bookingId } = req.params;

  const result = await completeBooking(bookingId);

  if (result.error) {
    return res.status(result.status || 400).json({
      success: false,
      message: result.error
    });
  }

  res.json({
    success: true,
    message: 'Booking marked as completed',
    booking: visibleBooking(result.booking, req.user)
  });
}

// Cancel unpaid bookings that have passed start date
export async function cancelUnpaidBookingsController(req, res) {
  try {
    const result = await cancelUnpaidExpiredBookings();
    res.json({ 
      success: true, 
      message: `${result.cancelledCount} unpaid booking(s) cancelled.`,
      cancelledBookings: result.bookings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Admin: trigger auto-complete job on demand
export async function autoCompleteBookingsController(req, res) {
  try {
    const result = await autoCompletePassedBookings();
    if (result.error) {
      return res.status(500).json({ success: false, message: result.error });
    }
    res.json({ success: true, message: `Auto-complete processed ${result.completedCount || 0} bookings.`, result });
  } catch (err) {
    console.error('Error in autoCompleteBookingsController:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Process refund for a cancelled booking (Admin only)
export async function processRefundController(req, res) {
  try {
    const { bookingId } = req.params;
    const adminId = req.user?.id || req.body.adminId; // Extract from verified user context

    const result = await processRefund({ bookingId, adminId, transactionRef: req.body.transactionRef, notes: req.body.notes });

    if (result.error) {
      return res.status(result.status || 400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      message: `Completed manual refund recorded: ${result.booking.currency} ${result.refundAmount}`,
      booking: visibleBooking(result.booking, req.user),
      refundAmount: result.refundAmount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Request date change for a booking
export async function requestDateChangeController(req, res) {
  try {
    const { bookingId } = req.params;
    const { requestedDate, reason } = req.body;
    const userId = req.user?.id || req.body.userId; // Extract from verified user context

    if (!userId || !requestedDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId and requestedDate'
      });
    }

    // BOLA Check: Customers can only request date change for their own bookings
    const bookingResult = await getBookingById(bookingId);
    if (bookingResult.error) {
      return res.status(404).json({ success: false, message: bookingResult.error });
    }
    const booking = bookingResult.booking;
    const isOwner = booking.customerId?._id?.toString() === userId || booking.customerId?.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: cannot request date change for another user\'s booking.' });
    }

    const result = await requestDateChange({ bookingId, userId, requestedDate, reason });

    if (result.error) {
      return res.status(result.status || 400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      message: result.message,
      booking: visibleBooking(result.booking, req.user)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Approve date change request (Admin)
export async function approveDateChangeController(req, res) {
  try {
    const { bookingId } = req.params;
    const adminId = req.user?.id || req.body.adminId; // Extract from verified user context
    const { newStartDate } = req.body;

    if (!adminId || !newStartDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: adminId and newStartDate'
      });
    }

    const result = await approveDateChange({ bookingId, adminId, newStartDate });

    if (result.error) {
      return res.status(result.status || 400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      message: result.message,
      booking: visibleBooking(result.booking, req.user)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

// Reject date change request (Admin)
export async function rejectDateChangeController(req, res) {
  try {
    const { bookingId } = req.params;
    const adminId = req.user?.id || req.body.adminId; // Extract from verified user context
    const { reviewNotes } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: adminId'
      });
    }

    const result = await rejectDateChange({ bookingId, adminId, reviewNotes });

    if (result.error) {
      return res.status(result.status || 400).json({ success: false, message: result.error });
    }

    res.json({
      success: true,
      message: result.message,
      booking: visibleBooking(result.booking, req.user)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
}

export async function listPendingPaymentsController(req, res) {
  try { res.json({ success: true, payments: await listPendingPayments() }); }
  catch { res.status(500).json({ success: false, message: 'Unable to load payment submissions.' }); }
}
export async function verifyPaymentController(req, res) {
  const result = await verifyManualPayment({ ...req.params, adminId: req.user.id, approved: req.body.approved, notes: req.body.notes });
  if (result.error) return res.status(result.status || 400).json({ success: false, message: result.error });
  res.json({ success: true, message: 'Payment decision saved.', booking: result.booking, payment: result.payment });
}
