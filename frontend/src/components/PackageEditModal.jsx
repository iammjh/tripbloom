import React, { useState, useEffect } from 'react';
import { LuBanknote, LuCalendarDays, LuGlobe, LuHash, LuImage, LuMapPin, LuPackage, LuPlus, LuRoute, LuSparkles, LuTrash2, LuUsers } from 'react-icons/lu';
import axios from 'axios';
import Modal from './ui/Modal.jsx';
import Button from './ui/Button.jsx';
import FormField, { fieldAria, inputClass } from './ui/FormField.jsx';
import { notify } from '../utils/notifyStore.js';

const EMPTY_FORM = {
  title: '',
  code: '',
  description: '',
  type: 'PERSONAL',
  category: 'SILVER',
  basePrice: '',
  defaultDays: '',
  defaultNights: '',
  inclusionsTransport: '',
  inclusionsHotel: '',
  inclusionsMeals: '',
  inclusionsGuide: false,
  destinations: [],
  extras: '',
  photos: [],
  isActive: true,
  isInternational: false,
  mapLat: '',
  mapLng: '',
  mapZoom: 12,
};

const SECTION = 'glass rounded-2xl p-5 sm:p-6';
const SECTION_TITLE = 'flex items-center gap-3 font-display text-lg font-semibold text-text';
const ICON_TILE = 'flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand';

