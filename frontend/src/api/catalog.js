import axios from 'axios';

export async function listPublicPackages(transport = axios) {
  const { data } = await transport.get('/api/packages/search');
  if (!data?.success || !Array.isArray(data.packages)) {
    throw new Error(data?.message || 'Failed to load packages.');
  }
  return data.packages;
}

export async function getPublicPackage(packageId, transport = axios) {
  const { data } = await transport.get(`/api/packages/${encodeURIComponent(packageId)}`);
  if (!data?.success || !data.package || typeof data.package !== 'object') {
    throw new Error(data?.message || 'Failed to load package details.');
  }
  return data.package;
}

export async function getAvailableDepartures(packageId, transport = axios) {
  const { data } = await transport.get(`/api/packages/${encodeURIComponent(packageId)}/departures/available`);
  if (!data?.success || !Array.isArray(data.departures)) {
    throw new Error(data?.message || 'Failed to load available departures.');
  }
  return data.departures.map(departure => ({
    ...departure,
    _id: departure._id || departure.departureId,
  }));
}

// Keep the submitted dates and amount aligned with the selected modeled package/departure.
export function getBookingSchedule(packageData, departure, requestedDate, numTravelers) {
  if (!Number.isInteger(numTravelers) || numTravelers < 1) {
    throw new Error('A valid number of travelers is required.');
  }
  const isGroup = packageData.type === 'GROUP';
  if (isGroup && !departure) throw new Error('Please select an available departure.');
  const startDate = new Date(isGroup ? departure.startDate : requestedDate);
  let endDate;
  if (isGroup) {
    endDate = new Date(departure.endDate);
  } else {
    if (!Number.isFinite(packageData.defaultDays) || packageData.defaultDays <= 0) {
      throw new Error('The package has no valid tour duration.');
    }
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + packageData.defaultDays);
  }
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
    throw new Error('The tour dates are invalid.');
  }
  const price = isGroup ? departure.pricePerPerson : packageData.basePrice;
  if (!Number.isFinite(price) || price < 0) throw new Error('The tour price is invalid.');
  return { startDate, endDate, totalAmount: price * numTravelers };
}
