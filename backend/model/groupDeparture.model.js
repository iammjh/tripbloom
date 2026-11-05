// groupDeparture.model.js
import mongoose from 'mongoose';

const DEPARTURE_STATUS = ['OPEN', 'FULL', 'CLOSED', 'CANCELLED'];

const operatorAssignmentSchema = new mongoose.Schema({
  operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  assignedAt: { type: Date, default: Date.now }
}, { _id: false });

const groupDepartureSchema = new mongoose.Schema({
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'TourPackage', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalSeats: { type: Number, required: true },
  bookedSeats: { type: Number, default: 0 },
  pricePerPerson: { type: Number, required: true },
  status: { type: String, enum: DEPARTURE_STATUS, default: 'OPEN' },
  operators: [operatorAssignmentSchema], // Operators assigned to this departure with tracking
  seatMap: [{
    seatNumber: { type: String, required: true },
    status: { type: String, enum: ['AVAILABLE', 'BOOKED', 'BLOCKED'], default: 'AVAILABLE' },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    checkedIn: { type: Boolean, default: false }
  }],
  // Track checked-in state per seat (optional)
  // The aggregate flag records whether attendance has been reviewed.
  seatMapChecked: { type: Boolean, default: false },
  // Optional safety checklist stored for the departure
  safetyChecklist: {
    firstAid: { type: Boolean, default: false },
    vehicleDocs: { type: Boolean, default: false },
    foodHygiene: { type: Boolean, default: false },
    emergencyContacts: { type: Boolean, default: false },
    routePlanned: { type: Boolean, default: false }
  },
  // Day-wise itinerary stored with stop statuses
  itinerary: {
    type: [
      {
        day: Number,
        stops: [
          {
            time: String,
            name: String,
            location: String,
            status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
            notes: String
          }
        ]
      }
    ],
    default: []
  },
  // Indicator that the tour has been marked started by operator
  tourStarted: { type: Boolean, default: false },
  // Incident log kept by the assigned operator during the tour
  incidents: {
    type: [
      {
        description: { type: String, required: true, trim: true, maxlength: 1000 },
        severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reportedAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  },
  createdAt: { type: Date, default: Date.now }
}, { optimisticConcurrency: true });

export const GroupDeparture = mongoose.model('GroupDeparture', groupDepartureSchema);
export const DEPARTURE_STATUS_ENUM = DEPARTURE_STATUS;
