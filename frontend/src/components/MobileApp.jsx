import { LuApple, LuBell, LuMap, LuRoute, LuWifi } from 'react-icons/lu';
import { FaGooglePlay } from 'react-icons/fa';
import React from 'react';


const MobileApp = () => {
  const appFeatures = [
    { icon: <LuMap aria-hidden="true" />, text: 'Live GPS tracking' },
    { icon: <LuRoute aria-hidden="true" />, text: 'Smart itinerary planner' },
    { icon: <LuWifi aria-hidden="true" />, text: 'Offline access to bookings' },
    { icon: <LuBell aria-hidden="true" />, text: 'Emergency alerts & support' }
  ];

  return (
    <section className="section-container bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: Content */}
        <div>
          <h2 className="font-display text-4xl font-bold mb-4">
            Track Your Journey On-the-Go
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Download the TripBloom app and manage your entire trip from your phone
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {appFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-2xl">{feature.icon}</span>
                <span className="text-lg">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Download Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-3 hover:bg-gray-900 transition-all duration-300">
              <LuApple aria-hidden="true" className="text-3xl" />
              <div className="text-left">
                <div className="text-xs">Download on the</div>
                <div className="text-lg font-bold">App Store</div>
              </div>
            </button>
            <button className="bg-black text-white px-6 py-3 rounded-lg flex items-center gap-3 hover:bg-gray-900 transition-all duration-300">
              <FaGooglePlay className="text-3xl" />
              <div className="text-left">
                <div className="text-xs">GET IT ON</div>
                <div className="text-lg font-bold">Google Play</div>
              </div>
            </button>
          </div>
        </div>

        {/* Right: Phone Mockup */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-64 h-[500px] bg-white rounded-3xl shadow-2xl p-4 transform rotate-6 hover:rotate-0 transition-transform duration-500">
              <div className="bg-gradient-to-br from-green-400 to-blue-500 h-full rounded-2xl flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="flex justify-center mb-4">
                    <img src="/tripbloom_logo.svg" alt="TripBloom" className="w-32 h-32" />
                  </div>
                  <div className="text-white font-bold text-2xl">TripBloom</div>
                  <div className="text-white/80 mt-2">Your Travel Companion</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MobileApp;
