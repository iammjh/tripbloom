import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { LuClock, LuDollarSign, LuMapPin } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';

import { getPublicPackage, listPublicPackages } from '../api/catalog';
import TourDetailModal from './TourDetailModal';

const PopularDestinations = () => {
  const [destinations, setDestinations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    try {
      const packages = await listPublicPackages();
      if (!packages) setStatus('ready');
      if (packages) {
        // Transform the tour packages data to match the component's expected format
        const transformedPackages = packages
          .filter(pkg => pkg.isActive) // Only show active packages
          .map(pkg => ({
            id: pkg._id,
            name: pkg.title,
            duration: `${pkg.defaultDays} Days`,
            price: pkg.basePrice,
            // Use package photos first, then fallback to destination-based images
            image: pkg.photos && pkg.photos.length > 0 
              ? pkg.photos[0] 
              : getDestinationImage(pkg.destinations?.[0]?.country || pkg.destinations?.[0]?.city || pkg.title),
            type: determinePackageType(pkg),
            description: pkg.description,
            destinations: pkg.destinations
          }));
        
        // Select only 3 random packages for popular destinations
        const selectedPackages = transformedPackages.slice(0, 3);
        
        setDestinations(selectedPackages);
        setStatus('ready');
      }
    } catch (error) {
      console.error('Error fetching destinations:', error);
      setDestinations([]);
      setStatus('error');
    }
  };

  // Helper function to determine package type based on destinations
  const determinePackageType = (pkg) => {
    if (!pkg.destinations || pkg.destinations.length === 0) return 'Unknown';
    
    // Check if any destination is international (non-Bangladesh)
    const hasInternational = pkg.destinations.some(dest => 
      dest.country && dest.country.toLowerCase() !== 'bangladesh'
    );
    
    return hasInternational ? 'International' : 'Domestic';
  };

  // Helper function to get appropriate image based on destination
  const getDestinationImage = (location) => {
    if (!location) return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500&h=300&fit=crop';
    
    const locationLower = location.toLowerCase();
    
    // Map common destinations to relevant images
    const imageMap = {
      'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&h=300&fit=crop',
      'maldives': 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=500&h=300&fit=crop',
      'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&h=300&fit=crop',
      'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&h=300&fit=crop',
      'thailand': 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&h=300&fit=crop',
      'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=500&h=300&fit=crop',
      'bangladesh': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=300&fit=crop',
      'sundarbans': 'https://images.unsplash.com/photo-1511497584788-876760111969?w=500&h=300&fit=crop',
      'cox': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=300&fit=crop',
    };
    
    // Find matching image or use default
    for (const [key, image] of Object.entries(imageMap)) {
      if (locationLower.includes(key)) return image;
    }
    
    // Default travel image
    return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500&h=300&fit=crop';
  };

  const filters = ['All', 'Domestic', 'International', 'Day Tours', 'Multi-day'];

  // Since we're showing only 3 random packages, disable filtering
  // Users can find more packages in Tour Categories section
  const filteredDestinations = destinations;

  const handleViewDetails = async (destination) => {
    setDetailsError('');
    try {
      // Fetch full package details from the backend
      const pkg = await getPublicPackage(destination.id);
      setSelectedPackage(pkg);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching package details:', error);
      setDetailsError('This tour could not be loaded. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPackage(null);
  };

  return (
    <section id="destinations" aria-labelledby="destinations-heading" className="bg-surface py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Featured</p>
        <h2 id="destinations-heading" className="mt-2 font-display text-3xl font-bold text-text sm:text-4xl">Popular destinations</h2>
        <p className="mt-3 text-base text-text-muted">Featured packages from our current catalogue.</p>
      </header>
      {detailsError && <p role="alert" className="mb-6 text-center text-red-600 dark:text-red-400">{detailsError}</p>}

      {status === 'loading' && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <Skeleton className="h-56 w-full rounded-none" />
              <div className="space-y-3 p-6"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
            </div>
          ))}
        </div>
      )}
      {status === 'error' && <ErrorState title="Packages could not be loaded" onRetry={fetchDestinations} />}
      {status === 'ready' && filteredDestinations.length === 0 && (
        <EmptyState title="No packages published yet" description="Tour packages appear here as soon as they are published." />
      )}
      {status === 'ready' && filteredDestinations.length > 0 && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredDestinations.map(destination => (
            <article key={destination.id} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-lg">
              <div className="relative h-56 overflow-hidden">
                <img src={destination.image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute right-4 top-4 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-text shadow">
                  BDT {Number(destination.price || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-semibold text-text">{destination.name}</h3>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-text-muted">
                  <span className="inline-flex items-center gap-1.5"><LuClock aria-hidden="true" className="h-4 w-4" />{destination.duration}</span>
                  <span className="inline-flex items-center gap-1.5"><LuMapPin aria-hidden="true" className="h-4 w-4" />{destination.type}</span>
                </div>
                <Button className="mt-6 w-full" onClick={() => handleViewDetails(destination)}>View details</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Tour Detail Modal */}
      <TourDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        packageData={selectedPackage}
        userRole="CUSTOMER"
      />
      </div>
    </section>
  );
};

export default PopularDestinations;
