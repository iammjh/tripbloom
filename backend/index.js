import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import cron from 'node-cron';
// Explicit deployment variables win; backend-local configuration wins over the root fallback.
dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  console.error('MONGODB_URI and JWT_SECRET are required. Configure backend/.env or the repository .env.');
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const { default: app } = await import('./app.js');
  const { User } = await import('./model/user.model.js');
  const { PaymentReceipt } = await import('./model/paymentReceipt.model.js');
  await PaymentReceipt.init();
  const { autoCompletePassedBookings } = await import('./service/booking.service.js');
  await User.collection.dropIndex('username_1').catch(() => {});
  const server = app.listen(process.env.PORT || 5001, () => console.log('TripBloom API is ready'));
  const job = cron.schedule('0 * * * *', async () => {
    try { await autoCompletePassedBookings(); }
    catch (error) { console.error('Booking completion job failed:', error.message); }
  });
  const stop = () => { job.stop(); server.close(() => mongoose.disconnect().then(() => process.exit(0))); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch (error) {
  console.error('Backend startup failed:', error.message);
  process.exit(1);
}
