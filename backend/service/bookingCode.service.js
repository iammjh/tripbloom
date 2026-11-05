// Booking codes: a package code plus a running number, e.g. #RL001 for the first booking on a package coded RL.
// The same code appears on the booking, its refund and its date change request.
import mongoose from 'mongoose';

export const PACKAGE_CODE_PATTERN = /^[A-Z]{2,5}$/;

// Default package code from the title's initials: "Rangamati Lake" -> RL.
export function deriveCode(title = '') {
  const words = String(title).toUpperCase().replace(/[^A-Z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const initials = words.length >= 2 ? words.slice(0, 5).map(word => word[0]).join('') : (words[0] || 'TB').slice(0, 3);
  return initials.length >= 2 ? initials : `${initials}T`;
}

// A code no other package uses: the base code, then the base with a suffix letter when it is taken.
export async function uniquePackageCode(base, { TourPackage, excludeId } = {}) {
  const suffixes = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
  const candidates = [base, ...suffixes.map(letter => `${base.slice(0, 4)}${letter}`)];
  for (const candidate of candidates) {
    const query = { code: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) };
    if (!(await TourPackage.exists(query))) return candidate;
  }
  return null;
}

// Next booking code for a package code. Runs in the booking transaction, so a rolled-back booking does not use a number.
export async function nextBookingCode(packageCode, session) {
  const result = await mongoose.connection.collection('counters').findOneAndUpdate(
    { _id: `booking:${packageCode}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  const counter = result?.value ?? result;
  return `#${packageCode}${String(counter.seq).padStart(3, '0')}`;
}
