import React from 'react';
import { LuPencil } from 'react-icons/lu';
import FormField, { fieldAria, inputClass } from '../ui/FormField.jsx';

const EXCLUDABLE = ['Accommodation', 'Meals', 'Transport', 'Guide', 'Activities', 'Insurance'];

const ACCOMMODATION = [
  ['', 'No preference'],
  ['budget', 'Budget (Hostel/Guesthouse)'],
  ['standard', 'Standard (3-Star Hotel)'],
  ['luxury', 'Luxury (4-5 Star Hotel)'],
  ['resort', 'Resort'],
  ['boutique', 'Boutique Hotel'],
];

const TRANSPORT = [
  ['', 'No preference'],
  ['private-car', 'Private Car/Van'],
  ['shared', 'Shared Transport'],
  ['luxury', 'Luxury Vehicle'],
  ['public', 'Public Transport'],
];

const ACTIVITY = [
  ['', 'No preference'],
  ['relaxed', 'Relaxed (Leisure focused)'],
  ['moderate', 'Moderate (Balanced)'],
  ['active', 'Active (Adventure focused)'],
  ['extreme', 'Extreme (High adventure)'],
];

// Customisation fields for personal tours, plus the notes field every booking has.
// State and handlers come from the parent through props.
export default function CustomizationOptions({ isCustomBooking, bookingData, setBookingData }) {
  const prefs = bookingData.customPreferences;
  const setPref = (key, value) => setBookingData({
    ...bookingData,
    customPreferences: { ...prefs, [key]: value },
  });
  const toggleExclude = (item, checked) => {
    const next = checked
      ? [...prefs.excludeItems, item]
      : prefs.excludeItems.filter((i) => i !== item);
    setPref('excludeItems', next);
  };

  return (
    <>
      {isCustomBooking && (
        <div className="space-y-5 rounded-xl border border-brand/40 bg-brand/5 p-4">
          <h5 className="flex items-center gap-2 font-semibold text-brand">
            <LuPencil aria-hidden="true" /> Customize Your Tour
          </h5>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-text">Exclude from package (select items you don't want)</legend>
            <div className="grid grid-cols-1 gap-1.5">
              {EXCLUDABLE.map((item) => (
                <label key={item} className="flex cursor-pointer items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={prefs.excludeItems.includes(item)}
                    onChange={(e) => toggleExclude(item, e.target.checked)}
                    className="h-4 w-4 accent-brand"
                  />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>

          <FormField id="custom-add-items" label="Add custom activities or destinations">
            <textarea
              {...fieldAria('custom-add-items')}
              rows="2"
              value={prefs.addItems}
              onChange={(e) => setPref('addItems', e.target.value)}
              placeholder="E.g., Visit local markets, Photography session, Hiking, specific destinations..."
              className={`${inputClass} resize-none`}
            />
          </FormField>

          <FormField id="custom-dietary" label="Dietary preferences">
            <input
              {...fieldAria('custom-dietary')}
              type="text"
              value={prefs.dietary}
              onChange={(e) => setPref('dietary', e.target.value)}
              placeholder="E.g., Vegetarian, Vegan, Halal, Allergies..."
              className={inputClass}
            />
          </FormField>

          <FormField id="custom-accommodation" label="Accommodation preference">
            <select {...fieldAria('custom-accommodation')} value={prefs.accommodation} onChange={(e) => setPref('accommodation', e.target.value)} className={inputClass}>
              {ACCOMMODATION.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>

          <FormField id="custom-transport" label="Transport preference">
            <select {...fieldAria('custom-transport')} value={prefs.transport} onChange={(e) => setPref('transport', e.target.value)} className={inputClass}>
              {TRANSPORT.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>

          <FormField id="custom-activity" label="Preferred activity level">
            <select {...fieldAria('custom-activity')} value={prefs.activities} onChange={(e) => setPref('activities', e.target.value)} className={inputClass}>
              {ACTIVITY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
        </div>
      )}

      <FormField id="special-requests" label={isCustomBooking ? 'Additional Notes (Optional)' : 'Special Requests (Optional)'}>
        <textarea
          {...fieldAria('special-requests')}
          rows="3"
          value={bookingData.customizations}
          onChange={(e) => setBookingData({ ...bookingData, customizations: e.target.value })}
          placeholder={isCustomBooking ? 'Any other special requirements...' : 'Any special requirements or preferences...'}
          className={`${inputClass} resize-none`}
        />
      </FormField>
    </>
  );
}
