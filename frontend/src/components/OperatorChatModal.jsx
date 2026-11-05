import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuMail, LuPhone, LuSend } from 'react-icons/lu';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import Modal from './ui/Modal.jsx';
import { inputClass } from './ui/FormField.jsx';
import { ChatIcon } from './ui/icons.js';
import { notify } from '../utils/notifyStore.js';
import { userMessage } from '../utils/errorMessage.js';

const REFRESH_MS = 3000;
const MESSAGE_LIMIT = 5000;

const idOf = value => String(value?._id || value || '');

// The customer's chat with the operator on one booking. Requests go through fetch so the signed-in token is sent.
const OperatorChatModal = ({ isOpen, onClose, booking, operator }) => {
  const userId = localStorage.getItem('userId');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const bookingId = booking?._id;
  const operatorInfo = operator || booking?.assignedOperator || {};
  const operatorId = idOf(operator) || idOf(booking?.assignedOperator);

  const loadMessages = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await fetch(`/api/messages/booking/${bookingId}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Messages could not be loaded.');
      // Only messages this customer sent or received are shown.
      const mine = (data.messages || []).filter(msg => idOf(msg.senderId) === userId || idOf(msg.recipientId) === userId);
      setMessages(mine);
      setLoadError('');
    } catch (failure) {
      console.error('Failed to load messages:', failure);
      setLoadError(userMessage(failure, 'Messages could not be loaded right now.'));
    } finally {
      setLoading(false);
    }
  }, [bookingId, userId]);

  useEffect(() => {
    if (!isOpen || !bookingId) return undefined;
    setLoading(true);
    loadMessages();
    const timer = setInterval(loadMessages, REFRESH_MS);
    return () => clearInterval(timer);
  }, [isOpen, bookingId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, isOpen]);

  // Clear the draft when the modal opens for another booking.
  useEffect(() => { setDraft(''); }, [bookingId]);

  const send = async event => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sending || !bookingId) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, senderId: userId, recipientId: operatorId, content })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Message not sent.');
      setDraft('');
      await loadMessages();
    } catch (failure) {
      notify.error(userMessage(failure, 'Your message was not sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !booking) return null;

  const formatTime = value => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Chat with ${operatorInfo.fullName || 'your tour operator'}`}
      description={`Booking: ${booking?.packageId?.title || 'Tour package'}`}
      size="lg"
      rootClassName="dark"
    >
      <div className="space-y-4">
        {(operatorInfo.phone || operatorInfo.email) && (
          <div className="flex flex-wrap gap-2 text-sm">
            {operatorInfo.phone && (
              <a href={`tel:${operatorInfo.phone}`} className="glass inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-brand hover:underline">
                <LuPhone aria-hidden="true" className="h-4 w-4" />{operatorInfo.phone}
              </a>
            )}
            {operatorInfo.email && (
              <a href={`mailto:${operatorInfo.email}`} className="glass inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-brand hover:underline">
                <LuMail aria-hidden="true" className="h-4 w-4" />{operatorInfo.email}
              </a>
            )}
          </div>
        )}

        <div role="log" aria-live="polite" aria-label="Messages with your tour operator" className="glass max-h-[50vh] min-h-[280px] space-y-3 overflow-y-auto overscroll-contain rounded-2xl p-4">
          {loading && <p className="text-sm text-text-muted">Loading messages…</p>}
          {!loading && loadError && <p role="alert" className="text-sm text-danger">{loadError}</p>}
          {!loading && !loadError && messages.length === 0 && (
            <EmptyState icon={ChatIcon} title="No messages yet" description="Say hello to start the conversation." />
          )}
          {!loading && !loadError && messages.map(msg => {
            const mine = idOf(msg.senderId) === userId;
            return (
              <div key={msg._id || `${msg.sentAt}-${msg.content}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-brand text-on-brand' : 'bg-surface-muted text-text'}`}>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>
                  <p className={`mt-1 text-[11px] ${mine ? 'opacity-80' : 'text-text-muted'}`}>{formatTime(msg.sentAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex items-end gap-3">
          <label htmlFor="operator-chat-draft" className="sr-only">Message</label>
          <textarea
            id="operator-chat-draft"
            rows={1}
            maxLength={MESSAGE_LIMIT}
            value={draft}
            disabled={sending}
            placeholder="Type your message. Enter sends, Shift+Enter adds a line."
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
            }}
            className={`${inputClass} min-h-[44px] resize-none`}
          />
          <Button type="submit" icon={LuSend} loading={sending} disabled={!draft.trim()}>Send</Button>
        </form>
      </div>
    </Modal>
  );
};

export default OperatorChatModal;
