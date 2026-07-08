import React, { useState, useEffect, useRef } from 'react';
import { FaComments, FaPaperPlane, FaUsers, FaBullhorn, FaUser, FaSearch } from 'react-icons/fa';

const MessagesAnnouncements = ({ openBookingId, openAdminId, onAdminOpened }) => {
  const operatorId = localStorage.getItem('userId');
  const [activeTab, setActiveTab] = useState('conversations');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [selectedTour, setSelectedTour] = useState('');
  const [tours, setTours] = useState([]);
  const [displayedMessageCount, setDisplayedMessageCount] = useState(7);
  const messagesEndRef = useRef(null);
  const previousMessagesCountRef = useRef(0);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh conversations every 5 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-open conversation if openBookingId is provided
  useEffect(() => {
    if (openBookingId && conversations.length > 0) {
      const conv = conversations.find(c => c.bookingId === openBookingId);
      if (conv) {
        loadConversation(conv);
      }
    }
    // No dependency on parent callback, just react to prop
  }, [openBookingId, conversations]);

  // Auto-open admin conversation if openAdminId is provided
  useEffect(() => {
    if (openAdminId && conversations.length > 0) {
      const conv = conversations.find(c => c.type === 'admin' && (c.adminId === openAdminId || c.customerId === openAdminId));
      if (conv) {
        (async () => {
          try {
            await loadConversation(conv);
            if (typeof onAdminOpened === 'function') onAdminOpened();
          } catch (err) {
            console.error('Error auto-opening admin conversation', err);
          }
        })();
      }
    }
  }, [openAdminId, conversations]);

  useEffect(() => {
    // Auto-refresh messages for selected conversation every 3 seconds
    if (selectedConversation) {
      const interval = setInterval(() => {
        loadConversationMessages(selectedConversation);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/operator/${operatorId}/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTours(data.groupDepartures || []);
      
      let allConvs = [];
      
      // Fetch booking-based conversations (customer-operator 1-on-1)
      const bookingsRes = await fetch(`/api/bookings?assignedOperator=${operatorId}`);
      if (bookingsRes.ok) {
      const bookingsData = await bookingsRes.json();
      let bookings = Array.isArray(bookingsData) ? bookingsData : (bookingsData.bookings || []);
      // Keep only group bookings (either explicit bookingType or groupDepartureId present)
      bookings = bookings.filter(b => b.bookingType === 'GROUP' || b.groupDepartureId);
        
      for (const booking of bookings) {
          // Fetch messages for this booking
          const msgRes = await fetch(`/api/messages/booking/${booking._id}`);
          const msgData = await msgRes.json();
          
          if (msgData.success && Array.isArray(msgData.messages) && msgData.messages.length > 0) {
              // Find the most recent message that involves this operator (sender or recipient)
              const messagesArr = msgData.messages;
              let lastMsg = null;
              for (let i = messagesArr.length - 1; i >= 0; i--) {
                const m = messagesArr[i];
                const sId = m.senderId?._id || m.senderId;
                const rId = m.recipientId?._id || m.recipientId;
                if (String(sId) === String(operatorId) || String(rId) === String(operatorId)) {
                  lastMsg = m;
                  break;
                }
              }
              if (lastMsg) {
                allConvs.push({
                  id: `booking-${booking._id}`,
                  bookingId: booking._id,
                  tourName: booking.packageId?.title || 'Tour Package',
                  customerId: booking.customerId?._id || booking.customerId,
                  customerName: booking.customerId?.fullName || booking.customerId?.name || 'Customer',
                  assignedOperator: booking.assignedOperator?._id || booking.assignedOperator,
                  lastMessage: lastMsg.content || 'No messages yet',
                  timestamp: new Date(lastMsg.sentAt),
                  unread: 0,
                  type: 'booking'
                });
              } else if (booking.customerId) {
                // No operator-involved messages; show as empty for this operator
                allConvs.push({
                  id: `booking-${booking._id}`,
                  bookingId: booking._id,
                  tourName: booking.packageId?.title || 'Tour Package',
                  customerId: booking.customerId?._id || booking.customerId,
                  customerName: booking.customerId?.fullName || booking.customerId?.name || 'Customer',
                  assignedOperator: booking.assignedOperator?._id || booking.assignedOperator,
                  lastMessage: 'No messages yet',
                  timestamp: new Date(booking.createdAt),
                  unread: 0,
                  type: 'booking'
                });
              }
            } else if (booking.customerId) {
              // Show conversation even if no messages yet
              allConvs.push({
                id: `booking-${booking._id}`,
                bookingId: booking._id,
                tourName: booking.packageId?.title || 'Tour Package',
                customerId: booking.customerId?._id || booking.customerId,
                customerName: booking.customerId?.fullName || booking.customerId?.name || 'Customer',
                assignedOperator: booking.assignedOperator?._id || booking.assignedOperator,
                lastMessage: 'No messages yet',
                timestamp: new Date(booking.createdAt),
                unread: 0,
                type: 'booking'
              });
            }
        }
      }
      
      // Fetch tour-based messages (group announcements / direct messages on tours)
      for (const tour of data.groupDepartures || []) {
        const msgRes = await fetch(`/api/messages?tourId=${tour._id}`);
        const msgData = await msgRes.json();
        if (msgData.success && Array.isArray(msgData.messages)) {
          // include latest broadcast for this tour (so operators see announcements)
          const broadcasts = msgData.messages.filter(m => m.isBroadcast);
          if (broadcasts.length > 0) {
            const lastBroadcast = broadcasts[broadcasts.length - 1];
            allConvs.push({
              id: `broadcast-${tour._id}`,
              tourId: tour._id,
              tourName: tour.packageId?.title || 'Tour',
              customerId: null,
              customerName: 'All Travelers',
              lastMessage: lastBroadcast.content,
              timestamp: new Date(lastBroadcast.sentAt),
              unread: 0,
              type: 'broadcast'
            });
          }
          // include 1:1 tour messages between operator and customers
          for (const msg of msgData.messages) {
            const senderId = msg.senderId?._id || msg.senderId;
            const recipientId = msg.recipientId?._id || msg.recipientId;
            // Only include messages where this operator is a participant (sender or recipient)
            if (String(senderId) !== String(operatorId) && String(recipientId) !== String(operatorId)) continue;
            // determine the customer participant (the non-operator)
            const customerId = String(senderId) === String(operatorId) ? recipientId : senderId;
            if (!customerId || String(customerId) === String(operatorId)) continue;
            const customerName = (msg.recipientId?._id === customerId ? msg.recipientId?.fullName : msg.senderId?.fullName) || 'Unknown';
            allConvs.push({
              id: `tour-${tour._id}-${customerId}-${operatorId}`,
              tourId: tour._id,
              tourName: tour.packageId?.title || 'Tour',
              customerId: customerId,
              customerName,
              lastMessage: msg.content,
              timestamp: new Date(msg.sentAt),
              unread: 0,
              type: 'tour'
            });
          }
        }
      }

      // Fetch admin->operator conversations (global admin messages)
      try {
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        const usersList = Array.isArray(usersData) ? usersData : (usersData.users || []);
        const admins = usersList.filter(u => {
          if (!u) return false;
          if (u.role && typeof u.role === 'string' && u.role.toUpperCase() === 'ADMIN') return true;
          if (Array.isArray(u.roles) && u.roles.map(r => (r||'').toString().toUpperCase()).includes('ADMIN')) return true;
          if (typeof u.roles === 'string' && u.roles.toUpperCase() === 'ADMIN') return true;
          return false;
        });
        for (const admin of admins) {
          try {
            const qs = new URLSearchParams({ userA: operatorId, userB: admin._id });
            const convRes = await fetch('/api/messages/conversation?' + qs.toString());
            const convData = await convRes.json();
            if (convData.success && Array.isArray(convData.messages) && convData.messages.length > 0) {
              const last = convData.messages[convData.messages.length - 1];
              allConvs.push({
                id: `admin-${admin._id}`,
                adminId: admin._id,
                customerId: admin._id,
                customerName: admin.fullName || admin.name || admin.email || 'Admin',
                lastMessage: last.content,
                timestamp: new Date(last.sentAt),
                unread: 0,
                type: 'admin'
              });
            }
          } catch (err) {
            /* ignore per-admin fetch errors */
          }
        }
      } catch (err) {
        console.error('Failed to load admin conversations', err);
      }
      
      // Remove duplicates (use conv.id which is unique per operator/tour/booking) and sort by timestamp
      const uniqueConvs = [];
      const seen = new Set();
      for (const conv of allConvs) {
        const key = conv.bookingId ? `booking-${conv.bookingId}` : conv.id;
        if (!seen.has(key)) {
          uniqueConvs.push(conv);
          seen.add(key);
        }
      }
      
      // Sort by timestamp descending
      uniqueConvs.sort((a, b) => b.timestamp - a.timestamp);
      
      // Update conversations list
      setConversations(uniqueConvs);
      
      // If there's a selected conversation, update it with latest data (match by id to avoid switching)
      if (selectedConversation) {
        const updatedSelected = uniqueConvs.find(c => c.id === selectedConversation.id);
        if (updatedSelected) setSelectedConversation(updatedSelected);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadConversation = async (conv) => {
    setSelectedConversation(conv);
    setDisplayedMessageCount(7); // Reset to show only 7 messages
    previousMessagesCountRef.current = 0; // Reset count for new conversation
    await loadConversationMessages(conv, true); // Initial load with scroll
    setConversations(conversations.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
  };
  
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };
  
  const loadConversationMessages = async (conv, shouldScroll = false) => {
    let fetchedMessages = [];
    
    // Fetch messages based on conversation type
    if (conv.type === 'booking' && conv.bookingId) {
      const res = await fetch(`/api/messages/booking/${conv.bookingId}`);
      const data = await res.json();
      const msgs = data.messages || [];
      // If this operator is the assigned operator for the booking, show the full thread.
      // Otherwise filter to only messages that involve this operator (sender or recipient).
      let filtered = msgs;
      if (conv.assignedOperator && String(conv.assignedOperator) === String(operatorId)) {
        filtered = msgs;
      } else {
        filtered = msgs.filter(msg => {
          const sId = msg.senderId?._id || msg.senderId;
          const rId = msg.recipientId?._id || msg.recipientId;
          return String(sId) === String(operatorId) || String(rId) === String(operatorId);
        });
      }
      fetchedMessages = filtered.map(msg => ({
        id: msg._id,
        sender: (msg.senderId?._id || msg.senderId) === operatorId ? 'operator' : 'customer',
        text: msg.content,
        timestamp: new Date(msg.sentAt)
      }));
    } else if (conv.tourId) {
      const res = await fetch(`/api/messages?tourId=${conv.tourId}`);
      const data = await res.json();
      const msgs = data.messages || [];
      if (conv.type === 'broadcast') {
        // show only broadcast messages for this tour
        const broadcasts = msgs.filter(m => m.isBroadcast).map(msg => ({
          id: msg._id,
          sender: (msg.senderId?._id || msg.senderId) === operatorId ? 'operator' : 'admin',
          text: msg.content,
          timestamp: new Date(msg.sentAt)
        }));
        fetchedMessages = broadcasts;
      } else {
        // Keep only messages between this operator and the conversation customer
        const filtered = msgs.filter(msg => {
          const sId = msg.senderId?._id || msg.senderId;
          const rId = msg.recipientId?._id || msg.recipientId;
          return (String(sId) === String(operatorId) && String(rId) === String(conv.customerId)) || (String(rId) === String(operatorId) && String(sId) === String(conv.customerId));
        });
        fetchedMessages = filtered.map(msg => ({
          id: msg._id,
          sender: (msg.senderId?._id || msg.senderId) === operatorId ? 'operator' : 'customer',
          text: msg.content,
          timestamp: new Date(msg.sentAt)
        }));
      }
    }
    else if (conv.type === 'admin' && conv.adminId) {
      try {
        const qs = new URLSearchParams({ userA: operatorId, userB: conv.adminId });
        const res = await fetch('/api/messages/conversation?' + qs.toString());
        const data = await res.json();
        const msgs = data.messages || [];
        fetchedMessages = msgs.map(msg => ({
          id: msg._id,
          sender: (msg.senderId?._id || msg.senderId) === operatorId ? 'operator' : 'admin',
          text: msg.content,
          timestamp: new Date(msg.sentAt)
        }));
      } catch (err) {
        console.error('Failed to load admin conversation', err);
        fetchedMessages = [];
      }
    }
    
    // Only update if messages have changed
    if (JSON.stringify(fetchedMessages) !== JSON.stringify(messages)) {
      const hadNewMessages = fetchedMessages.length > previousMessagesCountRef.current;
      setMessages(fetchedMessages);
      previousMessagesCountRef.current = fetchedMessages.length;
      
      // Scroll if it's initial load, explicit scroll requested, or new messages arrived
      if (shouldScroll || hadNewMessages) {
        setTimeout(() => scrollToBottom(), 100);
      }
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) return;
    if (selectedConversation.type === 'broadcast') {
      alert('Use the Broadcast tab to send announcements to all travelers.');
      return;
    }
    
    const payload = {
      senderId: operatorId,
      recipientId: selectedConversation.customerId,
      content: newMessage,
      isBroadcast: false
    };
    
    // Add bookingId or tourId based on conversation type
    if (selectedConversation.type === 'booking' && selectedConversation.bookingId) {
      payload.bookingId = selectedConversation.bookingId;
    } else if (selectedConversation.tourId) {
      payload.tourId = selectedConversation.tourId;
    }
    
    fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => res.json()).then(data => {
      if (data.success) {
        const newMsg = {
          id: data.data._id,
          sender: 'operator',
          text: newMessage,
          timestamp: new Date(data.data.sentAt)
        };
        const updatedMessages = [...messages, newMsg];
        setMessages(updatedMessages);
        previousMessagesCountRef.current = updatedMessages.length;
        setNewMessage('');
        setConversations(conversations.map(c =>
          c.id === selectedConversation.id
            ? { ...c, lastMessage: newMessage, timestamp: new Date() }
            : c
        ));
        // Scroll to bottom after sending
        setTimeout(() => scrollToBottom(), 100);
      }
    }).catch(err => {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    });
  };

  const sendBroadcast = () => {
    if (!broadcastMessage.trim() || !selectedTour) {
      alert('Please select a tour and enter a message');
      return;
    }
    if (window.confirm(`Send this message to all travelers on ${tours.find(t => t._id === selectedTour)?.packageId?.title}?`)) {
      fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourId: selectedTour,
          senderId: operatorId,
          content: broadcastMessage,
          isBroadcast: true
        })
      }).then(res => res.json()).then(data => {
        if (data.success) {
          alert('Broadcast message sent successfully!');
          setBroadcastMessage('');
          setSelectedTour('');
        }
      });
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))} min ago`;
    } else if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex-1 flex flex-col min-h-0">
        <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab('conversations')}
              className={`flex items-center px-6 py-4 font-semibold border-b-2 transition-colors ${activeTab === 'conversations' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <FaUser className="mr-2" />
              1-on-1 Conversations
              {conversations.reduce((sum, c) => sum + c.unread, 0) > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {conversations.reduce((sum, c) => sum + c.unread, 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('broadcast')}
              className={`flex items-center px-6 py-4 font-semibold border-b-2 transition-colors ${activeTab === 'broadcast' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <FaBullhorn className="mr-2" />
              Broadcast to Tour
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">{/* Conversations Tab */}
          {activeTab === 'conversations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[calc(100vh-12rem)]">
              {/* Conversation List */}
              <div className="lg:col-span-1 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col h-full max-h-full overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search conversations..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-orange-500 scrollbar-track-gray-200 dark:scrollbar-track-gray-700">
                  {conversations.length === 0 ? (
                    <div className="p-8 text-center text-gray-600 dark:text-gray-400">
                      <FaUser className="text-5xl mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No conversations yet</p>
                      <p className="text-sm mt-1">Messages from customers will appear here</p>
                    </div>
                  ) : (
                    conversations.map(conv => (
                        <button
                          key={conv.id}
                        onClick={() => loadConversation(conv)}
                        className={`w-full text-left p-4 transition-all hover:bg-white dark:hover:bg-gray-800 ${
                          selectedConversation?.customerId === conv.customerId && selectedConversation?.tourId === conv.tourId 
                            ? 'bg-white dark:bg-gray-800 border-l-4 border-orange-600' 
                            : 'border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                              selectedConversation?.customerId === conv.customerId ? 'bg-orange-600' : 'bg-gradient-to-br from-orange-500 to-orange-600'
                            }`}>
                              {conv.customerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-gray-900 dark:text-white text-base truncate">{conv.customerName}</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                                <FaComments className="text-[10px]" />
                                {conv.tourName}
                              </p>
                            </div>
                          </div>
                          {conv.unread > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold flex-shrink-0">{conv.unread}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 truncate ml-15">{conv.lastMessage}</p>
                        <p className="text-xs text-gray-400 mt-1 ml-15">{formatTime(conv.timestamp)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
              {/* Chat Area */}
              <div className="lg:col-span-2 flex flex-col bg-white dark:bg-gray-800 h-full min-h-0">
                {!selectedConversation ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 flex items-center justify-center mx-auto mb-4">
                        <FaComments className="text-4xl text-orange-600 dark:text-orange-400" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Conversation Selected</h3>
                      <p className="text-gray-600 dark:text-gray-400">Choose a conversation from the list to start messaging</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat Header */}
                    <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4 shadow-lg flex-shrink-0">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg">
                          {selectedConversation.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-xl">{selectedConversation.customerName}</h3>
                          <p className="text-sm text-orange-100 flex items-center gap-2">
                            <FaComments className="text-xs" />
                            {selectedConversation.tourName}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-0 scrollbar-thin scrollbar-thumb-orange-500 scrollbar-track-gray-200 dark:scrollbar-track-gray-700 hover:scrollbar-thumb-orange-600">
                      <div className="p-6 max-w-4xl mx-auto">
                        {messages.length === 0 ? (
                          <div className="flex items-center justify-center min-h-[400px]">
                            <div className="text-center text-gray-500 dark:text-gray-400">
                              <FaComments className="text-5xl mx-auto mb-3 opacity-30" />
                              <p className="font-medium">No messages yet</p>
                              <p className="text-sm mt-1">Start the conversation below</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Load More Button */}
                            {messages.length > displayedMessageCount && (
                              <div className="text-center mb-4">
                                <button
                                  onClick={() => setDisplayedMessageCount(prev => Math.min(prev + 10, messages.length))}
                                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors shadow-md"
                                >
                                  Load {Math.min(10, messages.length - displayedMessageCount)} older messages
                                </button>
                              </div>
                            )}
                            
                            {/* Display limited messages */}
                            {messages.slice(-displayedMessageCount).map(msg => (
                              <div key={msg.id} className={`flex mb-4 ${msg.sender === 'operator' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`group flex items-end gap-2 max-w-[75%] ${msg.sender === 'operator' ? 'flex-row-reverse' : 'flex-row'}`}>
                                  {msg.sender !== 'operator' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                      {selectedConversation.customerName.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className={`px-5 py-3 rounded-2xl shadow-md ${
                                    msg.sender === 'operator' 
                                      ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-br-sm' 
                                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                                  }`}>
                                    <p className="text-[15px] leading-relaxed">{msg.text}</p>
                                    <p className={`text-[11px] mt-1.5 ${msg.sender === 'operator' ? 'text-orange-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Input */}
                    <div className="bg-white dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shadow-lg flex-shrink-0">
                      <div className="flex gap-3 max-w-4xl mx-auto">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                          placeholder="Type your message..."
                          className="flex-1 px-5 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900 transition-all"
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                        >
                          <FaPaperPlane />
                          Send
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Broadcast Tab */}
          {activeTab === 'broadcast' && (
            <div className="max-w-3xl mx-auto">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Tour</label>
                  <select
                    value={selectedTour}
                    onChange={(e) => setSelectedTour(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Choose a tour...</option>
                    {tours.map(tour => (
                      <option key={tour._id} value={tour._id}>
                        {tour.packageId?.title} - {new Date(tour.startDate).toLocaleDateString()} ({tour.bookedSeats} travelers)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Broadcast Message</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter your message to all travelers on this tour..."
                    rows="6"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  ></textarea>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This message will be sent via SMS and email to all travelers.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Examples of broadcast messages:</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                    <li>• "Weather update: Rain expected tomorrow. Please bring umbrellas."</li>
                    <li>• "Meeting point changed to Hotel Main Entrance at 9 AM."</li>
                    <li>• "Don't forget to bring your ID and booking confirmation."</li>
                    <li>• "Tour delayed by 1 hour due to traffic. New departure: 10 AM."</li>
                  </ul>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setBroadcastMessage('');
                      setSelectedTour('');
                    }}
                    className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold"
                  >
                    Clear
                  </button>
                  <button
                    onClick={sendBroadcast}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold flex items-center"
                  >
                    <FaBullhorn className="mr-2" />
                    Send Broadcast
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesAnnouncements;
