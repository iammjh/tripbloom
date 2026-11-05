// Figures for the operator home page, computed from the operator's assigned departures.
// Days are local calendar days. Departures without a valid start date are ignored, so no figure can become NaN.

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "YYYY-MM-DD" for the local calendar day of a value.
export function localDayKey(value) {
  const date = toDate(value);
  if (!date) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Departures whose start date falls on the given local day.
export function departuresOnDay(departures, dayKey) {
  return (departures || []).filter(departure => localDayKey(departure.startDate) === dayKey && localDayKey(departure.startDate) !== null);
}

// Seven entries starting today: each has its day key, its date, and how many departures start that day.
export function sevenDayStrip(departures, now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index);
    const key = localDayKey(date);
    return { key, date, count: departuresOnDay(departures, key).length };
  });
}

// Everything the home page shows about the operator's departures.
export function homeFigures(departures, now = new Date()) {
  const list = departures || [];
  return {
    todayDepartures: departuresOnDay(list, localDayKey(now)),
    week: sevenDayStrip(list, now),
    assignedCount: list.length,
  };
}

export { DAY_MS };
