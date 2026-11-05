import React, { useId } from 'react';

// STAR_PATH is a five-point star on a 24 x 24 grid.
const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

// Five stars filled by rating: 4 fills four stars, 4.3 fills four stars and 30% of the fifth.
export default function StarRating({ value = 0, size = 'h-4 w-4', label, className = '' }) {
  const id = useId();
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const text = label || `Rated ${rating.toFixed(1)} out of 5`;

  return (
    <span role="img" aria-label={text} className={`inline-flex items-center gap-0.5 ${className}`}>
      {[0, 1, 2, 3, 4].map(index => {
        const fill = Math.round(Math.max(0, Math.min(1, rating - index)) * 100);
        const gradientId = `${id}-star-${index}`;
        return (
          <svg key={index} viewBox="0 0 24 24" aria-hidden="true" className={`${size} flex-none`}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
                <stop offset={`${fill}%`} style={{ stopColor: 'rgb(var(--warning))' }} />
                <stop offset={`${fill}%`} style={{ stopColor: 'transparent' }} />
              </linearGradient>
            </defs>
            <path
              d={STAR_PATH}
              fill={`url(#${gradientId})`}
              strokeWidth="1.5"
              strokeLinejoin="round"
              style={{ stroke: 'rgb(var(--warning))' }}
            />
          </svg>
        );
      })}
    </span>
  );
}
