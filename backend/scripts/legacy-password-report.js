// Read-only report: counts accounts whose password is still stored without bcrypt.
// Prints counts only, never names, emails or hashes.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { User } from '../model/user.model.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const BCRYPT = /^\$2[aby]\$\d{2}\$/;
  const total = await User.countDocuments({});
  const plaintext = await User.countDocuments({ passwordHash: { $not: BCRYPT } });
  console.log(`Accounts: ${total}`);
  console.log(`Passwords stored without bcrypt: ${plaintext}`);
  if (plaintext > 0) {
    console.log('These accounts will be upgraded only when their owner next signs in. Ask them to reset or change their password, or remove the accounts.');
  }
} finally {
  await mongoose.disconnect();
}
