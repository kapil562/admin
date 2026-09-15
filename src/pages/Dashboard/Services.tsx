import React from 'react';

export const Services = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Services & Marketing</h1>
        <button className="bg-brand-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          New Campaign
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Active Promotions</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Google Ads - Gym Software</h3>
              <p className="text-sm text-gray-500">Budget: ₹10,000 / month</p>
            </div>
            <div className="text-right">
              <span className="block text-brand-blue font-bold">142 Clicks</span>
              <span className="text-xs text-gray-400">This week</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Social Media SEO</h3>
              <p className="text-sm text-gray-500">Budget: ₹5,000 / month</p>
            </div>
            <div className="text-right">
              <span className="block text-brand-green font-bold">+12% Reach</span>
              <span className="text-xs text-gray-400">This week</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
