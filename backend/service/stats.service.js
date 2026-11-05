import { receiptsByCurrency } from './analytics.service.js';
// stats.service.js - Global statistics for homepage
import Booking from '../model/booking.model.js';
import { TourPackage } from '../model/tourPackage.model.js';
import { Review } from '../model/review.model.js';
import { User } from '../model/user.model.js';

// Get overall platform statistics
export async function getPlatformStats() {
  try {
    // Count active tour packages
    const totalPackages = await TourPackage.countDocuments({ isActive: true });

    // Count happy travelers (unique customers with completed bookings)
    const completedBookings = await Booking.find({ 
      status: { $in: ['COMPLETED', 'CONFIRMED'] } 
    }).distinct('customerId');
    const happyTravelers = completedBookings.length;

    // Count 5-star reviews
    const fiveStarReviews = await Review.countDocuments({ 
      rating: 5,
      status: 'APPROVED'
    });

    // Count unique destinations from active packages
    const packages = await TourPackage.find({ isActive: true }, 'destinations');
    const uniqueDestinations = new Set();
    packages.forEach(pkg => {
      if (pkg.destinations && Array.isArray(pkg.destinations)) {
        pkg.destinations.forEach(dest => {
          if (dest.name) uniqueDestinations.add(dest.name);
          if (dest.city) uniqueDestinations.add(dest.city);
          if (dest.country) uniqueDestinations.add(dest.country);
        });
      }
    });
    const totalDestinations = uniqueDestinations.size;

    // Additional useful stats
    const totalBookings = await Booking.countDocuments();
    const totalCustomers = await User.countDocuments({ roles: { $in: ['CUSTOMER', 'customer'] } });
    const totalReviews = await Review.countDocuments({ status: 'APPROVED' });
    
    // Calculate average rating
    const reviews = await Review.find({ status: 'APPROVED' }, 'rating');
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;

    return {
      stats: {
        totalPackages,
        happyTravelers,
        fiveStarReviews,
        totalDestinations,
        totalBookings,
        totalCustomers,
        totalReviews,
        averageRating: parseFloat(avgRating)
      }
    };
  } catch (err) {
    console.error('Error fetching platform stats:', err);
    return { error: 'Failed to fetch statistics' };
  }
}

// Get detailed booking statistics
export async function getBookingStats() {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: { status: '$status', currency: { $ifNull: ['$currency', 'BDT'] } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalTravelers: { $sum: '$numTravelers' }
        }
      }
    ]);

    const byStatus = {};
    const financialBookings = await Booking.find().select('payments currency createdAt').lean();
    const revenueByCurrency = receiptsByCurrency(financialBookings);
    const totalRevenue = revenueByCurrency.BDT?.net || 0;
    let totalTravelers = 0;

    stats.forEach(stat => {
      const status = byStatus[stat._id.status] ||= { count: 0, totalAmount: 0, totalTravelers: 0, amountsByCurrency: {} };
      status.count += stat.count; status.totalTravelers += stat.totalTravelers;
      status.amountsByCurrency[stat._id.currency] = stat.totalAmount;
      if (stat._id.currency === 'BDT') status.totalAmount += stat.totalAmount;
      totalTravelers += stat.totalTravelers;
    });

    return {
      stats: {
        byStatus,
        totalRevenue,
        currency: 'BDT',
        revenueByCurrency,
        totalTravelers
      }
    };
  } catch (err) {
    console.error('Error fetching booking stats:', err);
    return { error: 'Failed to fetch booking statistics' };
  }
}
