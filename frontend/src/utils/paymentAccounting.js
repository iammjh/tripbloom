export function paymentTotals(booking = {}) {
  let gross = 0, refunded = 0, pending = 0;
  for (const p of booking.payments || []) {
    if (!Number.isFinite(Number(p.amount)) || Number(p.amount) < 0) continue;
    if (p.status === 'SUCCESS') { if (p.method === 'REFUND') refunded += Number(p.amount); else gross += Number(p.amount); }
    else if (p.status === 'PENDING' && p.method !== 'REFUND') pending += Number(p.amount);
  }
  const round = value => Math.round(value * 100) / 100;
  const remaining = round(Math.max(0, Number(booking.finalAmount ?? booking.totalAmount ?? 0) - gross));
  return { gross: round(gross), refunded: round(refunded), net: round(gross - refunded), pending: round(pending), remaining, availableToSubmit: round(Math.max(0, remaining - pending)) };
}
