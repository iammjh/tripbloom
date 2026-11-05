import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuMegaphone, LuMessagesSquare } from 'react-icons/lu';
import EmptyState from '../components/ui/EmptyState.jsx';
import { notify } from '../utils/notifyStore.js';
import { userMessage } from '../utils/errorMessage.js';
import { filterConversations, sendPayload, threadItems } from '../utils/operatorMessages.js';
import BroadcastPanel from './messages/BroadcastPanel.jsx';
import ChatThread from './messages/ChatThread.jsx';
import ConversationList from './messages/ConversationList.jsx';
import { loadOperatorConversations, loadThreadMessages } from './messages/loadOperatorConversations.js';

const LIST_REFRESH_MS = 10000;
const THREAD_REFRESH_MS = 4000;

const TABS = [
  { id: 'conversations', label: 'Conversations', icon: LuMessagesSquare },
  { id: 'broadcast', label: 'Announcements', icon: LuMegaphone }
];

// Messages for the operator: traveller and administrator conversations, and departure announcements.
const MessagesAnnouncements = ({ openBookingId, openAdminId, onAdminOpened }) => {
  const operatorId = localStorage.getItem('userId');
  const [tab, setTab] = useState('conversations');
  const [conversations, setConversations] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState({ items: [], loading: false, error: '' });
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const selectedRef = useRef(null);

  const selected = useMemo(() => conversations.find(conversation => conversation.id === selectedId) || null, [conversations, selectedId]);
  selectedRef.current = selected;
  const hasSelected = Boolean(selected);
  const visible = useMemo(() => filterConversations(conversations, query), [conversations, query]);

  const loadConversations = useCallback(async () => {
    if (!operatorId || inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await loadOperatorConversations(operatorId);
      setConversations(result.conversations);
      setDepartures(result.departures);
      setListError('');
    } catch (failure) {
      console.error('Failed to load operator conversations:', failure);
      setListError('Your conversations could not be loaded right now.');
    } finally {
      inFlight.current = false;
      setListLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    loadConversations();
    const timer = setInterval(loadConversations, LIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadConversations]);

  // Deep links from the notification centre: open a booking thread or an administrator thread.
  useEffect(() => {
    if (openBookingId) {
      setTab('conversations');
      setSelectedId(`booking-${openBookingId}`);
    }
  }, [openBookingId]);

  useEffect(() => {
    if (!openAdminId || !conversations.length) return;
    const match = conversations.find(conversation => conversation.type === 'admin' && conversation.adminId === openAdminId);
    if (match) {
      setTab('conversations');
      setSelectedId(match.id);
      if (typeof onAdminOpened === 'function') onAdminOpened();
    }
  }, [openAdminId, conversations, onAdminOpened]);

  const refreshThread = useCallback(async conversation => {
    if (!conversation) return;
    try {
      const raw = await loadThreadMessages(conversation, operatorId);
      if (selectedRef.current?.id !== conversation.id) return;
      setThread({ items: threadItems(conversation, raw, operatorId), loading: false, error: '' });
    } catch (failure) {
      console.error('Failed to load messages:', failure);
      if (selectedRef.current?.id === conversation.id) setThread(current => ({ ...current, loading: false, error: 'These messages could not be loaded.' }));
    }
  }, [operatorId]);

  // Opening a conversation loads it at once and then refreshes it while it stays open.
  useEffect(() => {
    if (!hasSelected) {
      setThread({ items: [], loading: false, error: '' });
      return undefined;
    }
    setThread({ items: [], loading: true, error: '' });
    refreshThread(selectedRef.current);
    const timer = setInterval(() => refreshThread(selectedRef.current), THREAD_REFRESH_MS);
    return () => clearInterval(timer);
  }, [selectedId, hasSelected, refreshThread]);

  const sendToSelected = async text => {
    const conversation = selectedRef.current;
    if (!conversation || conversation.type === 'broadcast' || sending) return false;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendPayload(conversation, text, operatorId))
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Message not sent.');
      await refreshThread(conversation);
      loadConversations();
      return true;
    } catch (failure) {
      notify.error(userMessage(failure, 'Your message was not sent. Please try again.'));
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendAnnouncement = async (tourId, content) => {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourId, senderId: operatorId, content, isBroadcast: true })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'The announcement could not be sent.');
    notify.message('Announcement sent to the departure.');
    loadConversations();
  };

  const hasConversations = conversations.length > 0;

  return (
    <div className="space-y-6">
      <header className="glass-strong rounded-3xl p-6">
        <h2 className="font-display text-2xl font-semibold text-text sm:text-3xl">Messages</h2>
        <p className="mt-1 text-sm text-text-muted">Talk with travellers and administrators, or send an announcement to a departure.</p>
      </header>

      <div role="tablist" aria-label="Message sections" className="flex gap-1 overflow-x-auto">
        {TABS.map(item => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`messages-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`messages-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`inline-flex min-h-[44px] flex-none items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${active ? 'bg-brand/15 text-text ring-1 ring-inset ring-brand/30' : 'text-text-muted hover:bg-surface-muted hover:text-text'}`}
            >
              <item.icon aria-hidden="true" className="h-4 w-4" />{item.label}
            </button>
          );
        })}
      </div>

      {tab === 'conversations' && (
        <div id="messages-panel-conversations" role="tabpanel" aria-labelledby="messages-tab-conversations" className="glass grid min-h-[480px] overflow-hidden rounded-3xl md:h-[68vh] md:grid-cols-[20rem_1fr]">
          <div className={`${selected ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-border`}>
            <ConversationList
              conversations={visible}
              activeId={selectedId}
              query={query}
              onQuery={setQuery}
              onSelect={conversation => setSelectedId(conversation.id)}
              loading={listLoading}
              error={!hasConversations ? listError : ''}
              onRetry={loadConversations}
            />
          </div>
          <div className={`${selected ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col`}>
            {selected ? (
              <ChatThread
                key={selected.id}
                conversation={selected}
                items={thread.items}
                loading={thread.loading}
                error={thread.error}
                onRetry={() => refreshThread(selected)}
                onSend={sendToSelected}
                sending={sending}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState icon={LuMessagesSquare} title="Choose a conversation" description="Pick someone from the list to read and reply." />
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'broadcast' && (
        <div id="messages-panel-broadcast" role="tabpanel" aria-labelledby="messages-tab-broadcast">
          <BroadcastPanel departures={departures} onSend={sendAnnouncement} />
        </div>
      )}
    </div>
  );
};

export default MessagesAnnouncements;
