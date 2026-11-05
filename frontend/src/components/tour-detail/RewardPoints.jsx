import React from 'react';
import Button from '../ui/Button.jsx';
import FormField, { fieldAria, inputClass } from '../ui/FormField.jsx';
import { StarIcon } from '../ui/icons.js';

// Reward points and the booking summary, with the confirm and cancel actions.
// Points are shown for information only; the backend does not apply them yet.
export default function RewardPoints({ userRewardPoints, pricePerTraveler, bookingData, setBookingData, handleBooking, setShowBookingForm }) {
  const price = Number(pricePerTraveler || 0);
  const subtotal = price * bookingData.numTravelers;
  const maxPoints = Math.min(userRewardPoints, Math.floor(subtotal * 0.2));

  return (
    <>
      {userRewardPoints > 0 && (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-brand/5 p-4">
          <div>
            <p className="flex items-center gap-2 font-semibold text-brand">
              <StarIcon aria-hidden="true" className="h-4 w-4" /> Available Reward Points
            </p>
            <p className="text-sm text-text-muted">You have {userRewardPoints} points (1 point = 1 BDT)</p>
          </div>

          <FormField id="reward-points" label="Reward points to use">
            <div className="flex gap-2">
              <input
                {...fieldAria('reward-points')}
                type="number"
                min="0"
                max={maxPoints}
                value={bookingData.pointsToUse}
                onChange={(e) => {
                  const points = parseInt(e.target.value) || 0;
                  setBookingData({ ...bookingData, pointsToUse: Math.min(points, maxPoints) });
                }}
                placeholder="Enter points to use"
                className={`${inputClass} flex-1`}
              />
              <Button variant="secondary" onClick={() => setBookingData({ ...bookingData, pointsToUse: maxPoints })}>
                Use Max
              </Button>
            </div>
          </FormField>

          {bookingData.pointsToUse > 0 && (
            <p className="text-sm font-semibold text-success">Selected: {bookingData.pointsToUse} points (not applied)</p>
          )}
          <p className="text-sm text-text-muted">
            Reward discounts are currently unavailable. This booking uses the full total and will not deduct points.
          </p>
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between text-text-muted">
          <span>Price per person</span>
          <span className="font-semibold text-text">BDT {price.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-text-muted">
          <span>Travelers</span>
          <span className="font-semibold text-text">×{bookingData.numTravelers}</span>
        </div>
        <div className="flex justify-between text-text-muted">
          <span>Subtotal</span>
          <span className="font-semibold text-text">BDT {subtotal.toLocaleString()}</span>
        </div>
        {bookingData.pointsToUse > 0 && (
          <div className="flex justify-between font-semibold text-success">
            <span>Selected points (not applied)</span>
            <span>{bookingData.pointsToUse}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="font-semibold text-text">Total</span>
          <span className="font-display text-2xl font-bold text-brand">BDT {subtotal.toLocaleString()}</span>
        </div>
        {bookingData.pointsToUse > 0 && (
          <p className="pt-1 text-center text-xs text-text-muted">No points will be deducted from this booking.</p>
        )}
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={handleBooking}>Confirm Booking</Button>
        <Button variant="secondary" className="w-full" onClick={() => setShowBookingForm(false)}>Cancel</Button>
      </div>
    </>
  );
}
