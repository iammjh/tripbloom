// One-time backfill. Gives every tour package a code (for example RL) and every booking that has no code a booking code
// (for example #RL001), oldest booking first. Safe to run more than once: it only touches records without a code.
// Usage: MONGODB_URI=... npm run backfill:booking-codes
import mongoose from 'mongoose';
import { TourPackage } from '../model/tourPackage.model.js';
import Booking from '../model/booking.model.js';
import { deriveCode, uniquePackageCode, nextBookingCode } from '../service/bookingCode.service.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGODB_URI to the database to update.');
  process.exit(1);
}

await mongoose.connect(uri);
try {
  const packages = await TourPackage.find({ $or: [{ code: { $exists: false } }, { code: null }] }).lean();
  for (const pkg of packages) {
    const code = await uniquePackageCode(deriveCode(pkg.title), { TourPackage, excludeId: pkg._id });
    await TourPackage.updateOne({ _id: pkg._id }, { $set: { code } });
    console.log(`Package "${pkg.title}" -> code ${code}`);
  }

  const codes = new Map((await TourPackage.find({}, 'code title').lean()).map(pkg => [String(pkg._id), pkg.code]));
  const bookings = await Booking.find({ $or: [{ bookingCode: { $exists: false } }, { bookingCode: null }] }, 'packageId').sort({ createdAt: 1 }).lean();
  for (const booking of bookings) {
    const code = codes.get(String(booking.packageId));
    if (!code) {
      console.log(`Skipped booking ${booking._id}: its package has no code.`);
      continue;
    }
    const bookingCode = await nextBookingCode(code);
    await Booking.updateOne({ _id: booking._id }, { $set: { bookingCode } });
    console.log(`Booking ${booking._id} -> ${bookingCode}`);
  }
  console.log(`Done: ${packages.length} package(s), ${bookings.length} booking(s) processed.`);
} finally {
  await mongoose.disconnect();
}
