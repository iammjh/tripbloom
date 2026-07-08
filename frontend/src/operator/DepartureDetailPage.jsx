import React, { useState, useEffect } from 'react';
import { FaArrowLeft, FaUsers, FaCheckCircle, FaTimesCircle, FaPhone, FaMapMarkedAlt, FaClock, FaExclamationTriangle, FaPlay, FaStop, FaSms, FaEnvelope, FaBus, FaClipboardCheck } from 'react-icons/fa';

const DepartureDetailPage = ({ departure, onBack }) => {
  const [activeTab, setActiveTab] = useState('passengers');
  const [passengers, setPassengers] = useState([]);
  const [checkedIn, setCheckedIn] = useState({});
  const [itinerary, setItinerary] = useState([]);
  const [safetyChecklist, setSafetyChecklist] = useState({
    firstAid: false,
    vehicleDocs: false,
    foodHygiene: false,
    emergencyContacts: false,
    routePlanned: false
  });
  const [tourStarted, setTourStarted] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [seatMap, setSeatMap] = useState([]);
  // Fetch seat map from backend
  useEffect(() => {
    if (departure && departure._id) {
      fetch(`/api/group-departure/${departure._id}/seat-map`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data.seatMap)) {
            // Transform flat seatMap to 2D array for rendering
            const seatsPerRow = 4;
            const rows = [];
            for (let i = 0; i < data.seatMap.length; i += seatsPerRow) {
              rows.push(data.seatMap.slice(i, i + seatsPerRow));
            }
            setSeatMap(rows);
          } else {
            setSeatMap([]);
          }
        })
        .catch(() => setSeatMap([]));
    }
  }, [departure]);

  useEffect(() => {
    fetchPassengers();
    // initialize safety checklist / itinerary / tourStarted from departure payload if present
    if (departure) {
      if (departure.itinerary && Array.isArray(departure.itinerary) && departure.itinerary.length > 0) {
        setItinerary(departure.itinerary);
      } else {
        fetchItinerary();
      }
      if (departure.safetyChecklist) {
        setSafetyChecklist({ ...safetyChecklist, ...departure.safetyChecklist });
      }
      if (typeof departure.tourStarted === 'boolean') setTourStarted(departure.tourStarted);
    } else {
      fetchItinerary();
    }
    initializeSeatMap();
  }, [departure]);

  // Helper to persist departure updates
  const saveDepartureUpdates = async (payload = {}) => {
    if (!departure || !departure._id) return;
    try {
      const res = await fetch(`/api/admin/group-departures/${departure._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error('Failed to save departure updates', txt);
      } else {
        // Optionally update local departure object if needed
        const json = await res.json();
        // console.log('Saved departure update:', json);
      }
    } catch (err) {
      console.error('Error saving departure updates', err);
    }
  };
  const fetchPassengers = async () => {
    if (!departure || !departure._id) return;

    try {
      // Fetch all bookings to compute per-package sequences for display ids
      const allRes = await fetch('/api/bookings');
      const allJson = await allRes.json();
      const allBookings = Array.isArray(allJson.bookings) ? allJson.bookings : allJson.bookings || [];

      // Build package -> bookings map (all bookings) to compute sequence numbers
      const byPackage = {};
      allBookings.forEach(b => {
        const pkgId = b.packageId?._id || b.packageId;
        if (!pkgId) return;
        const key = pkgId.toString();
        byPackage[key] = byPackage[key] || [];
        byPackage[key].push(b);
      });

      // Sort each package list by createdAt ascending so sequence is deterministic
      Object.keys(byPackage).forEach(k => {
        byPackage[k].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });

      // Now filter bookings for this departure
      const bookingsRes = await fetch(`/api/bookings?groupDepartureId=${departure._id}`);
      const bookingsJson = await bookingsRes.json();
      const bookings = Array.isArray(bookingsJson.bookings) ? bookingsJson.bookings : bookingsJson.bookings || [];

      // Attach displayId to bookings
      const withDisplay = bookings.map(b => {
        const pkg = b.packageId || {};
        const pkgId = pkg._id || pkg;
        const list = pkgId ? byPackage[pkgId.toString()] || [] : [];
        const index = list.findIndex(x => (x._id || x).toString() === (b._id || b).toString());
        const seq = index >= 0 ? index + 1 : 1;

        const pkgCode = pkg.packageCode || pkg.code || pkg.shortCode || pkg.packageIdCode;
        let prefix;
        if (pkgCode) {
          prefix = pkgCode.toString().toUpperCase();
        } else if (pkg.title) {
          const words = pkg.title.split(/\s+/).filter(Boolean);
          const a = (words[0] || '').charAt(0) || 'X';
          const b2 = (words[1] || words[0] || '').charAt(0) || 'X';
          prefix = (a + b2).toUpperCase() + '000';
        } else {
          prefix = 'TB000';
        }

        return { ...b, _displayId: `${prefix}${seq}` };
      });

      // Filter out cancelled and pending bookings (do not show those passengers)
      const visibleBookings = withDisplay.filter(b => {
        const st = (b.status || '').toString().toUpperCase();
        return st !== 'CANCELLED' && st !== 'PENDING';
      });

      // Flatten travelers from visible bookings into passenger rows
      const rows = [];
      visibleBookings.forEach(booking => {
        const bookingId = booking._displayId || booking._id;
        const reserved = Array.isArray(booking.reservedSeats) ? booking.reservedSeats : [];
        const paymentSuccess = Array.isArray(booking.payments) && booking.payments.some(p => p.status === 'SUCCESS');

        (booking.travelers || []).forEach((traveler, idx) => {
          const seatRaw = reserved[idx] ?? null;
          const seatNumber = seatRaw ? Number(seatRaw) || seatRaw : rows.length + 1; // fallback sequential

          rows.push({
            id: `${booking._id}-${idx}`,
            name: traveler.fullName || traveler.name || `${traveler.firstName || ''} ${traveler.lastName || ''}`.trim() || 'Guest',
            bookingId,
            phone: traveler.phone || booking.customerPhone || booking.customerId?.phone || '',
            paymentStatus: paymentSuccess ? 'PAID' : (booking.status || 'PENDING'),
            seatNumber,
            emergencyContact: traveler.phoneEmergency || traveler.emergencyContact || null
          });
        });
      });

      setPassengers(rows);

      // Initialize check-in status (all false by default)
      const checkinStatus = {};
      rows.forEach(p => { checkinStatus[p.id] = false; });
      setCheckedIn(checkinStatus);
    } catch (err) {
      // fallback: empty
      setPassengers([]);
      setCheckedIn({});
    }
  };

  const fetchItinerary = () => {
    // Mock itinerary data
    const mockItinerary = [
      {
        day: 1,
        stops: [
          { time: '09:00 AM', name: 'Departure Point', location: 'Hotel Lobby', status: 'pending', notes: 'Check all passengers present' },
          { time: '11:00 AM', name: 'Rest Stop', location: 'Highway Service Area', status: 'pending', notes: '30 min break' },
          { time: '01:00 PM', name: 'Lunch', location: 'Restaurant Paradise', status: 'pending', notes: 'Pre-booked buffet' },
          { time: '03:00 PM', name: 'Sightseeing', location: 'Historical Monument', status: 'pending', notes: 'Guided tour 90 mins' },
          { time: '06:00 PM', name: 'Hotel Check-in', location: 'Grand Hotel', status: 'pending', notes: 'Room allocation ready' }
        ]
      }
    ];
    setItinerary(mockItinerary);
  };

  const initializeSeatMap = () => {
    const totalSeats = departure.totalSeats || 40;
    const rows = Math.ceil(totalSeats / 4);
    const seats = [];
    
    for (let row = 0; row < rows; row++) {
      const rowSeats = [];
      for (let col = 0; col < 4; col++) {
        const seatNum = row * 4 + col + 1;
        if (seatNum <= totalSeats) {
          const passenger = passengers.find(p => p.seatNumber === seatNum);
          rowSeats.push({
            number: seatNum,
            status: seatNum > departure.bookedSeats ? 'free' : 
                   passenger && checkedIn[passenger.id] ? 'booked-checked' : 'booked',
            passenger: passenger
          });
        } else {
          rowSeats.push(null);
        }
      }
      seats.push(rowSeats);
    }
    setSeatMap(seats);
  };

  useEffect(() => {
    if (passengers.length > 0) {
      initializeSeatMap();
    }
  }, [passengers, checkedIn]);

  const handleCheckIn = (passengerId) => {
    setCheckedIn(prev => {
      const next = { ...prev, [passengerId]: !prev[passengerId] };
      // update seatMap entries to reflect checked state and persist
      const flat = seatMap.flat().filter(Boolean).map(s => ({ ...s }));
      const p = passengers.find(x => x.id === passengerId);
      if (p) {
        for (const seat of flat) {
          if (Number(seat.number) === Number(p.seatNumber)) {
            seat.status = next[passengerId] ? 'booked-checked' : 'booked';
            seat.checkedIn = !!next[passengerId];
          }
        }
        // send updated seatMap to server (flattened)
        const seatMapPayload = flat.map(s => ({ seatNumber: s.number, status: s.status, checkedIn: s.checkedIn }));
        saveDepartureUpdates({ seatMap: seatMapPayload, seatMapChecked: true });
      }
      return next;
    });
  };

  const handleMarkAllPresent = () => {
    if (window.confirm('Are you sure you want to mark all passengers as present?')) {
      const allChecked = {};
      passengers.forEach(p => { allChecked[p.id] = true; });
      setCheckedIn(allChecked);
      // Update seatMap
      const flat = seatMap.flat().filter(Boolean).map(s => ({ ...s }));
      const seatMapPayload = flat.map(s => ({ seatNumber: s.number, status: s.passenger ? 'booked-checked' : s.status, checkedIn: !!s.passenger }));
      saveDepartureUpdates({ seatMap: seatMapPayload, seatMapChecked: true });
    }
  };

  const handleSendReminder = () => {
    const notCheckedIn = passengers.filter(p => !checkedIn[p.id]);
    alert(`Sending reminder to ${notCheckedIn.length} passengers who haven't checked in.`);
  };

  const handleStartTour = async () => {
    const allChecklistDone = Object.values(safetyChecklist).every(v => v);
    if (!allChecklistDone) {
      alert('Complete mandatory safety checks before starting the tour!');
      setActiveTab('checklist');
      return;
    }

    if (window.confirm('Mark tour as started?')) {
      setTourStarted(true);
      await saveDepartureUpdates({ safetyChecklist, tourStarted: true });
      alert('Tour started successfully!');
    }
  };

  const handleCompleteTour = async () => {
    if (window.confirm('Mark tour as completed?')) {
      // mark tourStarted false and set status to CLOSED
      setTourStarted(false);
      await saveDepartureUpdates({ tourStarted: false, status: 'CLOSED' });
      alert('Tour completed successfully!');
      onBack();
    }
  };

  const handleStopAction = (stopIndex, dayIndex) => {
    const newItinerary = [...itinerary];
    const currentStatus = newItinerary[dayIndex].stops[stopIndex].status;
    newItinerary[dayIndex].stops[stopIndex].status = currentStatus === 'completed' ? 'pending' : 'completed';
    setItinerary(newItinerary);
    // persist
    saveDepartureUpdates({ itinerary: newItinerary });
  };

  const handleToggleChecklist = (key) => {
    setSafetyChecklist(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveDepartureUpdates({ safetyChecklist: next });
      return next;
    });
  };

  const handleDelayStop = (stopIndex, dayIndex) => {
    const reason = prompt('Enter reason for delay:');
    if (reason) {
      alert(`Delay recorded. Notification sent to travelers about: ${reason}`);
    }
  };

  const handleAddIncident = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const incident = {
      id: Date.now(),
      time: new Date().toLocaleString(),
      description: formData.get('description'),
      severity: formData.get('severity')
    };
    setIncidents([...incidents, incident]);
    setShowIncidentForm(false);
    e.target.reset();
  };

  const checkedInCount = Object.values(checkedIn).filter(v => v).length;
  const noShowCount = passengers.length - checkedInCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <button 
          onClick={onBack}
          className="flex items-center text-orange-600 hover:text-orange-700 font-semibold mb-4"
        >
          <FaArrowLeft className="mr-2" />
          Back to Departures
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {departure.packageId?.title || 'Tour Package'}
            </h1>
            <div className="flex flex-wrap gap-4 text-gray-600 dark:text-gray-400">
              <span className="flex items-center">
                <FaClock className="mr-2 text-orange-600" />
                {new Date(departure.startDate).toLocaleString()} - {new Date(departure.endDate).toLocaleString()}
              </span>
              <span className="flex items-center">
                <FaMapMarkedAlt className="mr-2 text-orange-600" />
                Meeting Point: {departure.packageId?.destination || 'TBD'}
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Quick Stats</div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{checkedInCount}</div>
                <div className="text-xs text-gray-500">Checked-in</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{passengers.length}</div>
                <div className="text-xs text-gray-500">Booked</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{noShowCount}</div>
                <div className="text-xs text-gray-500">No-show</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex overflow-x-auto">
            {[
              { id: 'passengers', label: 'Passenger List', icon: FaUsers },
              { id: 'seats', label: 'Seat Map', icon: FaBus },
              { id: 'itinerary', label: 'Itinerary', icon: FaMapMarkedAlt },
              { id: 'checklist', label: 'Safety & Checklist', icon: FaClipboardCheck }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <tab.icon className="mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Passenger List Tab */}
          {activeTab === 'passengers' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Passenger List</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSendReminder}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                  >
                    <FaSms className="mr-2" />
                    Send Reminder
                  </button>
                  <button 
                    onClick={handleMarkAllPresent}
                    className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
                  >
                    <FaCheckCircle className="mr-2" />
                    Mark All Present
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Check-in</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Booking ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Seat</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Emergency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {passengers.map(passenger => (
                      <tr key={passenger.id} className={`${checkedIn[passenger.id] ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checkedIn[passenger.id] || false}
                            onChange={() => handleCheckIn(passenger.id)}
                            className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white">{passenger.name}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{passenger.bookingId}</td>
                        <td className="px-4 py-3">
                          <a href={`tel:${passenger.phone}`} className="flex items-center text-blue-600 hover:text-blue-700">
                            <FaPhone className="mr-2 text-xs" />
                            {passenger.phone}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{passenger.seatNumber}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            passenger.paymentStatus === 'PAID' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          }`}>
                            {passenger.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {passenger.emergencyContact ? (
                            <span className="text-green-600 text-sm">✓ Added</span>
                          ) : (
                            <span className="text-red-600 text-sm flex items-center">
                              <FaExclamationTriangle className="mr-1" /> Missing
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seat Map Tab */}
          {activeTab === 'seats' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Bus Seat Map</h2>
              {seatMap.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400">No seat map available.</div>
              ) : (
                <div className="flex items-start gap-8">
                  <div className="flex-1">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6">
                      {/* Driver */}
                      <div className="mb-6 flex justify-end">
                        <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                          🚗
                        </div>
                      </div>
                      {/* Seats */}
                      <div className="space-y-3">
                        {seatMap.map((row, rowIdx) => (
                          <div key={rowIdx} className="flex gap-3 justify-center">
                            {row.map((seat, colIdx) => (
                              <div key={colIdx} className="flex-shrink-0">
                                {seat ? (
                                  <div
                                    className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer transition-all ${
                                      seat.status === 'free' 
                                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                        : seat.status === 'booked-checked'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-orange-500 text-white'
                                    }`}
                                    title={seat.passenger ? `${seat.passenger.name} (${seat.passenger.bookingId})` : 'Free'}
                                  >
                                    {seat.number}
                                  </div>
                                ) : (
                                  <div className="w-14 h-14"></div>
                                )}
                              </div>
                            ))}
                            {/* aisle spacing */}
                            {row.length > 1 && <div className="w-8"></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="w-64">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">Legend</h3>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-500 rounded mr-3"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Booked & Checked-in</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-orange-500 rounded mr-3"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Booked (Not checked-in)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded mr-3"></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Free</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Itinerary Tab */}
          {activeTab === 'itinerary' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Day-wise Itinerary</h2>
              
              {itinerary.map((day, dayIdx) => (
                <div key={dayIdx} className="mb-8">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                    <span className="bg-orange-600 text-white px-3 py-1 rounded-full mr-3">Day {day.day}</span>
                  </h3>
                  
                  <div className="space-y-3">
                    {day.stops.map((stop, stopIdx) => (
                      <div 
                        key={stopIdx}
                        className={`p-4 rounded-lg border-l-4 ${
                          stop.status === 'completed' 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span className="font-bold text-orange-600 mr-4">{stop.time}</span>
                              <h4 className="font-bold text-gray-900 dark:text-white">{stop.name}</h4>
                              {stop.status === 'completed' && (
                                <FaCheckCircle className="ml-2 text-green-600" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center mb-1">
                              <FaMapMarkedAlt className="mr-2" />
                              {stop.location}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 italic">{stop.notes}</p>
                          </div>
                          
                          <div className="flex gap-2 ml-4">
                            <button 
                              onClick={() => handleStopAction(stopIdx, dayIdx)}
                              className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                                stop.status === 'completed'
                                  ? 'bg-gray-300 text-gray-700'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                            >
                              {stop.status === 'completed' ? 'Undo' : 'Complete'}
                            </button>
                            <button 
                              onClick={() => handleDelayStop(stopIdx, dayIdx)}
                              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-semibold"
                            >
                              Delay
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Safety & Checklist Tab */}
          {activeTab === 'checklist' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Pre-Trip Safety Checklist</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {Object.entries({
                  firstAid: 'First-aid box checked',
                  vehicleDocs: 'Vehicle documents verified',
                  foodHygiene: 'Food hygiene checked',
                  emergencyContacts: 'Emergency contacts verified',
                  routePlanned: 'Route planned and reviewed'
                }).map(([key, label]) => {
                  const checked = !!safetyChecklist[key];
                  const containerClass = `p-4 rounded-lg border-2 cursor-pointer transition-all ${checked ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`;
                  const badgeClass = `w-8 h-8 rounded-full flex items-center justify-center ${checked ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`;

                  return (
                    <div key={key} className={containerClass} onClick={() => handleToggleChecklist(key)}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-white">{label}</span>
                        <div className={badgeClass}>
                          {checked ? <FaCheckCircle className="text-white" /> : <FaTimesCircle className="text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Incident Log</h2>
              
              <div className="mb-4">
                <button
                  onClick={() => setShowIncidentForm(!showIncidentForm)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                >
                  + Log Incident
                </button>
              </div>

              {showIncidentForm && (
                <form onSubmit={handleAddIncident} className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4">
                  <div className="mb-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows="3"
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Severity
                    </label>
                    <select
                      name="severity"
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold">
                      Save Incident
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowIncidentForm(false)}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {incidents.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400 text-center py-8">No incidents logged</p>
                ) : (
                  incidents.map(incident => (
                    <div key={incident.id} className={`p-4 rounded-lg border-l-4 ${
                      incident.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900/30 border-red-600' :
                      incident.severity === 'HIGH' ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-600' :
                      incident.severity === 'MEDIUM' ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-600' :
                      'bg-blue-100 dark:bg-blue-900/30 border-blue-600'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white mb-1">{incident.description}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{incident.time}</div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          incident.severity === 'CRITICAL' ? 'bg-red-600 text-white' :
                          incident.severity === 'HIGH' ? 'bg-orange-600 text-white' :
                          incident.severity === 'MEDIUM' ? 'bg-yellow-600 text-white' :
                          'bg-blue-600 text-white'
                        }`}>
                          {incident.severity}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Tour Actions</h2>
        <div className="flex gap-4">
          {!tourStarted ? (
            <button 
              onClick={handleStartTour}
              className="flex-1 flex items-center justify-center px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105"
            >
              <FaPlay className="mr-3" />
              Mark Tour as Started
            </button>
          ) : (
            <button 
              onClick={handleCompleteTour}
              className="flex-1 flex items-center justify-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105"
            >
              <FaCheckCircle className="mr-3" />
              Mark Tour as Completed
            </button>
          )}
          <button className="flex-1 flex items-center justify-center px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105">
            <FaExclamationTriangle className="mr-3" />
            Request Emergency Help
          </button>
        </div>
      </div>
    </div>
  );
};

export default DepartureDetailPage;