// Numbered section heading shared by every part of the editor.
function Section({ step, icon: Icon, title, hint, children, className = '' }) {
  return (
    <section className={`${SECTION} ${className}`}>
      <header className="mb-5">
        <h3 className={SECTION_TITLE}>
          <span className={ICON_TILE}><Icon aria-hidden="true" className="h-4 w-4" /></span>
          <span>{step}. {title}</span>
        </h3>
        {hint && <p className="mt-2 text-sm text-text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

// Switch-style card for the yes or no package settings.
function ToggleCard({ name, checked, onChange, title, description }) {
  return (
    <label className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${checked ? 'border-brand/50 bg-brand/5' : 'border-border hover:bg-surface-muted'}`}>
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="mt-1 h-5 w-5 accent-brand" />
      <span className="min-w-0">
        <span className="block font-semibold text-text">{title}</span>
        <span className="mt-1 block text-sm text-text-muted">{description}</span>
      </span>
    </label>
  );
}

// Itinerary: the places in visiting order, each with a city and country.
const DestinationsManager = ({ destinations, onChange }) => {
  const addDestination = () => {
    onChange([...destinations, { name: '', country: '', city: '', order: destinations.length + 1 }]);
  };

  const removeDestination = (index) => {
    const updated = destinations.filter((_, i) => i !== index).map((dest, idx) => ({ ...dest, order: idx + 1 }));
    onChange(updated);
  };

  const updateDestination = (index, field, value) => {
    const updated = [...destinations];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div>
      {destinations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No stops yet. Add the places this tour visits, in order.
        </p>
      ) : (
        <ol className="space-y-3">
          {destinations.map((dest, index) => (
            <li key={index} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl bg-surface-muted p-3 sm:grid-cols-[auto_1fr_auto]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-bold text-on-brand">{dest.order}</span>
              <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-3">
                <input
                  type="text"
                  aria-label={`Stop ${dest.order} place name`}
                  value={dest.name}
                  onChange={(e) => updateDestination(index, 'name', e.target.value)}
                  placeholder="Place name"
                  className={inputClass}
                />
                <input
                  type="text"
                  aria-label={`Stop ${dest.order} city`}
                  value={dest.city || ''}
                  onChange={(e) => updateDestination(index, 'city', e.target.value)}
                  placeholder="City"
                  className={inputClass}
                />
                <input
                  type="text"
                  aria-label={`Stop ${dest.order} country`}
                  value={dest.country || ''}
                  onChange={(e) => updateDestination(index, 'country', e.target.value)}
                  placeholder="Country"
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={() => removeDestination(index)}
                aria-label={`Remove stop ${dest.order}`}
                className="col-span-2 flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-sm text-danger transition-colors hover:bg-danger/10 sm:col-span-1 sm:min-h-0 sm:w-11"
              >
                <LuTrash2 aria-hidden="true" className="h-4 w-4" />
                <span className="sm:sr-only">Remove</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <Button type="button" variant="secondary" icon={LuPlus} className="mt-4" onClick={addDestination}>Add stop</Button>
    </div>
  );
};

const PackageEditModal = ({ isOpen, onClose, package: packageData, onPackageUpdated }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (packageData) {
      setFormData({
        title: packageData.title || '',
        code: packageData.code || '',
        description: packageData.description || '',
        type: packageData.type || 'PERSONAL',
        category: packageData.type === 'GROUP' ? '' : (packageData.category || 'SILVER'),
        basePrice: packageData.basePrice || '',
        defaultDays: packageData.defaultDays || '',
        defaultNights: packageData.defaultNights || '',
        inclusionsTransport: packageData.inclusions?.transport || '',
        inclusionsHotel: packageData.inclusions?.hotel || '',
        inclusionsMeals: packageData.inclusions?.meals || '',
        inclusionsGuide: packageData.inclusions?.guide || false,
        destinations: packageData.destinations || [],
        extras: Array.isArray(packageData.extras) ? packageData.extras.join('\n') : '',
        photos: packageData.photos || [],
        isActive: packageData.isActive !== undefined ? packageData.isActive : true,
        isInternational: packageData.isInternational || false,
        mapLat: packageData.mapLocation?.lat || '',
        mapLng: packageData.mapLocation?.lng || '',
        mapZoom: packageData.mapLocation?.zoom || 12,
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setError('');
  }, [packageData, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'code' ? value.toUpperCase() : value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.title || !formData.description) {
        setError('Add a title and a description.');
        return;
      }
      if (!formData.basePrice || parseFloat(formData.basePrice) <= 0) {
        setError('Enter a base price greater than zero (BDT).');
        return;
      }
      if (!formData.defaultDays || parseInt(formData.defaultDays, 10) <= 0) {
        setError('The tour needs at least one day.');
        return;
      }
      if (formData.code && !/^[A-Z]{2,5}$/.test(formData.code)) {
        setError('The package code must be 2 to 5 capital letters, for example RL.');
        return;
      }

      const payload = {
        title: formData.title,
        code: formData.code || undefined,
        description: formData.description,
        type: formData.type,
        basePrice: parseFloat(formData.basePrice),
        defaultDays: parseInt(formData.defaultDays, 10),
        defaultNights: parseInt(formData.defaultNights, 10) || 0,
        inclusions: {
          transport: formData.inclusionsTransport || '',
          hotel: formData.inclusionsHotel || '',
          meals: formData.inclusionsMeals || '',
          guide: formData.inclusionsGuide,
        },
        destinations: formData.destinations || [],
        extras: formData.extras.split('\n').filter(item => item.trim()),
        photos: formData.photos || [],
        isActive: formData.isActive,
        isInternational: formData.isInternational,
      };

      if (formData.mapLat && formData.mapLng) {
        payload.mapLocation = {
          lat: parseFloat(formData.mapLat),
          lng: parseFloat(formData.mapLng),
          zoom: parseInt(formData.mapZoom, 10) || 12,
        };
      }

      if (formData.type === 'PERSONAL') payload.category = formData.category;

      if (packageData) {
        await axios.put(`/api/admin/packages/${packageData._id}`, payload);
      } else {
        await axios.post('/api/admin/packages', payload);
      }

      notify.message(packageData ? 'Package updated.' : 'Package created.');
      onPackageUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to save package:', err);
      const message = err.response?.data?.message || err.response?.data?.error || 'The package could not be saved. Nothing changed; please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isGroup = formData.type === 'GROUP';
  const nights = parseInt(formData.defaultNights, 10) || 0;
  const days = parseInt(formData.defaultDays, 10) || 0;
  const previewCode = formData.code || (formData.title ? formData.title.split(/\s+/).filter(Boolean).slice(0, 4).map(word => word[0]).join('').toUpperCase() : 'XX');

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={packageData ? 'Edit package' : 'Create a new package'}
      description={packageData ? packageData.title : 'Fill in the sections below. Required fields are marked with an asterisk.'}
      size="xl"
      rootClassName="dark"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{error}</p>
        )}

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <Section step="1" icon={LuPackage} title="Basics" hint="The title and type shape how the tour appears to customers.">
              <div className="space-y-5">
                <FormField id="package-title" label="Package title" required>
                  <input id="package-title" type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Rangamati Lake Escape" className={inputClass} />
                </FormField>

                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-text">Tour type <span aria-hidden="true" className="text-danger">*</span></legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { value: 'PERSONAL', label: 'Personal tour', hint: 'Private itinerary, customers can customise it.' },
                      { value: 'GROUP', label: 'Group tour', hint: 'Fixed departure dates with a set group.' },
                    ].map(option => (
                      <label key={option.value} className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${formData.type === option.value ? 'border-brand/60 bg-brand/5' : 'border-border hover:bg-surface-muted'}`}>
                        <span className="flex items-center gap-2 font-semibold text-text">
                          <input type="radio" name="type" value={option.value} checked={formData.type === option.value} onChange={handleChange} className="accent-brand" />
                          {option.label}
                        </span>
                        <span className="text-sm text-text-muted">{option.hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {!isGroup && (
                  <FormField id="package-category" label="Category" required>
                    <select id="package-category" name="category" value={formData.category} onChange={handleChange} className={inputClass}>
                      <option value="SILVER">Silver</option>
                      <option value="GOLD">Gold</option>
                      <option value="PLATINUM">Platinum</option>
                      <option value="DIAMOND">Diamond Elite</option>
                    </select>
                  </FormField>
                )}

                <FormField id="package-code" label="Package code" hint={`Booking numbers use this code: ${previewCode}001, ${previewCode}002 and so on. Two to five capital letters.`}>
                  <div className="relative">
                    <LuHash aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input id="package-code" type="text" name="code" value={formData.code} onChange={handleChange} maxLength={5} placeholder={previewCode} className={`${inputClass} pl-9 font-mono uppercase`} />
                  </div>
                </FormField>
              </div>
            </Section>

            <Section step="2" icon={LuBanknote} title="Price and duration" hint="Prices are in BDT per person.">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField id="package-price" label="Base price (BDT)" required>
                  <input id="package-price" type="number" name="basePrice" value={formData.basePrice} onChange={handleChange} required min="0" step="0.01" placeholder="24500" className={inputClass} />
                </FormField>
                <FormField id="package-days" label="Days" required>
                  <input id="package-days" type="number" name="defaultDays" value={formData.defaultDays} onChange={handleChange} required min="1" placeholder="4" className={inputClass} />
                </FormField>
                <FormField id="package-nights" label="Nights" required>
                  <input id="package-nights" type="number" name="defaultNights" value={formData.defaultNights} onChange={handleChange} required min="0" placeholder="3" className={inputClass} />
                </FormField>
              </div>
            </Section>

            <Section step="3" icon={LuSparkles} title="Description" hint="What the tour is, for customers reading the details.">
              <FormField id="package-description" label="Description" required>
                <textarea id="package-description" name="description" value={formData.description} onChange={handleChange} required rows={4} placeholder="Describe the tour in a few sentences." className={`${inputClass} resize-none`} />
              </FormField>
            </Section>

            <Section step="4" icon={LuUsers} title="What's included" hint="Leave a line empty if it is not part of the price.">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="inc-transport" label="Transport">
                  <input id="inc-transport" type="text" name="inclusionsTransport" value={formData.inclusionsTransport} onChange={handleChange} placeholder="AC vehicle, airport transfer" className={inputClass} />
                </FormField>
                <FormField id="inc-hotel" label="Accommodation">
                  <input id="inc-hotel" type="text" name="inclusionsHotel" value={formData.inclusionsHotel} onChange={handleChange} placeholder="4-star hotel, twin sharing" className={inputClass} />
                </FormField>
                <FormField id="inc-meals" label="Meals">
                  <input id="inc-meals" type="text" name="inclusionsMeals" value={formData.inclusionsMeals} onChange={handleChange} placeholder="Breakfast and dinner" className={inputClass} />
                </FormField>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <input type="checkbox" name="inclusionsGuide" checked={formData.inclusionsGuide} onChange={handleChange} className="h-5 w-5 accent-brand" />
                    <span className="text-sm font-semibold text-text">Professional tour guide included</span>
                  </label>
                </div>
              </div>
            </Section>

            <Section step="5" icon={LuRoute} title="Itinerary" hint="The places visited, in order.">
              <DestinationsManager
                destinations={formData.destinations}
                onChange={(next) => setFormData(prev => ({ ...prev, destinations: next }))}
              />
            </Section>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <Section step="6" icon={LuCalendarDays} title="Summary">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Type</dt><dd className="font-semibold text-text">{isGroup ? 'Group tour' : 'Personal tour'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Duration</dt><dd className="font-semibold text-text">{days ? `${days} day${days === 1 ? '' : 's'}, ${nights} night${nights === 1 ? '' : 's'}` : 'Not set'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Price</dt><dd className="font-display text-lg font-bold text-brand">{formData.basePrice ? `BDT ${Number(formData.basePrice).toLocaleString()}` : 'Not set'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Booking numbers</dt><dd className="font-mono font-semibold text-text">#{previewCode}001</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-text-muted">Stops</dt><dd className="font-semibold text-text">{formData.destinations.length}</dd></div>
              </dl>
            </Section>

            <Section step="7" icon={LuImage} title="Photos" hint="Image links. The first photo is the cover.">
              <div className="space-y-3">
                {formData.photos.length === 0 && <p className="text-sm text-text-muted">No photos yet.</p>}
                {formData.photos.map((photo, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="h-14 w-14 flex-none overflow-hidden rounded-lg bg-surface-muted">
                      {photo && <img src={photo} alt={`Photo ${index + 1} preview`} className="h-full w-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />}
                    </div>
                    <FormField id={`photo-${index}`} label={`Photo ${index + 1}`} className="min-w-0 flex-1">
                      <input
                        {...fieldAria(`photo-${index}`)}
                        type="url"
                        value={photo}
                        onChange={(e) => {
                          const next = [...formData.photos];
                          next[index] = e.target.value;
                          setFormData(prev => ({ ...prev, photos: next }));
                        }}
                        placeholder="https://example.com/image.jpg"
                        className={inputClass}
                      />
                    </FormField>
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }))}
                      className="mt-6 flex h-11 w-11 flex-none items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger/10"
                    >
                      <LuTrash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="secondary" icon={LuPlus} onClick={() => setFormData(prev => ({ ...prev, photos: [...prev.photos, ''] }))}>Add photo</Button>
              </div>
            </Section>

            <Section step="8" icon={LuSparkles} title="Extras" hint="One extra per line.">
              <FormField id="package-extras" label="Extras">
                <textarea id="package-extras" name="extras" value={formData.extras} onChange={handleChange} rows={3} placeholder={'Photo album\nWelcome drink\nSouvenir T-shirt'} className={`${inputClass} resize-none`} />
              </FormField>
            </Section>

            <Section step="9" icon={LuGlobe} title="Visibility" hint="Control what customers see.">
              <div className="space-y-3">
                <ToggleCard name="isActive" checked={formData.isActive} onChange={handleChange} title="Active package" description="Inactive packages are hidden from customers." />
                <ToggleCard name="isInternational" checked={formData.isInternational} onChange={handleChange} title="International tour" description="Customers must complete KYC before booking." />
              </div>
            </Section>

            <Section step="10" icon={LuMapPin} title="Map location" hint="Optional. Shown when a customer opens the map.">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <FormField id="map-lat" label="Latitude">
                  <input id="map-lat" type="number" name="mapLat" value={formData.mapLat} onChange={handleChange} step="any" placeholder="23.8103" className={inputClass} />
                </FormField>
                <FormField id="map-lng" label="Longitude">
                  <input id="map-lng" type="number" name="mapLng" value={formData.mapLng} onChange={handleChange} step="any" placeholder="90.4125" className={inputClass} />
                </FormField>
                <FormField id="map-zoom" label="Zoom (1–18)">
                  <input id="map-zoom" type="number" name="mapZoom" value={formData.mapZoom} onChange={handleChange} min="1" max="18" placeholder="12" className={inputClass} />
                </FormField>
              </div>
            </Section>
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-border bg-surface/95 px-4 py-4 backdrop-blur sm:flex-row sm:justify-end sm:-mx-6 sm:px-6">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading}>{packageData ? 'Update package' : 'Create package'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default PackageEditModal;
