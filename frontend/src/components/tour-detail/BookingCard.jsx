import React from 'react';
import Button from '../ui/Button.jsx';
import FormField, { fieldAria, inputClass } from '../ui/FormField.jsx';
import CustomizationOptions from './CustomizationOptions.jsx';
import RewardPoints from './RewardPoints.jsx';
import { LuCircleCheck, LuCircleX, LuClock, LuPencil, LuTriangleAlert } from 'react-icons/lu';
import { BusIcon, CheckIcon, SparklesIcon } from '../ui/icons.js';

const isKycVerified = (status) => status === 'VERIFIED' || status === 'APPROVED';

// KYC status for international tours. Nothing is shown for domestic tours or for admin views.
function KycNotice({ userRole, kycStatus, kycLoading }) {
  if (userRole !== 'CUSTOMER') return null;
  let tone = 'warning';
  let icon = LuTriangleAlert;
  let title = 'KYC required';
  let body = 'This is an international tour. Complete KYC verification in your profile to book.';
  if (kycLoading) {
    title = 'Checking KYC status';
    body = '';
    icon = LuClock;
  } else if (isKycVerified(kycStatus)) {
    tone = 'success';
    icon = LuCircleCheck;
    title = 'KYC verified';
    body = "You're all set to book this international tour package.";
  } else if (kycStatus === 'PENDING') {
    icon = LuClock;
    title = 'KYC pending verification';
    body = "Your KYC is under review. You can book once it's verified.";
  } else if (kycStatus === 'REJECTED') {
    tone = 'danger';
    icon = LuCircleX;
    title = 'KYC rejected';
    body = 'Please resubmit your KYC in profile settings to book international tours.';
  }
  const Icon = icon;
  const toneClass = { success: 'border-success/30 bg-success/10', warning: 'border-warning/30 bg-warning/10', danger: 'border-danger/30 bg-danger/10' }[tone];
  const iconClass = { success: 'text-success', warning: 'text-warning', danger: 'text-danger' }[tone];

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${toneClass}`}>
      <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 flex-none ${iconClass}`} />
      <div className="min-w-0">
        <p className="font-semibold text-text">{title}</p>
        {body && <p className="mt-0.5 text-xs text-text-muted">{body}</p>}
        {!kycLoading && !isKycVerified(kycStatus) && kycStatus !== 'PENDING' && kycStatus !== 'REJECTED' && (
          <a href="/customer/profile" className="mt-1 inline-block text-xs font-medium text-brand underline-offset-2 hover:underline">Go to profile settings</a>
        )}
      </div>
    </div>
  );
}

