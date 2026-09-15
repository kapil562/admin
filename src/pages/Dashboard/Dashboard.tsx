import React from 'react';

export const Dashboard = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total Income</h3>
          <p className="text-3xl font-bold text-brand-blue mt-2">₹4,50,000</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total Expenses</h3>
          <p className="text-3xl font-bold text-red-500 mt-2">₹1,20,000</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Active Softwares</h3>
          <p className="text-3xl font-bold text-brand-green mt-2">2</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Active Services</h3>
          <p className="text-3xl font-bold text-purple-500 mt-2">3</p>
        </div>
      </div>
    </div>
  );
};
