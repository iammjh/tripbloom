import React, { useState, useEffect } from 'react';
import { FaClipboardList, FaUpload, FaFileAlt, FaCheckCircle, FaTrash, FaEdit, FaPlus, FaCalendarAlt } from 'react-icons/fa';

const ItinerariesManager = () => {
  const operatorId = localStorage.getItem('userId');
  const [departures, setDepartures] = useState([]);
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [itinerary, setItinerary] = useState({ days: [] });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [editingDay, setEditingDay] = useState(null);

  useEffect(() => {
    fetchDepartures();
  }, []);

  const fetchDepartures = async () => {
    try {
      const res = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      
      // Filter upcoming departures
      const upcoming = (data.groupDepartures || []).filter(dep => 
        new Date(dep.startDate) > new Date()
      );
      setDepartures(upcoming);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadItinerary = (departure) => {
    setSelectedDeparture(departure);
    
    // Mock itinerary - in real app, fetch from backend
    const mockItinerary = {
      departureId: departure._id,
      days: [
        {
          dayNumber: 1,
          date: new Date(departure.startDate),
          activities: [
            { time: '09:00', name: 'Departure', location: 'Hotel Lobby', notes: 'Be on time' },
            { time: '13:00', name: 'Lunch', location: 'Restaurant', notes: 'Pre-booked' }
          ]
        }
      ]
    };
    setItinerary(mockItinerary);
  };

  const addDay = () => {
    const newDay = {
      dayNumber: itinerary.days.length + 1,
      date: new Date(),
      activities: []
    };
    setItinerary({ ...itinerary, days: [...itinerary.days, newDay] });
  };

  const addActivity = (dayIndex) => {
    const newActivity = { time: '09:00', name: '', location: '', notes: '' };
    const updatedDays = [...itinerary.days];
    updatedDays[dayIndex].activities.push(newActivity);
    setItinerary({ ...itinerary, days: updatedDays });
  };

  const updateActivity = (dayIndex, activityIndex, field, value) => {
    const updatedDays = [...itinerary.days];
    updatedDays[dayIndex].activities[activityIndex][field] = value;
    setItinerary({ ...itinerary, days: updatedDays });
  };

  const removeActivity = (dayIndex, activityIndex) => {
    const updatedDays = [...itinerary.days];
    updatedDays[dayIndex].activities.splice(activityIndex, 1);
    setItinerary({ ...itinerary, days: updatedDays });
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const newFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      uploadedAt: new Date()
    }));
    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  const removeFile = (fileId) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== fileId));
  };

  const saveItinerary = async () => {
    if (window.confirm('Save this itinerary?')) {
      // In real app, send to backend
      alert('Itinerary saved successfully!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <FaClipboardList className="mr-3 text-orange-600" />
          Itineraries & Checklists
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Upload and manage trip plans, safety documents, and itineraries
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Departure Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Select Departure</h2>
          <div className="space-y-2">
            {departures.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">No upcoming departures</p>
            ) : (
              departures.map(dep => (
                <button
                  key={dep._id}
                  onClick={() => loadItinerary(dep)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedDeparture?._id === dep._id
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-orange-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    {dep.packageId?.title}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                    <FaCalendarAlt className="mr-2" />
                    {new Date(dep.startDate).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Itinerary Editor */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          {!selectedDeparture ? (
            <div className="text-center py-12">
              <FaClipboardList className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Select a departure to manage itinerary</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Itinerary: {selectedDeparture.packageId?.title}
                </h2>
                <div className="flex gap-2">
                  <button 
                    onClick={addDay}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center"
                  >
                    <FaPlus className="mr-2" />
                    Add Day
                  </button>
                  <button 
                    onClick={saveItinerary}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center"
                  >
                    <FaCheckCircle className="mr-2" />
                    Save
                  </button>
                </div>
              </div>

              {/* Days */}
              <div className="space-y-6">
                {itinerary.days.map((day, dayIdx) => (
                  <div key={dayIdx} className="border-2 border-gray-200 dark:border-gray-600 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Day {day.dayNumber}
                        <span className="ml-3 text-sm text-gray-500">
                          {day.date.toLocaleDateString()}
                        </span>
                      </h3>
                      <button 
                        onClick={() => addActivity(dayIdx)}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold"
                      >
                        + Activity
                      </button>
                    </div>

                    {/* Activities */}
                    <div className="space-y-3">
                      {day.activities.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                          No activities added yet
                        </p>
                      ) : (
                        day.activities.map((activity, actIdx) => (
                          <div key={actIdx} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <div className="grid grid-cols-12 gap-3 items-start">
                              <input
                                type="time"
                                value={activity.time}
                                onChange={(e) => updateActivity(dayIdx, actIdx, 'time', e.target.value)}
                                className="col-span-2 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                              />
                              <input
                                type="text"
                                placeholder="Activity name"
                                value={activity.name}
                                onChange={(e) => updateActivity(dayIdx, actIdx, 'name', e.target.value)}
                                className="col-span-3 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                              />
                              <input
                                type="text"
                                placeholder="Location"
                                value={activity.location}
                                onChange={(e) => updateActivity(dayIdx, actIdx, 'location', e.target.value)}
                                className="col-span-3 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                              />
                              <input
                                type="text"
                                placeholder="Notes"
                                value={activity.notes}
                                onChange={(e) => updateActivity(dayIdx, actIdx, 'notes', e.target.value)}
                                className="col-span-3 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                              />
                              <button
                                onClick={() => removeActivity(dayIdx, actIdx)}
                                className="col-span-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}

                {itinerary.days.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">No days added yet</p>
                    <button 
                      onClick={addDay}
                      className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold"
                    >
                      Add First Day
                    </button>
                  </div>
                )}
              </div>

              {/* File Uploads */}
              <div className="mt-6 pt-6 border-t-2 border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FaFileAlt className="mr-2 text-orange-600" />
                  Supporting Documents
                </h3>
                
                <div className="mb-4">
                  <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="text-center">
                      <FaUpload className="text-3xl text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Click to upload PDF, DOCX, or images
                      </p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple 
                      accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div className="flex items-center">
                          <FaFileAlt className="text-orange-600 mr-3" />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024).toFixed(1)} KB • {file.uploadedAt.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFile(file.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItinerariesManager;
