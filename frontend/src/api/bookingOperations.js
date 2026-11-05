export async function saveOperatorNotes(bookingId, operatorNotes, request = globalThis.fetch) {
  const response = await request(`/api/bookings/${encodeURIComponent(bookingId)}/operator-notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operatorNotes })
  });
  const payload = await response.json();
  if (!response.ok || !payload?.success || typeof payload.booking?.operatorNotes !== 'string') {
    throw new Error(payload?.message || 'Failed to save operator notes.');
  }
  return payload.booking;
}
