import React from 'react';

export const Softwares = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Personal Softwares</h1>
        <button className="bg-brand-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          Add Software
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Library Management</h2>
              <p className="text-gray-500 text-sm">v1.2.4</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Active</span>
          </div>
          <p className="text-gray-600 flex-1">Complete solution for managing library inventory, book issuing, and memberships.</p>
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-500">145 Active Clients</span>
            <button className="text-brand-blue font-medium hover:underline">Manage</button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Gym Management</h2>
              <p className="text-gray-500 text-sm">v2.0.1</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">Active</span>
          </div>
          <p className="text-gray-600 flex-1">Member tracking, subscription billing, and equipment maintenance scheduling.</p>
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-500">82 Active Clients</span>
            <button className="text-brand-blue font-medium hover:underline">Manage</button>
          </div>
        </div>
      </div>
    </div>
  );
};
