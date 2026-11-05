import { LuBriefcase, LuHandshake, LuTrendingUp, LuUsers } from 'react-icons/lu';
import React from 'react';


const BusinessSection = () => {
  const benefits = [
    { icon: <LuBriefcase aria-hidden="true" />, text: 'Upload and manage tour packages' },
    { icon: <LuTrendingUp aria-hidden="true" />, text: 'Track bookings and revenue in real-time' },
    { icon: <LuUsers aria-hidden="true" />, text: 'Access customer insights and analytics' },
    { icon: <LuHandshake aria-hidden="true" />, text: 'Join a trusted network of operators' }
  ];

  return (
    <section className="section-container bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: Content */}
        <div>
          <h2 className="font-display text-4xl font-bold mb-4">
            For Tour Operators & Travel Partners
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Grow your business with TripBloom's powerful platform
          </p>

          <div className="space-y-4 mb-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="text-3xl bg-white/20 p-3 rounded-lg">
                  {benefit.icon}
                </div>
                <span className="text-lg">{benefit.text}</span>
              </div>
            ))}
          </div>

          <button className="bg-white text-indigo-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all duration-300 shadow-xl">
            Become a Tour Partner
          </button>
        </div>

        {/* Right: Dashboard Preview */}
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20">
          <h3 className="text-2xl font-bold mb-6">Admin Dashboard Features</h3>
          <div className="space-y-4">
            <div className="bg-white/20 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Total Bookings</span>
                <span className="text-2xl font-bold">1,234</span>
              </div>
              <div className="bg-white/30 h-2 rounded-full overflow-hidden">
                <div className="bg-green-400 h-full w-3/4"></div>
              </div>
            </div>
            <div className="bg-white/20 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Revenue (This Month)</span>
                <span className="text-2xl font-bold">$89,450</span>
              </div>
              <div className="bg-white/30 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-400 h-full w-4/5"></div>
              </div>
            </div>
            <div className="bg-white/20 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Active Tours</span>
                <span className="text-2xl font-bold">47</span>
              </div>
              <div className="bg-white/30 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-400 h-full w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BusinessSection;