// Sidebar of the tour details: price, the booking actions and, once opened, the booking form.
// State and handlers live in the parent and arrive as props.
export default function BookingCard({ userRole, availableDepartures, bookingData, canCustomize, departuresError, handleBooking, handleCustomize, isCustomBooking, isFirstTravelerSelf, isGroupTour, kycLoading, kycStatus, packageData, pricePerTraveler, selectedDepartureId, setBookingData, setIsCustomBooking, setIsFirstTravelerSelf, setSelectedDepartureId, setShowBookingForm, showBookingForm, userProfileData, userRewardPoints }) {
  const kycBlocked = packageData.isInternational && !isKycVerified(kycStatus);
  const showTravelerDetails = (bookingData.numTravelers > 1 && bookingData.bookingFor === 'self') || bookingData.bookingFor === 'others';

  const chooseBookingFor = (value) => {
    if (value === 'self') {
      setBookingData({ ...bookingData, bookingFor: 'self', travelers: [{ fullName: '', age: '', phone: '' }] });
      return;
    }
    const travelers = [];
    for (let i = 0; i < bookingData.numTravelers; i++) {
      travelers.push({ fullName: '', age: '', phone: '' });
    }
    setBookingData({ ...bookingData, bookingFor: value, travelers });
  };

  const changeTravelerCount = (e) => {
    const count = parseInt(e.target.value) || 1;
    const travelers = [];
    for (let i = 0; i < count; i++) {
      travelers.push(bookingData.travelers[i] || { fullName: '', age: '', phone: '' });
    }
    // Keep the traveler list in step with the count when booking for several people or for others.
    const shouldUpdateTravelers = count > 1 || bookingData.bookingFor === 'others';
    setBookingData({
      ...bookingData,
      numTravelers: count,
      travelers: shouldUpdateTravelers ? travelers : bookingData.travelers,
    });
  };

  const handleThisIsMeToggle = (checked) => {
    setIsFirstTravelerSelf(checked);
    if (checked && userProfileData) {
      // Auto-fill the first traveler with the signed-in user's details.
      const newTravelers = [...bookingData.travelers];
      newTravelers[0] = {
        fullName: userProfileData.fullName,
        age: userProfileData.age,
        phone: userProfileData.phone,
        userId: localStorage.getItem('userId') || null,
      };
      setBookingData({ ...bookingData, travelers: newTravelers });
    }
  };

  const updateTraveler = (index, field, value) => {
    const newTravelers = [...bookingData.travelers];
    newTravelers[index] = { ...newTravelers[index], [field]: value };
    setBookingData({ ...bookingData, travelers: newTravelers });
  };

  const openForm = (customBooking) => {
    setIsCustomBooking(customBooking);
    setShowBookingForm(true);
  };

  return (
    <aside aria-label="Booking" className="lg:sticky lg:top-0 lg:self-start">
      <div className="space-y-5 rounded-xl border border-border bg-surface-muted p-5">
        <div>
          <p className="text-sm text-text-muted">Price per person</p>
          <p className="mt-1 font-display text-4xl font-bold text-brand">BDT {Number(pricePerTraveler || 0).toLocaleString()}</p>
        </div>

        {packageData.isInternational && userRole === 'CUSTOMER' && (
          <KycNotice userRole={userRole} kycStatus={kycStatus} kycLoading={kycLoading} />
        )}

        {!showBookingForm ? (
          <div className="space-y-3">
            {isGroupTour ? (
              <>
                <Button size="lg" className="w-full" disabled={kycBlocked} onClick={() => openForm(false)}>
                  Book This Tour
                </Button>
                <p className="flex items-start gap-2 text-xs text-text-muted">
                  <BusIcon aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-brand" />
                  Group tours have fixed schedules and cannot be customized.
                </p>
              </>
            ) : (
              <>
                <Button size="lg" className="w-full" disabled={kycBlocked} onClick={() => openForm(false)}>
                  Book As-Is
                </Button>
                {canCustomize && (
                  <Button variant="secondary" size="lg" className="w-full" icon={LuPencil} disabled={kycBlocked} onClick={handleCustomize}>
                    Customize Your Tour
                  </Button>
                )}
                <p className="flex items-start gap-2 text-xs text-text-muted">
                  <SparklesIcon aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-brand" />
                  Personal tours can be customized to your preferences.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <h4 className="font-display text-lg font-semibold text-text">Book Your Adventure</h4>

            {packageData.type !== 'GROUP' && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-text">Booking for</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[['self', 'Myself'], ['others', 'Others']].map(([value, label]) => {
                    const active = bookingData.bookingFor === value;
                    return (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          active ? 'border-brand bg-brand/10 text-text' : 'border-border text-text-muted hover:text-text'
                        }`}
                      >
                        <input type="radio" name="bookingFor" value={value} checked={active} onChange={(e) => chooseBookingFor(e.target.value)} className="accent-brand" />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <FormField id="num-travelers" label="Number of travelers">
              <input
                {...fieldAria('num-travelers')}
                type="number"
                min="1"
                inputMode="numeric"
                value={bookingData.numTravelers}
                onChange={changeTravelerCount}
                className={inputClass}
              />
            </FormField>

            {showTravelerDetails && (
              <fieldset className="space-y-4 rounded-xl border border-border p-4">
                <legend className="px-1 text-sm font-semibold text-text">
                  Traveler Details <span className="text-danger" aria-hidden="true">*</span>
                </legend>
                {Array.from({ length: bookingData.numTravelers }).map((_, index) => {
                  const traveler = bookingData.travelers[index] || {};
                  const locked = index === 0 && isFirstTravelerSelf;
                  const lockedClass = locked ? 'cursor-not-allowed opacity-80' : '';
                  const nameId = `traveler-${index}-name`;
                  const ageId = `traveler-${index}-age`;
                  const phoneId = `traveler-${index}-phone`;
                  return (
                    <div key={index} className="space-y-3 border-b border-border pb-4 last:border-b-0 last:pb-0">
                      <p className="text-sm font-semibold text-text-muted">Traveler {index + 1}</p>

                      {index === 0 && (
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
                          <input
                            type="checkbox"
                            checked={isFirstTravelerSelf}
                            onChange={(e) => handleThisIsMeToggle(e.target.checked)}
                            className="h-4 w-4 accent-brand"
                          />
                          <CheckIcon aria-hidden="true" className="h-4 w-4 text-brand" />
                          This is me (auto-fill my information)
                        </label>
                      )}

                      <FormField id={nameId} label="Full name" required>
                        <input
                          {...fieldAria(nameId)}
                          type="text"
                          value={traveler.fullName || ''}
                          onChange={(e) => updateTraveler(index, 'fullName', e.target.value)}
                          readOnly={locked}
                          required
                          className={`${inputClass} ${lockedClass}`}
                        />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField id={ageId} label="Age" required>
                          <input
                            {...fieldAria(ageId)}
                            type="number"
                            min="1"
                            max="120"
                            value={traveler.age || ''}
                            onChange={(e) => updateTraveler(index, 'age', e.target.value)}
                            readOnly={locked}
                            required
                            className={`${inputClass} ${lockedClass}`}
                          />
                        </FormField>
                        <FormField id={phoneId} label="Phone number" required>
                          <input
                            {...fieldAria(phoneId)}
                            type="tel"
                            value={traveler.phone || ''}
                            onChange={(e) => updateTraveler(index, 'phone', e.target.value)}
                            readOnly={locked}
                            required
                            className={`${inputClass} ${lockedClass}`}
                          />
                        </FormField>
                      </div>
                    </div>
                  );
                })}
              </fieldset>
            )}

            {packageData.type === 'GROUP' ? (
              <FormField id="departure" label="Select departure date" required>
                {availableDepartures.length > 0 ? (
                  <select
                    {...fieldAria('departure')}
                    value={selectedDepartureId}
                    onChange={(e) => setSelectedDepartureId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">-- Select a departure --</option>
                    {availableDepartures.map((departure) => {
                      const startDate = new Date(departure.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const endDate = new Date(departure.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      const availableSeats = departure.totalSeats - departure.bookedSeats;
                      return (
                        <option key={departure._id} value={departure._id}>
                          {startDate} to {endDate} ({availableSeats} seats available)
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-text">
                    {departuresError || 'No available departures at the moment. Please contact us for more information.'}
                  </p>
                )}
              </FormField>
            ) : (
              <FormField id="start-date" label="Preferred start date" required>
                <input
                  {...fieldAria('start-date')}
                  type="date"
                  value={bookingData.startDate}
                  onChange={(e) => setBookingData({ ...bookingData, startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className={inputClass}
                />
              </FormField>
            )}

            <CustomizationOptions isCustomBooking={isCustomBooking} bookingData={bookingData} setBookingData={setBookingData} />
            <RewardPoints
              userRewardPoints={userRewardPoints}
              pricePerTraveler={pricePerTraveler}
              bookingData={bookingData}
              setBookingData={setBookingData}
              handleBooking={handleBooking}
              setShowBookingForm={setShowBookingForm}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
