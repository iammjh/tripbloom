import React, { useState } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

const ARROW = 'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur transition-colors hover:bg-black/70';

// Photo gallery at the top of the tour details. Shows a branded field when there is no photo or the photo fails to load.
export default function TourGallery({ title, images, activeImageIndex, setActiveImageIndex, prevImage, nextImage }) {
  // Remember photos that failed so the fallback shows without retrying on every render.
  const [failedSrc, setFailedSrc] = useState(null);
  const photoSrc = images[activeImageIndex];
  const showPhoto = Boolean(photoSrc) && photoSrc !== failedSrc;

  return (
    <div className="relative h-56 overflow-hidden rounded-xl bg-surface-muted sm:h-72">
      {showPhoto ? (
        <img
          key={photoSrc}
          src={photoSrc}
          alt={title}
          onError={() => setFailedSrc(photoSrc)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-brand-strong via-surface to-info/40" />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={prevImage} className={`left-3 ${ARROW}`}>
            <LuChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Next photo" onClick={nextImage} className={`right-3 ${ARROW}`}>
            <LuChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Show photo ${idx + 1}`}
                aria-current={idx === activeImageIndex ? 'true' : undefined}
                onClick={() => setActiveImageIndex(idx)}
                className="flex h-11 w-6 items-center justify-center"
              >
                <span className={`block h-2 rounded-full transition-all ${idx === activeImageIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
