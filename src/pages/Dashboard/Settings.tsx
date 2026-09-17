

export const Settings = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-3xl">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Subscription Plans Management</h2>
        <p className="text-gray-600 mb-6">Edit the global subscription pricing for your softwares.</p>

        <form className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Library Management (Basic)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                <input type="number" defaultValue={499} className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Library Management (Pro)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                <input type="number" defaultValue={999} className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gym Management (Basic)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                <input type="number" defaultValue={799} className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gym Management (Pro)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">₹</span>
                <input type="number" defaultValue={1499} className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none" />
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button type="button" className="bg-brand-blue text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
