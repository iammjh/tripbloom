import React, { useState } from 'react';
import TourPackagesList from './TourPackagesList';
import PackageDetailModal from './PackageDetailModal';
import PackageEditModal from './PackageEditModal';

const TourPackagesManager = () => {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [packageToEdit, setPackageToEdit] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleViewDetails = (packageData) => {
    setSelectedPackage(packageData);
    setShowDetailModal(true);
  };

  const handleEdit = (packageData) => {
    setPackageToEdit(packageData);
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handlePackageUpdated = () => {
    setShowEditModal(false);
    setPackageToEdit(null);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto">
        <TourPackagesList 
          onViewDetails={handleViewDetails}
          key={refreshTrigger}
        />
        
        <PackageDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          packageData={selectedPackage}
          onEdit={handleEdit}
        />

        <PackageEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          package={packageToEdit}
          onPackageUpdated={handlePackageUpdated}
        />
      </div>
    </div>
  );
};

export default TourPackagesManager;
