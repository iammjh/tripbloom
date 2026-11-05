// All money is expressed in the booking currency. Never count a refund as a receipt.
export const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
export function paymentTotals(booking = {}) {
  let gross = 0, refunded = 0, pending = 0;
  for (const payment of booking.payments || []) {
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    if (payment.status === 'SUCCESS') {
      if (payment.method === 'REFUND') refunded += amount;
      else gross += amount;
    } else if (payment.status === 'PENDING' && payment.method !== 'REFUND') pending += amount;
  }
  gross = roundMoney(gross); refunded = roundMoney(refunded); pending = roundMoney(pending);
  const price = Number(booking.finalAmount ?? booking.totalAmount ?? 0);
  const remaining = roundMoney(Math.max(0, (Number.isFinite(price) ? price : 0) - gross));
  return { gross, refunded, net: roundMoney(gross - refunded), pending, remaining, availableToSubmit: roundMoney(Math.max(0, remaining - pending)) };
}
export function validMoney(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER / 100 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
