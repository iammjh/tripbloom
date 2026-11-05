import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { LuCheck, LuInbox, LuMail, LuMessagesSquare, LuSearch, LuUserCog, LuUsers } from 'react-icons/lu';
import AdminChat from './AdminChat';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import EmptyState from './ui/EmptyState.jsx';
import ErrorState from './ui/ErrorState.jsx';
import Skeleton from './ui/Skeleton.jsx';
import { AdminPageHeader, AdminPanel } from './admin/AdminPrimitives.jsx';
import { inputClass } from './ui/FormField.jsx';
import { notify } from '../utils/notifyStore.js';
import { notifyAdminDataChanged } from '../utils/adminEvents.js';

const TABS = [
  { key: 'messages', label: 'Form messages', icon: LuInbox },
  { key: 'chat', label: 'Live chat', icon: LuMessagesSquare },
];

const roleOf = (user) => ((user.role || (Array.isArray(user.roles) ? user.roles[0] : '') || '') + '').toUpperCase();
const isOperator = (user) => ['TOUR_OPERATOR', 'OPERATOR'].includes(roleOf(user));
const dateTime = (value) => new Date(value).toLocaleString();

// Inbox for the messages sent through the landing-page contact form, and live chat with customers and tour operators.
const AdminContacts = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const focusId = params.get('focus');
  const chatUserId = params.get('chatUserId');

  const [tab, setTab] = useState(chatUserId ? 'chat' : 'messages');
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState('');
  const [messageFilter, setMessageFilter] = useState('open');
  const [messageSearch, setMessageSearch] = useState('');
  const [selectedId, setSelectedId] = useState(focusId || null);
  const [savingId, setSavingId] = useState('');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [chatUser, setChatUser] = useState(null);

  const fetchContacts = async () => {
    setContactsLoading(true);
    setContactsError('');
    try {
      const role = localStorage.getItem('userRole') || '';
      const response = await axios.get('/api/admin/contacts', { headers: { 'x-user-role': role } });
      const list = [...(response.data?.contacts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setContacts(list);
      setSelectedId(current => (current && list.some(item => item._id === current)) ? current : (list[0]?._id || null));
    } catch (failure) {
      console.error('Failed to load contacts', failure);
      setContactsError('The messages could not be loaded. Check that you are signed in as an administrator.');
    } finally {
      setContactsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data?.users || []);
      setUsers(list.filter(user => roleOf(user) !== 'ADMIN'));
    } catch (failure) {
      console.error('Failed to load users', failure);
      setUsersError('Conversations could not be loaded.');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); fetchUsers(); }, []);

  // Notifications deep-link to a conversation: open it once the people are loaded.
  useEffect(() => {
    if (!chatUserId || users.length === 0) return;
    const match = users.find(user => user._id === chatUserId);
    if (match) setChatUser(match);
  }, [chatUserId, users]);

  const visibleContacts = useMemo(() => {
    const term = messageSearch.trim().toLowerCase();
    return contacts.filter(item => {
      if (messageFilter === 'open' && item.handled) return false;
      if (!term) return true;
      return [item.name, item.email, item.message].some(value => String(value || '').toLowerCase().includes(term));
    });
  }, [contacts, messageFilter, messageSearch]);

  const selectedContact = contacts.find(item => item._id === selectedId) || null;
  const openCount = contacts.filter(item => !item.handled).length;

  const markHandled = async (id) => {
    setSavingId(id);
    try {
      const role = localStorage.getItem('userRole') || '';
      await axios.post(`/api/admin/contacts/${id}/handled`, {}, { headers: { 'x-user-role': role } });
      notify.message('Message marked as handled.');
      notifyAdminDataChanged();
      await fetchContacts();
    } catch (failure) {
      console.error('Failed to mark handled', failure);
      notify.error('The message could not be updated. Please try again.');
    } finally {
      setSavingId('');
    }
  };

  const filteredPeople = users.filter(user => {
    const term = peopleSearch.trim().toLowerCase();
    if (!term) return true;
    return [user.fullName, user.name, user.email].some(value => String(value || '').toLowerCase().includes(term));
  });

  const chatTarget = chatUser;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        description="Read messages from the contact form and chat with customers and tour operators."
        actions={(
          <div role="tablist" aria-label="Contact sections" className="glass inline-flex flex-wrap gap-1 rounded-full p-1">
            {TABS.map(({ key, label, icon: Icon }) => {
              const selected = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(key)}
                  className={`flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${selected ? 'bg-brand text-on-brand' : 'text-text-muted hover:text-text'}`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {label}
                  {key === 'messages' && openCount > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${selected ? 'bg-surface/30' : 'bg-danger text-white'}`}>{openCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      />

      {tab === 'messages' && (
        <div className="grid gap-5 lg:grid-cols-5">
          <AdminPanel className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <div className="relative flex-1">
                <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input type="search" aria-label="Search messages" value={messageSearch} onChange={e => setMessageSearch(e.target.value)} placeholder="Search name, email or text" className={`${inputClass} pl-9`} />
              </div>
              <div role="group" aria-label="Filter messages" className="inline-flex gap-1 rounded-xl bg-surface-muted p-1">
                {[['open', 'Unanswered'], ['all', 'All']].map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={messageFilter === value} onClick={() => setMessageFilter(value)} className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold transition-colors ${messageFilter === value ? 'bg-brand text-on-brand' : 'text-text-muted hover:text-text'}`}>{label}</button>
                ))}
              </div>
            </div>

            {contactsLoading && <div className="space-y-3" aria-live="polite"><p className="sr-only">Loading messages…</p>{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>}
            {!contactsLoading && contactsError && <ErrorState title="Messages could not be loaded" message={contactsError} onRetry={fetchContacts} />}
            {!contactsLoading && !contactsError && visibleContacts.length === 0 && (
              <EmptyState icon={LuInbox} title={messageFilter === 'open' ? 'No unanswered messages' : 'No messages yet'} description="Messages from the contact form appear here." />
            )}
            {!contactsLoading && !contactsError && visibleContacts.length > 0 && (
              <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1" aria-label="Messages">
                {visibleContacts.map(item => {
                  const active = item._id === selectedId;
                  return (
                    <li key={item._id} id={`contact-${item._id}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item._id)}
                        aria-current={active ? 'true' : undefined}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? 'border-brand/50 bg-brand/5' : 'border-transparent hover:bg-surface-muted'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            {!item.handled && <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-danger" />}
                            <span className="truncate font-semibold text-text">{item.name}</span>
                          </span>
                          <span className="flex-none text-xs text-text-muted">{new Date(item.createdAt).toLocaleDateString()}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm text-text-muted">{item.message}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminPanel>

          <AdminPanel className="min-w-0 lg:col-span-3">
            {!selectedContact && !contactsLoading && <EmptyState icon={LuMail} title="Select a message" description="Choose a message on the left to read it and reply." />}
            {selectedContact && (
              <article aria-label="Message details" className="space-y-5">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold text-text">{selectedContact.name}</h2>
                    <p className="mt-1 text-sm text-text-muted">Received {dateTime(selectedContact.createdAt)}</p>
                  </div>
                  {selectedContact.handled ? <Badge tone="success">Handled</Badge> : <Badge tone="danger">Unanswered</Badge>}
                </header>

                <dl className="grid gap-3 rounded-xl bg-surface-muted p-4 text-sm sm:grid-cols-2">
                  <div className="min-w-0"><dt className="text-text-muted">Email</dt><dd className="truncate font-semibold text-text">{selectedContact.email}</dd></div>
                  <div><dt className="text-text-muted">Source</dt><dd className="font-semibold text-text">Landing page contact form</dd></div>
                </dl>

                <p className="whitespace-pre-line rounded-xl border border-border p-5 leading-relaxed text-text">{selectedContact.message}</p>

                <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                  <a
                    href={`mailto:${selectedContact.email}?subject=${encodeURIComponent('Re: your TripBloom enquiry')}`}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
                  >
                    <LuMail aria-hidden="true" className="h-4 w-4" /> Reply by email
                  </a>
                  {!selectedContact.handled && (
                    <Button icon={LuCheck} loading={savingId === selectedContact._id} onClick={() => markHandled(selectedContact._id)}>Mark handled</Button>
                  )}
                </div>
              </article>
            )}
          </AdminPanel>
        </div>
      )}

      {tab === 'chat' && (
        <div className="grid gap-5 lg:grid-cols-5">
          <AdminPanel className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <div className="relative">
              <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input type="search" aria-label="Search people" value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} placeholder="Search customers and operators" className={`${inputClass} pl-9`} />
            </div>

            {usersLoading && <div className="space-y-3" aria-live="polite"><p className="sr-only">Loading conversations…</p>{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>}
            {!usersLoading && usersError && <ErrorState title="Conversations could not be loaded" message={usersError} onRetry={fetchUsers} />}
            {!usersLoading && !usersError && filteredPeople.length === 0 && (
              <EmptyState icon={LuUsers} title="No people found" description="Customers and tour operators appear here for chat." />
            )}
            {!usersLoading && !usersError && filteredPeople.length > 0 && (
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1" aria-label="Customers and operators">
                {filteredPeople.map(user => {
                  const name = user.fullName || user.name || user.email || 'User';
                  const active = chatTarget && chatTarget._id === user._id;
                  const Icon = isOperator(user) ? LuUserCog : LuUsers;
                  return (
                    <li key={user._id}>
                      <button
                        type="button"
                        data-chat-user={user._id}
                        onClick={() => setChatUser(user)}
                        aria-current={active ? 'true' : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-brand/10 ring-1 ring-brand/30' : 'hover:bg-surface-muted'}`}
                      >
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-muted text-sm font-bold text-text">{name.charAt(0).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-text">{name}</span>
                          <span className="flex items-center gap-1 text-xs text-text-muted"><Icon aria-hidden="true" className="h-3 w-3" />{isOperator(user) ? 'Tour operator' : 'Customer'}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminPanel>

          <AdminPanel className="min-w-0 lg:col-span-3">
            {!chatTarget && <EmptyState icon={LuMessagesSquare} title="Choose someone to chat with" description="Pick a customer or tour operator on the left." />}
            {chatTarget && (
              <div className="flex min-h-[28rem] flex-col">
                <div className="mb-4 border-b border-border pb-3">
                  <h2 className="font-display text-lg font-semibold text-text">{chatTarget.fullName || chatTarget.name || chatTarget.email}</h2>
                  <p className="text-sm text-text-muted">{isOperator(chatTarget) ? 'Tour operator' : 'Customer'}</p>
                </div>
                <AdminChat
                  currentUserId={localStorage.getItem('userId')}
                  otherUserId={chatTarget._id}
                  otherName={chatTarget.fullName || chatTarget.name || chatTarget.email}
                />
              </div>
            )}
          </AdminPanel>
        </div>
      )}
    </div>
  );
};

export default AdminContacts;
