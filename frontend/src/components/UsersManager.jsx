import React, { useState } from 'react';
import UsersList from './UsersList';
import UserDetailModal from './UserDetailModal';
import OperatorDetailModal from './OperatorDetailModal';
import UserEditModal from './UserEditModal';

const UsersManager = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleViewDetails = (user) => {
    setSelectedUser(user);
    // If user is operator, show OperatorDetailModal
    if (user.roles?.some(r => r.toLowerCase() === 'tour_operator' || r.toLowerCase() === 'operator')) {
      setShowOperatorModal(true);
    } else {
      setShowDetailModal(true);
    }
  };

  const handleEdit = (user) => {
    setUserToEdit(user);
    setShowDetailModal(false);
    setShowOperatorModal(false);
    setShowEditModal(true);
  };

  const handleUserUpdated = () => {
    setShowEditModal(false);
    setUserToEdit(null);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto">
        <UsersList 
          onViewDetails={handleViewDetails}
          key={refreshTrigger}
        />

        {/* Show UserDetailModal for non-operators */}
        <UserDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          user={selectedUser}
          onEdit={handleEdit}
          onUserUpdated={handleUserUpdated}
        />

        {/* Show OperatorDetailModal for operators */}
        <OperatorDetailModal
          isOpen={showOperatorModal}
          onClose={() => setShowOperatorModal(false)}
          operator={selectedUser}
          onEdit={handleEdit}
          onUserUpdated={handleUserUpdated}
        />

        <UserEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          user={userToEdit}
          onUserUpdated={handleUserUpdated}
        />
      </div>
    </div>
  );
};

export default UsersManager;
