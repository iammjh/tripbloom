import { LuCalendar, LuTriangleAlert, LuUserCog, LuUsers, LuX } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';


const CreateDepartureModal = ({ isOpen, onClose, onDepartureCreated }) => {
  const [groupPackages, setGroupPackages] = useState([]);
  const [operators, setOperators] = useState([]);
  const [operatorStatus, setOperatorStatus] = useState({}); // { [opId]: { unavailable: bool, reasons: [] } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    packageId: '',
    startDate: '',
    endDate: '',
    totalSeats: 40,
    pricePerPerson: '',
    selectedOperators: []
  });

  useEffect(() => {
    if (isOpen) {
      fetchGroupPackages();
      fetchOperators();
      setError('');
    }
  }, [isOpen]);

  // Re-evaluate operator availability whenever dates change
  useEffect(() => {
    if (!formData.startDate || !formData.endDate || operators.length === 0) return;
    evaluateOperatorAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.startDate, formData.endDate, operators]);

  const fetchGroupPackages = async () => {
    try {
      const res = await axios.get('/api/admin/packages');
      const packages = res.data.packages || [];
      // Filter for GROUP type packages (category is null or undefined for GROUP packages)
      const groupOnly = packages.filter(pkg => pkg.category === null || pkg.category === undefined || pkg.type === 'GROUP');
      setGroupPackages(groupOnly);
    } catch (err) {
      console.error('Failed to fetch packages:', err);
      setError('Failed to load tour packages');
    }
  };

  const fetchOperators = async () => {
    try {
      const res = await axios.get('/api/admin/users');
      const allUsers = res.data.users || [];
      const operatorUsers = allUsers.filter(user => 
        user.isActive && user.roles?.some(r => {
          const roleUpper = r.toUpperCase();
          return roleUpper === 'TOUR_OPERATOR' || roleUpper === 'OPERATOR';
        })
      );
      setOperators(operatorUsers);
    } catch (err) {
      console.error('Failed to fetch operators:', err);
    }
  };

  const evaluateOperatorAvailability = async () => {
    const map = {};
    const start = formData.startDate ? new Date(formData.startDate) : null;
    const end = formData.endDate ? new Date(formData.endDate) : null;

    await Promise.all(operators.map(async (op) => {
      try {
        const res = await axios.get(`/api/group-departure/operator/${op._id}/future`);
        const deps = res.data.departures || [];

        // Operator is unavailable if any assigned departure overlaps with the new departure dates
        let unavailable = false;
        const reasons = [];
        deps.forEach(d => {
          const dStart = new Date(d.startDate);
          const dEnd = new Date(d.endDate);
          // Overlap if start <= dEnd && dStart <= end
          if (start && end && (start <= dEnd && dStart <= end)) {
            unavailable = true;
            reasons.push(`Overlaps with ${d.packageId?.title || 'another tour'} (${new Date(d.startDate).toLocaleDateString()} - ${new Date(d.endDate).toLocaleDateString()})`);
          }
        });

        map[op._id] = { unavailable, reasons };
      } catch (err) {
        map[op._id] = { unavailable: false, reasons: [] };
      }
    }));

    setOperatorStatus(map);
  };

  const handlePackageChange = (packageId) => {
    setFormData(prev => ({ ...prev, packageId }));
    
    // Auto-populate dates and price based on selected package
    const selectedPkg = groupPackages.find(pkg => pkg._id === packageId);
    if (selectedPkg) {
      const days = selectedPkg.defaultDays || 7;
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + 7); // Default: 1 week from now
      
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + days);
      
      setFormData(prev => ({
        ...prev,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        pricePerPerson: selectedPkg.basePrice || ''
      }));
    }
  };

  const handleOperatorToggle = (operatorId) => {
    setFormData(prev => ({
      ...prev,
      selectedOperators: prev.selectedOperators.includes(operatorId)
        ? prev.selectedOperators.filter(id => id !== operatorId)
        : [...prev.selectedOperators, operatorId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.packageId) {
      setError('Please select a tour package');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setError('Please select start and end dates');
      return;
    }
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      setError('End date must be after start date');
      return;
    }
    if (!formData.totalSeats || formData.totalSeats < 1) {
      setError('Total seats must be at least 1');
      return;
    }
    if (!formData.pricePerPerson || formData.pricePerPerson < 0) {
      setError('Please enter a valid price per person');
      return;
    }
    if (formData.selectedOperators.length === 0) {
      setError('Please assign at least one operator to this departure');
      return;
    }

    setLoading(true);
    try {

      // Create the departure and assign operators in one request
      const departureData = {
        packageId: formData.packageId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalSeats: parseInt(formData.totalSeats),
        pricePerPerson: parseFloat(formData.pricePerPerson),
        operatorIds: formData.selectedOperators
      };

      const res = await axios.post('/api/admin/group-departures', departureData);
      const newDeparture = res.data.departure;

      if (onDepartureCreated) {
        onDepartureCreated();
      }

      // Reset form
      setFormData({
        packageId: '',
        startDate: '',
        endDate: '',
        totalSeats: 40,
        pricePerPerson: '',
        selectedOperators: []
      });

      onClose();
    } catch (err) {
      console.error('Failed to create departure:', err);
      setError(err.response?.data?.message || 'Failed to create departure');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto sm:items-start sm:p-6" style={{ zIndex: 99999 }}>
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        ></div>
        
        {/* Modal Content */}
        <div className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-surface shadow-2xl animate-scale-in sm:rounded-2xl max-w-3xl" style={{ zIndex: 99999 }}>
          {/* Close Button */}
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute top-4 right-4 text-text-muted hover:text-text-muted transition-colors z-10"
          >
            <LuX aria-hidden="true" size={24} />
          </button>

          {/* Header */}
          <div className="bg-gradient-to-r from-info to-info p-6 text-white">
            <h2 className="text-2xl font-bold">Create New Group Departure</h2>
            <p className="text-on-brand/80 mt-1">Set up a new departure for a group tour package</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-start">
                <LuTriangleAlert aria-hidden="true" className="text-danger mt-1 mr-3 flex-shrink-0" />
                <div className="text-danger">{error}</div>
              </div>
            )}

            {/* Select Package */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-text mb-2">
                Tour Package *
              </label>
              <select
                value={formData.packageId}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-text focus:ring-2 focus:ring-brand"
                required
              >
                <option value="">-- Select a GROUP tour package --</option>
                {groupPackages.map(pkg => (
                  <option key={pkg._id} value={pkg._id}>
                    {pkg.title} ({pkg.defaultDays || 'N/A'} days)
                  </option>
                ))}
              </select>
              {groupPackages.length === 0 && (
                <p className="text-sm text-warning mt-2">
                  No GROUP packages found. Create a GROUP tour package first.
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-text mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-text"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-text"
                  required
                />
              </div>
            </div>

            {/* Capacity and Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-text mb-2">
                  Total Seats *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.totalSeats}
                  onChange={(e) => setFormData({ ...formData, totalSeats: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-text"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text mb-2">
                  Price Per Person (BDT) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.pricePerPerson}
                  onChange={(e) => setFormData({ ...formData, pricePerPerson: e.target.value })}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-text"
                  required
                />
              </div>
            </div>

            {/* Assign Operators */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-text mb-2">
                Assign Operators * (Select at least one)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3 bg-surface-muted">
                {operators.length > 0 ? (
                  operators.map(op => (
                    <label
                      key={op._id}
                      className={`flex items-center p-3 bg-surface rounded-lg transition-colors ${operatorStatus[op._id]?.unavailable ? 'opacity-60 cursor-not-allowed' : 'hover:bg-surface-muted cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedOperators.includes(op._id)}
                        onChange={() => operatorStatus[op._id]?.unavailable ? null : handleOperatorToggle(op._id)}
                        disabled={operatorStatus[op._id]?.unavailable}
                        className="mr-3 w-5 h-5 text-info"
                      />
                      <div className="flex items-center flex-1">
                        <div className="w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center font-bold mr-3">
                          {op.fullName?.charAt(0) || 'O'}
                        </div>
                        <div>
                          <div className="font-semibold text-text">
                            {op.fullName || 'Unknown'}
                          </div>
                          <div className="text-sm text-text-muted">
                            {op.email}
                          </div>
                          {operatorStatus[op._id]?.unavailable && (
                            <div className="text-xs text-danger mt-1">
                              {operatorStatus[op._id].reasons[0] || 'Unavailable for selected dates'}
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-text-muted text-center py-4">
                    No operators available. Add tour operators first.
                  </p>
                )}
              </div>
              {formData.selectedOperators.length > 0 && (
                <p className="text-sm text-success mt-2">
                  {formData.selectedOperators.length} operator(s) selected
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-brand text-white rounded-lg hover:opacity-90 disabled:bg-border transition-colors font-semibold"
              >
                {loading ? 'Creating...' : 'Create Departure'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-surface-muted text-text rounded-lg hover:bg-border transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateDepartureModal;
