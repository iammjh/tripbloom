import { LuPercent, LuSnowflake, LuSun, LuTag } from 'react-icons/lu';
import { notify } from '../utils/notifyStore.js';
import React, { useState } from 'react';


const SpecialOffers = () => {
  const [promoCode, setPromoCode] = useState('');

  const offers = [
    {
      icon: <LuTag aria-hidden="true" className="text-4xl" />,
      title: '20% Off Gold Packages',
      description: 'Limited time offer on all Gold tier bookings',
      code: 'GOLD20',
      color: 'from-yellow-400 to-yellow-600'
    },
    {
      icon: <LuSnowflake aria-hidden="true" className="text-4xl" />,
      title: 'Winter Wonderland Special',
      description: 'Exclusive deals on winter destinations',
      code: 'WINTER25',
      color: 'from-blue-400 to-blue-600'
    },
    {
      icon: <LuSun aria-hidden="true" className="text-4xl" />,
      title: 'Summer Beach Escape',
      description: 'Up to 30% off on tropical beach tours',
      code: 'BEACH30',
      color: 'from-orange-400 to-red-600'
    },
    {
      icon: <LuPercent aria-hidden="true" className="text-4xl" />,
      title: 'Early Bird Discount',
      description: 'Book 3 months in advance and save 15%',
      code: 'EARLY15',
      color: 'from-green-400 to-green-600'
    }
  ];

  const handleApplyPromo = (e) => {
    e.preventDefault();
    console.log('Applying promo code:', promoCode);
    notify.message(`Promo code "${promoCode}" applied!`);
  };

  return (
    <section className="section-container bg-gradient-to-br from-purple-50 to-pink-50">
      <h2 className="section-title">Special Offers & Deals</h2>
      <p className="section-subtitle">
        Don't miss out on our exclusive discounts and seasonal packages
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {offers.map((offer, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${offer.color} text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2`}
          >
            <div className="flex justify-center mb-4">
              {offer.icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{offer.title}</h3>
            <p className="text-sm mb-4 opacity-90">{offer.description}</p>
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-center font-mono font-bold">
              {offer.code}
            </div>
          </div>
        ))}
      </div>

      {/* Promo Code Input */}
      <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Have a Promo Code?</h3>
        <form onSubmit={handleApplyPromo} className="flex gap-3">
          <input
            type="text"
            placeholder="Enter code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="btn-primary">
            Apply
          </button>
        </form>
      </div>
    </section>
  );
};

export default SpecialOffers;
