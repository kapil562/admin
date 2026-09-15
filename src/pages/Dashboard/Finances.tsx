import React from 'react';

export const Finances = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Company Finances</h1>
        <button className="bg-brand-blue text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          Add Record
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
            <tr>
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Description</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="p-4">Sep 12, 2026</td>
              <td className="p-4">Software License Sales</td>
              <td className="p-4"><span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">Income</span></td>
              <td className="p-4 text-green-600 font-medium">+ ₹50,000</td>
            </tr>
            <tr className="border-b border-gray-50">
              <td className="p-4">Sep 10, 2026</td>
              <td className="p-4">Server Hosting</td>
              <td className="p-4"><span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm">Expense</span></td>
              <td className="p-4 text-red-600 font-medium">- ₹5,000</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
