import { LuX } from 'react-icons/lu';
import React, { useState } from 'react';


const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState(null);

  const images = [
    { id: 1, url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=500', caption: 'Beach Sunset' },
    { id: 2, url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500', caption: 'Mountain Adventure' },
    { id: 3, url: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=500', caption: 'Bonfire Night' },
    { id: 4, url: 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=500', caption: 'BBQ Party' },
    { id: 5, url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=500', caption: 'Tropical Paradise' },
    { id: 6, url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500', caption: 'Mountain Peak' },
    { id: 7, url: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=500', caption: 'Music Festival' },
    { id: 8, url: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=500', caption: 'City Lights' },
  ];

  return (
    <section className="section-container bg-white">
      <h2 className="section-title">Experience Highlights</h2>
      <p className="section-subtitle">
        See what awaits you on your TripBloom adventure
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative overflow-hidden rounded-lg shadow-lg cursor-pointer group"
            onClick={() => setSelectedImage(image)}
          >
            <img
              src={image.url}
              alt={image.caption}
              className="w-full h-64 object-cover transform group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
              <p className="text-white font-semibold p-4">{image.caption}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            <LuX aria-hidden="true" />
          </button>
          <div className="max-w-4xl">
            <img
              src={selectedImage.url}
              alt={selectedImage.caption}
              className="w-full h-auto rounded-lg"
            />
            <p className="text-white text-center text-xl mt-4">{selectedImage.caption}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default Gallery;
