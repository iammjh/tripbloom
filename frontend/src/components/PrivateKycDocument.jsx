import React, { useEffect, useState } from 'react';
export default function PrivateKycDocument({ path, ...props }) {
  const [document, setDocument] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true, objectUrl;
    const abort = new AbortController(); setDocument(null); setError('');
    const load = async () => {
      try {
        const normalized = '/' + String(path || '').replace(/^\/+/, '');
        if (!/^\/uploads\/kyc\/kyc-[a-zA-Z0-9.-]+$/.test(normalized)) throw new Error('Document path is unavailable.');
        const response = await fetch(normalized, { signal: abort.signal });
        if (!response.ok) throw new Error('Unable to load this private document.');
        const blob = await response.blob(); objectUrl = URL.createObjectURL(blob);
        if (active) setDocument({ url: objectUrl, isPdf: blob.type === 'application/pdf' });
        else URL.revokeObjectURL(objectUrl);
      } catch (failure) { if (active && failure.name !== 'AbortError') setError(failure.message); }
    };
    load();
    return () => { active = false; abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!document) return <p>Loading private document…</p>;
  return document.isPdf ? <a href={document.url} target="_blank" rel="noreferrer">Open private PDF document</a> : <img {...props} src={document.url} onError={() => setError('Unable to display this private document.')} />;
}
