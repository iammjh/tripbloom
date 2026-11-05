import { LuMail, LuPhone, LuSend, LuUserCog, LuX } from 'react-icons/lu';
import { ChatIcon } from './ui/icons.js';
import { notify } from '../utils/notifyStore.js';
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

import axios from 'axios';

const OperatorChatModal = ({ isOpen, onClose, booking, operator }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const previousMessagesCountRef = useRef(0);
  const isUserScrolledUpRef = useRef(false);
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (isOpen && booking?._id) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      previousMessagesCountRef.current = 0;
      isUserScrolledUpRef.current = false;
      loadMessages(true); // Initial load with scroll
      
      // Set up auto-refresh every 3 seconds
      const interval = setInterval(() => {
        loadMessages(false); // Auto-refresh without forced scroll
      }, 3000);
      
      // Cleanup interval when modal closes
      return () => {
        clearInterval(interval);
        setMessages([]);
        // Restore body scroll when modal closes
        document.body.style.overflow = 'unset';
      };
    } else {
      // Ensure body scroll is restored if modal is not open
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, booking]);

  // Track if user has scrolled up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Check if user is at the bottom (within 50px threshold)
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      isUserScrolledUpRef.current = !isAtBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  const loadMessages = async (shouldScroll = false) => {
    // Don't show loading spinner for auto-refresh, only for initial load
    const isInitialLoad = messages.length === 0;
    if (isInitialLoad) {
      setLoading(true);
    }
    
    try {
      const res = await axios.get(`/api/messages/booking/${booking._id}`);
      if (res.data.success) {
        const newMessages = res.data.messages || [];
        // Filter messages so operator only sees conversations where they are a participant
        const filtered = newMessages.filter(msg => {
          const sId = msg.senderId?._id || msg.senderId;
          const rId = msg.recipientId?._id || msg.recipientId;
          return String(sId) === String(userId) || String(rId) === String(userId);
        });

        // Only update state if messages have actually changed
        if (JSON.stringify(filtered) !== JSON.stringify(messages)) {
          const hadNewMessages = filtered.length > previousMessagesCountRef.current;
          setMessages(filtered);
          previousMessagesCountRef.current = filtered.length;
          
          // Only scroll if:
          // 1. Initial load or explicit scroll requested
          // 2. New messages arrived AND user is not scrolled up reading old messages
          if (shouldScroll || isInitialLoad) {
            setTimeout(() => scrollToBottom(false), 50);
          } else if (hadNewMessages && !isUserScrolledUpRef.current) {
            setTimeout(() => scrollToBottom(), 50);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
    
    if (isInitialLoad) {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await axios.post('/api/messages', {
        bookingId: booking._id,
        senderId: userId,
        recipientId: operator?._id || booking.assignedOperator?._id || booking.assignedOperator,
        content: newMessage.trim()
      });

      if (res.data.success) {
        // The backend returns the message in res.data.data
        const sentMessage = res.data.data;
        const updatedMessages = [...messages, sentMessage];
        setMessages(updatedMessages);
        previousMessagesCountRef.current = updatedMessages.length;
        setNewMessage('');
        // Scroll to bottom after sending
        setTimeout(() => scrollToBottom(), 100);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      notify.message('Failed to send message. Please try again.');
    }
    setSending(false);
  };

  const formatTime = (date) => {
    try {
      return new Date(date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  const operatorInfo = operator || booking?.assignedOperator || {};

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary to-green-600">
          <div className="flex items-center gap-4">
            <div className="bg-white text-primary p-3 rounded-full">
              <LuUserCog aria-hidden="true" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Chat with Tour Operator
              </h2>
              <p className="text-white/80 text-sm">
                {operatorInfo.fullName || 'Tour Operator'}
              </p>
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <LuX aria-hidden="true" size={24} />
          </button>
        </div>

        {/* Operator Contact Info */}
        <div className="p-4 bg-blue-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex flex-wrap gap-4 text-sm">
            {operatorInfo.phone && (
              <a 
                href={`tel:${operatorInfo.phone}`}
                className="flex items-center gap-2 text-primary dark:text-blue-400 hover:underline"
              >
                <LuPhone aria-hidden="true" />
                {operatorInfo.phone}
              </a>
            )}
            {operatorInfo.email && (
              <a 
                href={`mailto:${operatorInfo.email}`}
                className="flex items-center gap-2 text-primary dark:text-blue-400 hover:underline"
              >
                <LuMail aria-hidden="true" />
                {operatorInfo.email}
              </a>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Booking: {booking?.packageId?.title || 'Tour Package'}
          </div>
        </div>

        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900"
        >
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ChatIcon aria-hidden="true" className="mx-auto mb-4 h-16 w-16 text-text-muted" />
              <p className="text-gray-500 dark:text-gray-400">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => {
                const isMyMessage = msg.senderId?._id === userId || msg.senderId === userId;
                return (
                  <div
                    key={index}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      isMyMessage
                        ? 'bg-gradient-to-r from-primary to-green-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-md'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isMyMessage ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {formatTime(msg.sentAt)}
                    </p>
                  </div>
                </div>
              );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:text-white"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-3 bg-gradient-to-r from-primary to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <LuSend aria-hidden="true" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OperatorChatModal;
