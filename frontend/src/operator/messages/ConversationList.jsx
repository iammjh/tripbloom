import React from 'react';
import { LuMessagesSquare, LuSearch, LuUser } from 'react-icons/lu';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';
import { relativeTime } from '../../utils/operatorMessages.js';

const KIND_LABEL = { booking: 'Booking', tour: 'Traveller', broadcast: 'Announcement', admin: 'Support' };

export default function ConversationList({ conversations, activeId, query, onQuery, onSelect, loading, error, onRetry }) {
  return (
    <section aria-labelledby="conversation-list-heading" className="flex min-h-0 flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <h3 id="conversation-list-heading" className="font-display text-base font-semibold text-text">Conversations</h3>
        <div className="relative">
          <LuSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            aria-label="Search conversations"
            placeholder="Search by name or tour"
            value={query}
            onChange={event => onQuery(event.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {loading && (
          <div className="space-y-2 p-2" aria-live="polite">
            <p className="sr-only">Loading conversations…</p>
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {!loading && error && <ErrorState title="Conversations unavailable" message={error} onRetry={onRetry} />}

        {!loading && !error && conversations.length === 0 && (
          <EmptyState
            icon={LuMessagesSquare}
            title={query ? 'No matches' : 'No conversations yet'}
            description={query ? 'Try another name or tour.' : 'Messages from travellers and administrators appear here.'}
          />
        )}

        {!loading && !error && conversations.length > 0 && (
          <ul className="space-y-1">
            {conversations.map(conversation => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onSelect(conversation)}
                    className={`flex min-h-[64px] w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${active ? 'bg-brand/15 ring-1 ring-inset ring-brand/30' : 'hover:bg-surface-muted'}`}
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand/15 text-brand" aria-hidden="true">
                      <LuUser className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-text">{conversation.customerName}</span>
                        <span className="flex-none text-[11px] text-text-muted">{relativeTime(conversation.timestamp)}</span>
                      </span>
                      <span className="block truncate text-xs text-text-muted">{KIND_LABEL[conversation.type]} · {conversation.tourName}</span>
                      <span className="mt-0.5 block truncate text-sm text-text-muted">{conversation.lastMessage}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
