export function toDisplayReviews(payload) {
  const reviews = Array.isArray(payload) ? payload : payload?.reviews;
  if (!Array.isArray(reviews)) return [];

  return reviews
    .filter(review => review && (!review.status || review.status === 'APPROVED'))
    .map(review => ({
      ...review,
      id: review._id || review.id,
      name: review.customerId?.fullName || review.customerId?.name || review.name || 'Customer',
      rating: Number(review.rating) || 0,
      comment: review.comment || '',
      // Real photo only; never a stock portrait standing in for a reviewer. Callers show initials when this is empty.
      avatar: review.avatar || review.customerId?.avatar || null
    }));
}
