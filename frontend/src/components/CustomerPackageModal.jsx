import React, { useEffect, useState } from 'react';
import Modal from './ui/Modal.jsx';
import Skeleton from './ui/Skeleton.jsx';
import TourGallery from './tour-detail/TourGallery.jsx';
import TourFacts from './tour-detail/TourFacts.jsx';
import TourInfo from './tour-detail/TourInfo.jsx';
import { getPublicPackage } from '../api/catalog';

// Read-only tour details for a trip the customer has booked. Same layout as the tour details dialog, without the booking form.
// packageData may be a booking, a populated package, or a package id; the full package is loaded when only an id is known.
const CustomerPackageModal = ({ isOpen, onClose, packageData, initialTab = 'overview' }) => {
  const [resolvedPkg, setResolvedPkg] = useState(null);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [resolvedError, setResolvedError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const populated = packageData?.packageId && typeof packageData.packageId === 'object' ? packageData.packageId : null;
  const source = resolvedPkg || populated || packageData || {};

  useEffect(() => {
    let mounted = true;
    setResolvedPkg(null);
    setResolvedError('');
    setActiveImageIndex(0);
    const tryFetch = async () => {
      if (!isOpen || !packageData) return;
      const pid = typeof packageData.packageId === 'string' ? packageData.packageId : null;
      if (!pid) return;
      setLoadingResolved(true);
      try {
        const data = await getPublicPackage(pid);
        if (mounted) setResolvedPkg(data);
      } catch (err) {
        console.debug('[CustomerPackageModal] fetch error', err);
        if (mounted) setResolvedError('Current package details could not be loaded. The details below are from your booking.');
      } finally {
        if (mounted) setLoadingResolved(false);
      }
    };
    tryFetch();
    return () => { mounted = false; };
  }, [isOpen, packageData]);

  // A map request without coordinates opens the journey section.
  useEffect(() => {
    if (!isOpen || initialTab !== 'destinations') return undefined;
    const timer = setTimeout(() => {
      document.getElementById('journey-heading')?.scrollIntoView({ block: 'start' });
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, initialTab]);

  if (!isOpen || !packageData) return null;

  const view = {
    title: source.title || source.name || packageData.title || packageData.destination || 'Tour',
    description: source.description || packageData.description || '',
    type: source.type || packageData.type,
    isInternational: Boolean(source.isInternational ?? packageData.isInternational),
    category: source.category || packageData.category,
    defaultDays: source.defaultDays || packageData.defaultDays,
    defaultNights: source.defaultNights ?? packageData.defaultNights,
    destinations: source.destinations || packageData.destinations || [],
    inclusions: source.inclusions || packageData.inclusions || {},
    extras: source.extras || packageData.extras || [],
    assignedOperators: source.assignedOperators || packageData.assignedOperators || [],
  };
  const photos = (source.photos || packageData.photos || []).filter(Boolean);
  const isGroupTour = view.type === 'GROUP';
  const typeLabel = isGroupTour ? 'Group tour' : 'Personal tour';
  const durationText = view.defaultDays ? `${view.defaultDays} days, ${view.defaultNights ?? 0} nights` : null;

  const nextImage = () => setActiveImageIndex((index) => (index + 1) % Math.max(photos.length, 1));
  const prevImage = () => setActiveImageIndex((index) => (index - 1 + Math.max(photos.length, 1)) % Math.max(photos.length, 1));

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={view.title}
      description={durationText ? `${durationText} · ${typeLabel}` : typeLabel}
      size="xl"
      rootClassName="dark"
    >
      <div className="space-y-6">
        {loadingResolved && <Skeleton className="h-6 w-1/2" />}
        {resolvedError && (
          <p role="alert" className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-text">{resolvedError}</p>
        )}

        <TourGallery
          title={view.title}
          images={photos}
          activeImageIndex={Math.min(activeImageIndex, Math.max(photos.length - 1, 0))}
          setActiveImageIndex={setActiveImageIndex}
          prevImage={prevImage}
          nextImage={nextImage}
        />
        <TourFacts packageData={view} isGroupTour={isGroupTour} />
        <TourInfo packageData={view} />
      </div>
    </Modal>
  );
};

export default CustomerPackageModal;
