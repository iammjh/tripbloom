import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Review } from '../model/review.model.js';
import { updateReview } from '../service/review.service.js';

afterEach(() => test.mock.restoreAll());

const reviewId = '555555555555555555555555';
const customerId = '666666666666666666666666';
const otherCustomerId = '777777777777777777777777';

// A stand-in for a Review document: records saves and accepts populate calls.
function fakeReview(status, overrides = {}) {
  return {
    _id: reviewId,
    customerId: { toString: () => customerId },
    status,
    rating: 2,
    comment: 'The guide was late on the second day.',
    moderatorNote: 'Please describe the experience without naming staff.',
    saves: 0,
    async save() { this.saves += 1; },
    async populate() { return this; },
    ...overrides,
  };
}

function stubFind(review) {
  test.mock.method(Review, 'findById', async () => review);
}

test('a rejected review can be edited and resubmitted; it goes back to pending and the old note is cleared', async () => {
  const review = fakeReview('REJECTED');
  stubFind(review);
  const result = await updateReview({
    reviewId,
    customerId,
    rating: 4,
    comment: '  Beach cottage and the boat trip were lovely. The guide was late once.  ',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.review.status, 'PENDING');
  assert.equal(result.review.moderatorNote, undefined);
  assert.equal(result.review.rating, 4);
  assert.equal(result.review.comment, 'Beach cottage and the boat trip were lovely. The guide was late once.');
  assert.equal(review.saves, 1);
});

test('a pending review can be edited and stays pending', async () => {
  const review = fakeReview('PENDING', { moderatorNote: undefined });
  stubFind(review);
  const result = await updateReview({ reviewId, customerId, rating: 5, comment: 'Updated comment for a pending review.' });
  assert.equal(result.review.status, 'PENDING');
  assert.equal(result.review.rating, 5);
  assert.equal(review.saves, 1);
});

test('an approved review cannot be changed, and nothing is saved', async () => {
  const review = fakeReview('APPROVED', { moderatorNote: undefined });
  stubFind(review);
  const result = await updateReview({ reviewId, customerId, rating: 5, comment: 'Trying to change a published review.' });
  assert.match(result.error, /Cannot edit approved reviews/);
  assert.equal(review.saves, 0);
});

test('another customer cannot edit someone else\'s rejected review', async () => {
  const review = fakeReview('REJECTED');
  stubFind(review);
  const result = await updateReview({ reviewId, customerId: otherCustomerId, rating: 5, comment: 'Trying to take over a review.' });
  assert.match(result.error, /only edit your own reviews/);
  assert.equal(review.saves, 0);
});

test('invalid rating or short text is refused before anything is saved', async () => {
  const review = fakeReview('REJECTED');
  stubFind(review);
  const badRating = await updateReview({ reviewId, customerId, rating: 7, comment: 'A long enough comment here.' });
  assert.match(badRating.error, /whole number from 1 to 5/);
  const shortText = await updateReview({ reviewId, customerId, rating: 3, comment: 'Too short' });
  assert.match(shortText.error, /between 10 and 1000 characters/);
  assert.equal(review.saves, 0);
  assert.equal(review.status, 'REJECTED', 'a refused edit must leave the rejection in place');
});
