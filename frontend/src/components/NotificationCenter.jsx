import { LuBell, LuCircleCheck, LuCircleX, LuClock, LuDollarSign, LuIdCard, LuMessagesSquare, LuTriangleAlert, LuUser, LuX } from 'react-icons/lu';
import React, { useState, useEffect } from 'react';


const NotificationCenter = ({ userId, userRole, onOpenChat, onOpenAdminChat }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewedNotifications, setViewedNotifications] = useState(() => {
    // Load viewed notifications from localStorage
    const saved = localStorage.getItem(`viewedNotifications_${userId}`);
    return saved ? JSON.parse(saved) : [];
  });

  // Recompute unread count based on viewed IDs and seen-chat timestamps
  useEffect(() => {
    try {
      const seenAdmin = JSON.parse(localStorage.getItem('seenAdminChatTimestamps') || '{}');
      const seenOperator = JSON.parse(localStorage.getItem('seenOperatorMsgTimestamps') || '{}');
      let unread = 0;
      for (const n of notifications) {
        // For chat-related notifications rely on seen timestamps so stale viewed IDs don't suppress new messages
        if (n.type === 'admin-chat') {
          const last = new Date(n.timestamp).getTime();
          const seen = seenAdmin[n.adminId] || 0;
          if (last > seen) unread++;
        } else if (n.type === 'message' && n.bookingId) {
          const seen = seenOperator[n.bookingId] || 0;
          const last = n.lastMsgTime || new Date(n.timestamp).getTime();
          if (last > seen) unread++;
        } else {
          // Non-chat notifications use the viewedNotifications list
          if (!viewedNotifications.includes(n.id)) unread++;
        }
      }
      setUnreadCount(unread);
    } catch (e) {
      // fallback: keep existing unreadCount
    }
  }, [notifications, viewedNotifications]);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      
      // Auto-refresh every 10 seconds
      const interval = setInterval(() => {
        fetchNotifications();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [userId, viewedNotifications]);

  // additionally fetch review notifications depending on role
  useEffect(() => {
    // For customers we need the userId; for admins/moderators we can fetch pending reviews without userId
    const uid = userId || localStorage.getItem(`userId`);
    const roleStored = userRole || localStorage.getItem('userRole') || '';
    const roleUpper = (roleStored || '').toUpperCase();
    if (roleUpper === 'CUSTOMER') {
      if (uid) fetchCustomerReviewNotifications();
    }
    if (roleUpper === 'ADMIN' || roleUpper === 'MODERATOR') {
      fetchAdminReviewNotifications();
    }

    // refresh periodically for reviews too
    const rInterval = setInterval(() => {
      const cachedUid = userId || localStorage.getItem(`userId`);
      const roleStored2 = userRole || localStorage.getItem('userRole') || '';
      const roleUpper2 = (roleStored2 || '').toUpperCase();
      if (roleUpper2 === 'CUSTOMER' && cachedUid) fetchCustomerReviewNotifications();
      if (roleUpper2 === 'ADMIN' || roleUpper2 === 'MODERATOR') fetchAdminReviewNotifications();
    }, 15000);
    return () => clearInterval(rInterval);
  }, [userId, userRole, viewedNotifications]);

  const fetchNotifications = async () => {
    try {
      if (userRole === 'CUSTOMER') {
        await fetchCustomerNotifications();
      } else if (userRole === 'TOUR_OPERATOR' || userRole === 'OPERATOR') {
        await fetchOperatorNotifications();
      } else if (userRole === 'ADMIN' || (userRole || '').toUpperCase() === 'ADMIN') {
        await fetchAdminChatNotifications();
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchCustomerNotifications = async () => {
    const res = await fetch(`/api/bookings?customerId=${userId}`);
    const data = await res.json();
    const bookings = Array.isArray(data) ? data : (data.bookings || []);
    
    const notifs = [];
    
    // Date change request notifications
    bookings.forEach(booking => {
      if (booking.dateChangeRequest && booking.dateChangeRequest.status) {
        const request = booking.dateChangeRequest;
        notifs.push({
          id: `datechange-${booking._id}-${request.status}`,
          type: 'datechange',
          title: request.status === 'APPROVED' ? 'Date Change Approved' : 
                 request.status === 'REJECTED' ? 'Date Change Rejected' : 
                 'Date Change Request Pending',
          message: request.status === 'APPROVED' 
            ? `Your tour has been rescheduled to ${new Date(request.requestedDate).toLocaleDateString()}`
            : request.status === 'REJECTED'
            ? request.reviewNotes || 'Your date change request was rejected'
            : `Requested new date: ${new Date(request.requestedDate).toLocaleDateString()}`,
          timestamp: new Date(request.reviewedAt || request.requestedAt),
          status: request.status,
          icon: request.status === 'APPROVED' ? LuCircleCheck : 
                request.status === 'REJECTED' ? LuCircleX : LuClock,
          color: request.status === 'APPROVED' ? 'green' : 
                 request.status === 'REJECTED' ? 'red' : 'yellow',
          booking: booking
        });
      }
      
      // Refund notifications
      if (booking.status === 'REFUNDED' || booking.cancellation?.refundProcessed) {
        const refundAmount = booking.cancellation?.refundAmount || 0;
        notifs.push({
          id: `refund-${booking._id}`,
          type: 'refund',
          title: 'Refund Processed',
          message: `Your refund of $${refundAmount.toLocaleString()} has been processed`,
          timestamp: new Date(booking.cancellation?.refundProcessedAt || booking.updatedAt),
          icon: LuDollarSign,
          color: 'green',
          booking: booking
        });
      }
      
      // Booking confirmation notifications
      if (booking.status === 'CONFIRMED' && new Date(booking.createdAt) > new Date(Date.now() - 24*60*60*1000)) {
        notifs.push({
          id: `confirmed-${booking._id}`,
          type: 'confirmed',
          title: 'Booking Confirmed',
          message: `Your booking for ${booking.packageId?.title || 'Tour Package'} is confirmed`,
          timestamp: new Date(booking.updatedAt),
          icon: LuCircleCheck,
          color: 'green',
          booking: booking
        });
      }
      
      // Payment pending notifications
      if (booking.status === 'PENDING') {
        const totalPaid = booking.payments
          ?.filter(p => p.status === 'SUCCESS' && p.method !== 'REFUND')
          ?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const remaining = booking.finalAmount - totalPaid;
        
        if (remaining > 0) {
          notifs.push({
            id: `payment-${booking._id}`,
            type: 'payment',
            title: 'Payment Pending',
            message: `Complete your payment of BDT ${remaining.toLocaleString()} for ${booking.packageId?.title || 'Tour Package'}`,
            timestamp: new Date(booking.createdAt),
            icon: LuTriangleAlert,
            color: 'orange',
            booking: booking
          });
        }
      }
    });
    
    // Message notifications
    // Message notifications associated with bookings
    for (const booking of bookings) {
      if (booking.assignedOperator && booking._id) {
        const msgRes = await fetch(`/api/messages/booking/${booking._id}`);
        const msgData = await msgRes.json();
        
        if (msgData.success && msgData.messages && msgData.messages.length > 0) {
          const unreadMessages = msgData.messages.filter(
            msg => (msg.senderId?._id || msg.senderId) !== userId
          );
          
          if (unreadMessages.length > 0) {
            const lastMsg = msgData.messages[msgData.messages.length - 1];
            notifs.push({
              id: `message-${booking._id}`,
              type: 'message',
              title: `Message from ${booking.assignedOperator?.fullName || 'Tour Operator'}`,
              message: lastMsg.content,
              timestamp: new Date(lastMsg.sentAt),
              booking: booking,
              operator: booking.assignedOperator,
              unreadCount: unreadMessages.length,
              icon: LuMessagesSquare,
              color: 'blue'
            });
          }
        }
      }
    }

    // General 1-to-1 messages sent to this user (not tied to a booking)
    try {
      const generalRes = await fetch(`/api/messages?recipientId=${userId}`);
      const generalData = await generalRes.json();
      if (generalData.success && generalData.messages && generalData.messages.length > 0) {
        generalData.messages.forEach(msg => {
          // skip messages that are tied to bookings (already handled)
          if (msg.bookingId) return;
          const id = `msg-${msg._id}`;
          const title = msg.senderId?.fullName || msg.senderId?.name || 'Admin';
          notifs.push({
            id,
            type: 'message',
            title: `Message from ${title}`,
            message: msg.content,
            timestamp: new Date(msg.sentAt),
            icon: LuMessagesSquare,
            color: 'blue',
            rawMessage: msg
          });
        });
      }
    } catch (err) {
      // ignore errors fetching general messages
    }

    // Check user's KYC status and create a local notification if approved
    try {
      const kycRes = await fetch('/api/kyc/my-kyc', {
        headers: { 'x-user-id': userId }
      });
      const kycData = await kycRes.json();
      if (kycData && kycData.success && kycData.kyc) {
        const status = (kycData.kyc.status || '').toString().toLowerCase();
        if (status === 'approved') {
          const nid = `kyc-approved-${userId}`;
          // avoid duplicates in the current list (but allow showing even if previously viewed)
          if (!notifs.find(n => n.id === nid)) {
            notifs.push({
              id: nid,
              type: 'kyc',
              title: 'KYC Verified',
              message: 'Your identity verification (KYC) has been approved. You can now book international tour packages.',
              timestamp: new Date(kycData.kyc.verifiedAt || kycData.kyc.updatedAt || kycData.kyc.createdAt || Date.now()),
              icon: LuCircleCheck,
              color: 'green'
            });
          }
        } else if (status === 'rejected') {
          const nid = `kyc-rejected-${userId}`;
          if (!notifs.find(n => n.id === nid)) {
            const reason = kycData.kyc.remarks || kycData.kyc.rejectionReason || '';
            notifs.push({
              id: nid,
              type: 'kyc',
              title: 'KYC Rejected',
              message: `Your KYC was rejected${reason ? ': ' + reason : '.'}`,
              timestamp: new Date(kycData.kyc.updatedAt || kycData.kyc.createdAt || Date.now()),
              icon: LuCircleX,
              color: 'red'
            });
          }
        }
      }
    } catch (err) {
      // ignore kyc fetch errors
    }
    
    // Sort by timestamp descending
    notifs.sort((a, b) => b.timestamp - a.timestamp);
    
    setNotifications(notifs);
    
    // Calculate unread count - notifications not in viewedNotifications list
    const unread = notifs.filter(n => !viewedNotifications.includes(n.id)).length;
    setUnreadCount(unread);
  };

  // Fetch approved reviews for this customer and add notifications
  const fetchCustomerReviewNotifications = async () => {
    try {
      const res = await fetch(`/api/reviews?customerId=${userId}&status=APPROVED`);
      if (!res.ok) return;
      const data = await res.json();
      const reviews = Array.isArray(data) ? data : (data.reviews || []);
      const reviewNotifs = reviews.map(r => ({
        id: `review-approved-${r._id}`,
        type: 'review-approved',
        title: 'Review Published',
        message: `Your review for ${r.packageId?.title || 'the package'} is now published`,
        timestamp: new Date(r.updatedAt || r.createdAt),
        icon: LuCircleCheck,
        color: 'green',
        review: r
      }));
      // merge into current notifications, avoiding duplicates
      setNotifications(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const merged = [...prev];
        reviewNotifs.forEach(n => { if (!existingIds.has(n.id)) merged.push(n); });
        merged.sort((a, b) => b.timestamp - a.timestamp);
        // compute unread based on merged list
        const unread = merged.filter(n => !viewedNotifications.includes(n.id)).length;
        setUnreadCount(unread);
        console.debug('NotificationCenter: fetched approved reviews', reviewNotifs.length, 'merged=', merged.length);
        return merged;
      });
    } catch (err) {
      // ignore
    }
  };

  const fetchOperatorNotifications = async () => {
    const res = await fetch(`/api/bookings?assignedOperator=${userId}`);
    const data = await res.json();
    let bookings = Array.isArray(data) ? data : (data.bookings || []);

    // Only keep group bookings (assigned via group departures). Operators should not see personal tour bookings
    bookings = bookings.filter(b => (b.bookingType && b.bookingType.toString().toUpperCase() === 'GROUP') || b.groupDepartureId);
    console.debug('NotificationCenter: operator bookings filtered for group tours', bookings.length);
    
    const notifs = [];
    
    // New booking notifications
    bookings.forEach(booking => {
      const bookingAge = Date.now() - new Date(booking.createdAt).getTime();
      if (bookingAge < 24*60*60*1000) { // Last 24 hours
        notifs.push({
          id: `newbooking-${booking._id}`,
          type: 'newbooking',
          title: 'New Booking Assigned',
          message: `New booking for ${booking.packageId?.title || 'Tour Package'} - ${booking.numTravelers} travelers`,
          timestamp: new Date(booking.createdAt),
          icon: LuCircleCheck,
          color: 'green',
          booking: booking,
          customer: booking.customerId
        });
      }
      
      // Date change requests
      if (booking.dateChangeRequest && booking.dateChangeRequest.status === 'PENDING') {
        notifs.push({
          id: `datechange-${booking._id}`,
          type: 'datechange',
          title: 'Date Change Request',
          message: `${booking.customerId?.fullName || 'Customer'} requested date change to ${new Date(booking.dateChangeRequest.requestedDate).toLocaleDateString()}`,
          timestamp: new Date(booking.dateChangeRequest.requestedAt),
          icon: LuClock,
          color: 'yellow',
          booking: booking,
          customer: booking.customerId
        });
      }
    });
    
    // Message notifications (persist seen per booking)
    const seenOperatorMsgTimestamps = JSON.parse(localStorage.getItem('seenOperatorMsgTimestamps') || '{}');
    for (const booking of bookings) {
      if (booking._id && booking.customerId) {
        const msgRes = await fetch(`/api/messages/booking/${booking._id}`);
        const msgData = await msgRes.json();
        if (msgData.success && msgData.messages && msgData.messages.length > 0) {
          const unreadMessages = msgData.messages.filter(
            msg => (msg.senderId?._id || msg.senderId) !== userId
          );
          if (unreadMessages.length > 0) {
            const lastMsg = msgData.messages[msgData.messages.length - 1];
            const lastMsgTime = new Date(lastMsg.sentAt).getTime();
            const seenTime = seenOperatorMsgTimestamps[booking._id] || 0;
            if (lastMsgTime > seenTime) {
              notifs.push({
                id: `message-${booking._id}`,
                type: 'message',
                title: `Message from ${booking.customerId?.fullName || booking.customerId?.name || 'Customer'}`,
                message: lastMsg.content,
                timestamp: new Date(lastMsg.sentAt),
                booking: booking,
                customer: booking.customerId,
                unreadCount: unreadMessages.length,
                icon: LuMessagesSquare,
                color: 'blue',
                bookingId: booking._id,
                lastMsgTime: lastMsgTime
              });
            }
          }
        }
      }
    }
    
    // Only status summaries for customers on the authenticated operator's assignments are exposed.
    try {
      const kycRes = await fetch('/api/operator/kyc-statuses');
      if (!kycRes.ok) throw new Error('Assigned customer verification status unavailable');
      const kycData = await kycRes.json();
      for (const kyc of (kycData.kycs || [])) {
        if (!['pending', 'approved'].includes(kyc.status)) continue;
        const approved = kyc.status === 'approved';
        notifs.push({
          id: `kyc-${kyc.status}-${kyc._id}`,
          type: approved ? 'kyc' : 'kyc-submitted',
          title: approved ? 'Customer KYC Verified' : 'Customer KYC Submitted',
          message: `${kyc.userFullName || 'An assigned customer'}${approved ? "'s KYC was approved." : ' submitted KYC documents for verification.'}`,
          timestamp: new Date(kyc.verifiedAt || kyc.updatedAt || kyc.createdAt || Date.now()),
          icon: approved ? LuCircleCheck : LuIdCard,
          color: approved ? 'green' : 'yellow',
          kyc
        });
      }
    } catch (err) {
      console.debug('Operator KYC status notifications unavailable', err);
    }

    // Fetch admin chat notifications for operators
    try {
      // Get all admin users
      const usersRes = await fetch('/api/support/contacts');
      if (!usersRes.ok) throw new Error('Support contacts unavailable');
      const usersData = await usersRes.json();
      const usersList = Array.isArray(usersData) ? usersData : (usersData.users || []);
      
      // Find admin users
      const admins = usersList.filter(u => {
        if (!u) return false;
        const role = u.role || '';
        const roles = u.roles || [];
        return role.toString().toUpperCase() === 'ADMIN' || 
               (Array.isArray(roles) && roles.some(r => (r||'').toString().toUpperCase() === 'ADMIN'));
      });
      
      // Get seen timestamps from localStorage
      const seenChats = JSON.parse(localStorage.getItem('seenAdminChatTimestamps') || '{}');
      
      // Check conversations with each admin
      for (const admin of admins) {
        try {
          const qs = new URLSearchParams({ userA: userId, userB: admin._id });
          const convRes = await fetch(`/api/messages/conversation?${qs.toString()}`);
          const convData = await convRes.json();
          
          if (convData.success && convData.messages && convData.messages.length > 0) {
            // Filter messages from admin only
            const adminMsgs = convData.messages.filter(m => {
              const senderId = m.senderId?._id || m.senderId;
              return senderId === admin._id;
            });
            
            if (adminMsgs.length > 0) {
              const lastMsg = adminMsgs[adminMsgs.length - 1];
              const lastMsgTime = new Date(lastMsg.sentAt).getTime();
              const seenTime = seenChats[admin._id] || 0;
              
              // Only show if there's a newer message
              if (lastMsgTime > seenTime) {
                const adminName = admin.fullName || admin.name || 'Admin';
                notifs.push({
                  id: `admin-chat-${admin._id}`,
                  type: 'admin-chat',
                  title: `Message from ${adminName}`,
                  message: lastMsg.content?.substring(0, 50) + (lastMsg.content?.length > 50 ? '...' : ''),
                  timestamp: new Date(lastMsg.sentAt),
                  icon: LuMessagesSquare,
                  color: 'purple',
                  adminId: admin._id,
                  adminName: adminName
                });
              }
            }
          }
        } catch (err) {
          // skip individual conversation errors
        }
      }
    } catch (err) {
      console.debug('Error fetching admin chat notifications for operator:', err);
    }
    
    // Sort by timestamp descending
    notifs.sort((a, b) => b.timestamp - a.timestamp);
    console.debug('NotificationCenter: operator notifs built', notifs.map(n => n.id), { viewedNotifications });
    setNotifications(notifs);
    
    // Calculate unread count - notifications not in viewedNotifications list
    const unread = notifs.filter(n => !viewedNotifications.includes(n.id)).length;
    console.debug('NotificationCenter: operator unread count', unread);
    setUnreadCount(unread);
  };

  // Fetch incoming live chat messages for admin
  const fetchAdminChatNotifications = async () => {
    try {
      const notifs = [];
      
      // Fetch all users to find conversations
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      const usersList = Array.isArray(usersData) ? usersData : (usersData.users || []);
      
      // Filter non-admin users
      const nonAdmins = usersList.filter(u => {
        if (!u) return false;
        const role = u.role || '';
        const roles = u.roles || [];
        const isAdmin = role.toString().toUpperCase() === 'ADMIN' || 
                       (Array.isArray(roles) && roles.some(r => (r||'').toString().toUpperCase() === 'ADMIN'));
        return !isAdmin;
      });
      
      // Check conversations with each user
      for (const user of nonAdmins.slice(0, 20)) { // Limit to 20 users for performance
        try {
          const qs = new URLSearchParams({ userA: userId, userB: user._id });
          const convRes = await fetch('/api/messages/conversation?' + qs.toString());
          const convData = await convRes.json();
          
          if (convData.success && convData.messages && convData.messages.length > 0) {
            // Find messages sent TO admin (from this user)
            const incomingMessages = convData.messages.filter(m => {
              const senderId = m.senderId?._id || m.senderId;
              return senderId !== userId;
            });
            
            if (incomingMessages.length > 0) {
              const lastMsg = incomingMessages[incomingMessages.length - 1];
              const senderName = lastMsg.senderId?.fullName || lastMsg.senderId?.name || user.fullName || user.name || user.email || 'User';
              const userRole = Array.isArray(user.roles) ? user.roles[0] : user.role || 'User';
              
              notifs.push({
                id: `chat-${user._id}`,
                type: 'live-chat',
                title: `Chat from ${senderName}`,
                message: lastMsg.content,
                timestamp: new Date(lastMsg.sentAt),
                icon: LuMessagesSquare,
                color: 'blue',
                chatUser: user,
                unreadCount: incomingMessages.length,
                userRole: userRole
              });
            }
          }
        } catch (err) {
          // Skip this user on error
        }
      }
      
      // Sort by timestamp descending
      notifs.sort((a, b) => b.timestamp - a.timestamp);
      
      setNotifications(prev => {
        // Merge with existing notifications (like pending reviews)
        const existingIds = new Set(prev.filter(p => p.type !== 'live-chat').map(p => p.id));
        const merged = [...prev.filter(p => p.type !== 'live-chat'), ...notifs];
        merged.sort((a, b) => b.timestamp - a.timestamp);
        const unread = merged.filter(n => !viewedNotifications.includes(n.id)).length;
        setUnreadCount(unread);
        return merged;
      });
    } catch (err) {
      console.error('Failed to fetch admin chat notifications', err);
    }
  };

  // Fetch pending reviews for admins (or moderators)
  const fetchAdminReviewNotifications = async () => {
    try {
      const res = await fetch(`/api/reviews?status=PENDING`);
      if (!res.ok) return;
      const data = await res.json();
      const reviews = Array.isArray(data) ? data : (data.reviews || []);
      const notifs = reviews.map(r => ({
        id: `review-pending-${r._id}`,
        type: 'review-pending',
        title: 'Review Awaiting Approval',
        message: `${r.customerId?.fullName || 'Customer'} submitted a review for ${r.packageId?.title || 'a package'}`,
        timestamp: new Date(r.createdAt),
        icon: LuClock,
        color: 'yellow',
        review: r
      }));
      setNotifications(prev => {
        const existing = new Set(prev.map(p => p.id));
        const merged = [...prev];
        notifs.forEach(n => { if (!existing.has(n.id)) merged.push(n); });
        merged.sort((a, b) => b.timestamp - a.timestamp);
        const unread = merged.filter(n => !viewedNotifications.includes(n.id)).length;
        setUnreadCount(unread);
        console.debug('NotificationCenter: fetched pending reviews', notifs.length, 'merged=', merged.length);
        return merged;
      });
    } catch (err) {
      // ignore
    }
  };

  const markAsViewed = (notificationId) => {
    if (!viewedNotifications.includes(notificationId)) {
      const updated = [...viewedNotifications, notificationId];
      setViewedNotifications(updated);
      localStorage.setItem(`viewedNotifications_${userId}`, JSON.stringify(updated));
      // Recompute unread count immediately
      setUnreadCount(prev => {
        try {
          const currentNotifs = notifications || [];
          const unread = currentNotifs.filter(n => !updated.includes(n.id)).length;
          return unread;
        } catch (e) { return prev; }
      });
    }
  };

  const handleNotificationClick = (notif) => {
    // Mark notification as viewed
    markAsViewed(notif.id);
    if (notif.type === 'message' && onOpenChat && notif.booking) {
      // Mark last message as seen for this booking
      if (notif.bookingId && notif.lastMsgTime) {
        const seenOperatorMsgTimestamps = JSON.parse(localStorage.getItem('seenOperatorMsgTimestamps') || '{}');
        seenOperatorMsgTimestamps[notif.bookingId] = notif.lastMsgTime;
        localStorage.setItem('seenOperatorMsgTimestamps', JSON.stringify(seenOperatorMsgTimestamps));
      }
      onOpenChat(notif.booking, notif.operator || notif.customer);
      // Remove notification from UI immediately
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
      setIsOpen(false);
    } else if (notif.type === 'live-chat' && notif.chatUser) {
      // Navigate to admin contacts with selected user for live chat
      window.location.href = `/admin/contacts?chatUserId=${notif.chatUser._id}`;
      setIsOpen(false);
    } else if (notif.type === 'admin-chat' && notif.adminId) {
      // Mark admin chat as seen
      const seenChats = JSON.parse(localStorage.getItem('seenAdminChatTimestamps') || '{}');
      seenChats[notif.adminId] = Date.now();
      localStorage.setItem('seenAdminChatTimestamps', JSON.stringify(seenChats));
      // If parent provided a handler, use it to open admin chat in-app
      if (typeof onOpenAdminChat === 'function') {
        onOpenAdminChat(notif.adminId, notif.adminName);
        setIsOpen(false);
      } else {
        // Fallback: navigate to operator messages route with query (may 404 if route missing)
        window.location.href = `/operator/messages?type=admin`;
        setIsOpen(false);
      }
    } else {
      // Navigate for review notifications or close dropdown
      try {
        const roleStored = userRole || localStorage.getItem('userRole') || '';
        const roleUpper = (roleStored || '').toUpperCase();
        if (notif.type === 'review-approved') {
          // customer view
          window.location.href = `/customer/reviews?reviewId=${notif.review?._id || ''}`;
          return;
        }
        if (notif.type === 'review-pending') {
          // admin/moderator view
          window.location.href = `/admin/reviews?reviewId=${notif.review?._id || ''}`;
          return;
        }
      } catch (err) {
        console.debug('Navigation error for notification', err);
      } finally {
        setIsOpen(false);
      }
    }
  };

  const getNotificationStyle = (color) => {
    const styles = {
      blue: 'bg-info/10 text-info',
      green: 'bg-success/10 text-success',
      red: 'bg-danger/10 text-danger',
      yellow: 'bg-warning/10 text-warning',
      orange: 'bg-warning/10 text-warning',
      purple: 'bg-info/10 text-info'
    };
    return styles[color] || styles.blue;
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleToggleDropdown = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    
    // Do not auto-mark all notifications as viewed when opening the dropdown.
    // Individual notifications are marked viewed when clicked.
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={handleToggleDropdown}
        className="relative p-2 text-text-muted hover:bg-surface-muted rounded-full transition-colors"
      >
        <LuBell aria-hidden="true" size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notification Panel */}
          <div className="absolute right-0 mt-2 w-80 bg-surface rounded-lg shadow-2xl border border-border z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-text">
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text"
              >
                <LuX aria-hidden="true" />
              </button>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-80">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  <LuBell aria-hidden="true" size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No new notifications</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className="p-4 border-b border-border hover:bg-surface-muted cursor-pointer transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className={`p-2 rounded-full ${getNotificationStyle(notif.color)}`}>
                          <notif.icon size={16} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-sm text-text truncate">
                            {notif.title}
                          </p>
                          {notif.unreadCount > 0 && (
                            <span className="bg-info text-white text-xs font-bold rounded-full px-2 py-0.5 ml-2">
                              {notif.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {formatTime(notif.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
