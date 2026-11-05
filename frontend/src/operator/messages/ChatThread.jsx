import React, { useEffect, useRef, useState } from 'react';
import { LuArrowLeft, LuMegaphone, LuMessagesSquare, LuSend } from 'react-icons/lu';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorState from '../../components/ui/ErrorState.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { inputClass } from '../../components/ui/FormField.jsx';
import { MESSAGE_LIMIT } from '../../utils/operatorMessages.js';

const SENDER_LABEL = { operator: 'You', customer: 'Traveller', admin: 'Administrator' };

// One conversation: its messages, and a composer unless the thread is a read-only announcement.
export default function ChatThread({ conversation, items, loading, error, onRetry, onSend, sending, onBack }) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);
  const readOnly = conversation.type === 'broadcast';
  const count = items.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count, conversation.id]);

  // Clear the draft when the operator switches conversation, so a reply never goes to the wrong person.
  useEffect(() => { setDraft(''); }, [conversation.id]);

  const submit = async event => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending || readOnly) return;
    const sent = await onSend(text);
    if (sent) setDraft('');
  };

  return (
    <section aria-labelledby="thread-heading" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border p-4">
        {onBack && (
          <Button variant="ghost" size="sm" icon={LuArrowLeft} onClick={onBack} className="md:hidden">Back</Button>
        )}
        <div className="min-w-0 flex-1">
          <h3 id="thread-heading" className="truncate font-display text-base font-semibold text-text">{conversation.customerName}</h3>
          <p className="truncate text-xs text-text-muted">{conversation.tourName}</p>
        </div>
        {readOnly && <Badge tone="info" icon={LuMegaphone}>Announcement</Badge>}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
        {loading && <Skeleton className="h-24 w-3/4 rounded-2xl" />}
        {!loading && error && <ErrorState title="Messages unavailable" message={error} onRetry={onRetry} />}
        {!loading && !error && items.length === 0 && (
          <EmptyState icon={LuMessagesSquare} title="No messages yet" description={readOnly ? 'Announcements you send to this departure appear here.' : 'Say hello to start the conversation.'} />
        )}
        {!loading && !error && items.map(item => {
          const mine = item.sender === 'operator';
          return (
            <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-brand text-on-brand' : 'glass text-text'}`}>
                <p className="mb-0.5 text-[11px] font-semibold opacity-80">{SENDER_LABEL[item.sender] || 'Traveller'}</p>
                <p className="whitespace-pre-wrap break-words">{item.text}</p>
                <p className="mt-1 text-right text-[10px] opacity-70">{item.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {!readOnly && (
        <form onSubmit={submit} className="border-t border-border p-4">
          <label htmlFor="thread-draft" className="sr-only">Message</label>
          <div className="flex items-end gap-3">
            <textarea
              id="thread-draft"
              rows={2}
              maxLength={MESSAGE_LIMIT}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
              }}
              placeholder="Write a message. Enter sends, Shift+Enter adds a line."
              className={`${inputClass} min-h-[44px] resize-none`}
            />
            <Button type="submit" icon={LuSend} loading={sending} disabled={!draft.trim()}>Send</Button>
          </div>
        </form>
      )}
    </section>
  );
}
