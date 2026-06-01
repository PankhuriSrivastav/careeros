'use client';

import { useState } from 'react';

interface CompanySelectorProps {
  applications: any[];
  selectedCompany: string | null;
  onSelectCompany: (company: string, role: string) => void;
  loading: boolean;
}

export default function CompanySelector({
  applications,
  selectedCompany,
  onSelectCompany,
  loading,
}: CompanySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualCompany, setManualCompany] = useState('');
  const [manualRole, setManualRole] = useState('');

  const filteredApps = searchQuery.trim()
    ? applications.filter(
        (app) =>
          app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
          app.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : applications;

  const handleManualAdd = () => {
    if (manualCompany.trim()) {
      onSelectCompany(manualCompany.trim(), manualRole.trim() || 'General');
      setManualCompany('');
      setManualRole('');
      setShowManualAdd(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow sticky top-6">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Company</h2>
        <p className="text-xs text-gray-500 mb-3">Companies from your careeros applications</p>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
        />
      </div>

      {/* Applications List */}
      <div className="divide-y max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
        ) : filteredApps.length > 0 ? (
          filteredApps.map((app) => (
            <button
              key={app.id}
              onClick={() => onSelectCompany(app.company, app.role)}
              className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                selectedCompany === app.company ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="font-medium text-gray-900 text-sm">{app.company}</div>
              <div className="text-xs text-gray-600 mt-1">{app.role}</div>
              {app.status && (
                <div className="mt-2">
                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {app.status}
                  </span>
                </div>
              )}
            </button>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchQuery ? 'No companies match your search' : 'No applications yet'}
          </div>
        )}
      </div>

      {/* Manual Add Section */}
      <div className="p-4 border-t bg-gray-50">
        {!showManualAdd ? (
          <button
            onClick={() => setShowManualAdd(true)}
            className="w-full py-2 px-3 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            + Add company not in tracker
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Company name"
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            <input
              type="text"
              placeholder="Role (optional)"
              value={manualRole}
              onChange={(e) => setManualRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleManualAdd}
                className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                Search
              </button>
              <button
                onClick={() => {
                  setShowManualAdd(false);
                  setManualCompany('');
                  setManualRole('');
                }}
                className="flex-1 py-2 px-3 bg-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
