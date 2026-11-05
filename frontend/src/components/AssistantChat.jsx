import React, { useEffect, useRef, useState } from 'react';
import { LuMessageCircle, LuSend, LuX } from 'react-icons/lu';
import { apiClient } from '../api/client.js';
import { buildHistoryForRequest, isSendable, suggestedPrompts } from '../utils/assistantRules.js';

const GREETING = 'Hi, I am the TripBloom assistant. Tell me about the trip you have in mind, or ask about any package or destination.';
const NOTE = 'Answers are generated automatically. Confirm prices and dates on the package page before booking.';
const FALLBACK_ERROR = 'The assistant could not answer. Please try again.';

// Floating chat panel for public pages. Messages live in component state only, so a page reload starts a new conversation.
export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, sending]);

  async function send(text) {
    const content = String(text ?? draft).trim();
    if (!isSendable(content) || sending) return;
    // History is taken before this message is added, so the server receives the earlier turns only.
    const history = buildHistoryForRequest(messages);
    setMessages(previous => [...previous, { role: 'user', content }]);
    setDraft('');
    setError('');
    setSending(true);
    try {
      const { data } = await apiClient.post('/assistant/chat', { message: content, history });
      setMessages(previous => [...previous, { role: 'assistant', content: data.reply }]);
    } catch (failure) {
      setError(failure.response?.data?.message || FALLBACK_ERROR);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    send();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls="tripbloom-assistant-panel"
        className="liquid-glass fixed bottom-4 right-4 z-40 inline-flex min-h-[48px] items-center gap-2 rounded-full px-5 text-sm font-semibold text-brand transition-transform hover:-translate-y-0.5"
      >
        <LuMessageCircle aria-hidden="true" className="h-5 w-5" />
        <span>Ask TripBloom</span>
      </button>

      {open && (
        <section
          id="tripbloom-assistant-panel"
          role="dialog"
          aria-label="TripBloom assistant"
          className="liquid-glass fixed bottom-20 right-4 z-50 flex max-h-[min(72vh,560px)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-display text-base font-semibold text-text">TripBloom assistant</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            >
              <LuX aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user' ? 'bg-brand/85 text-on-brand shadow-md' : 'border border-white/10 bg-surface/60 text-text backdrop-blur-md'
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestedPrompts.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-text backdrop-blur-md transition-colors hover:bg-white/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {sending && <p role="status" className="text-xs text-text-muted">Looking that up…</p>}
            {error && <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-text">{error}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={1000}
                placeholder="Ask about a trip or destination"
                aria-label="Your question"
                className="min-h-[44px] flex-1 rounded-lg border border-white/15 bg-surface/50 px-3 text-sm text-text backdrop-blur-md placeholder:text-text-muted"
              />
              <button
                type="submit"
                disabled={!isSendable(draft) || sending}
                aria-label="Send"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-on-brand transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <LuSend aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-text-muted">{NOTE}</p>
          </form>
        </section>
      )}
    </>
  );
}
