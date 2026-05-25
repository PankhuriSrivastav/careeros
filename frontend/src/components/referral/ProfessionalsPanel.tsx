'use client';

import { useState, useEffect } from 'react';
import { searchProfessionals } from '@/lib/api';
import MessageDraftModal from './MessageDraftModal';

interface ProfessionalsPanelProps {
  company: string;
  role: string;
  application_id?: string;
}

interface Profile {
  name: string;
  college?: string;
  yoe_estimate?: number;
  profile_url: string;
  snippet: string;
  tier: number;
  score?: number;
}

export default function ProfessionalsPanel({
  company,
  role,
  application_id,
}: ProfessionalsPanelProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    const loadProfiles = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchProfessionals(company, role);
        setProfiles(data.profiles || []);
        setFilteredCount(data.filtered_count || 0);
      } catch (err) {
        console.error('Failed to search professionals:', err);
        setError('Failed to search for professionals. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (company) {
      loadProfiles();
    }
  }, [company, role]);

  const getTierBadgeColor = (tier: number) => {
    switch (tier) {
      case 1:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 2:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTierLabel = (tier: number) => {
    switch (tier) {
      case 1:
        return '🎓 Alumni';
      case 2:
        return '🏆 Tier-2 College';
      default:
        return 'Tier 3';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold text-gray-900">
            Professionals at {company}
          </h2>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            🔄 Refresh
          </button>
        </div>
        <p className="text-gray-600 text-sm">{role}</p>
        {filteredCount > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            {profiles.length + filteredCount} found · {filteredCount} filtered (interns/contractors who cannot refer)
          </p>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin">
              <svg
                className="w-8 h-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <p className="text-gray-600 mt-2">Searching DuckDuckGo for professionals...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-4 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 mx-auto text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No profiles found</h3>
            <p className="text-gray-600 text-sm mb-4">
              Try searching manually on LinkedIn for {role}s at {company}
            </p>
            <a
              href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                `${role} at ${company}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Open LinkedIn Search
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {profiles.map((profile, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{profile.snippet.substring(0, 100)}...</p>
                  </div>
                  <span
                    className={`ml-3 px-2 py-1 text-xs font-medium rounded border ${getTierBadgeColor(
                      profile.tier
                    )}`}
                  >
                    {getTierLabel(profile.tier)}
                  </span>
                </div>

                {/* Profile details */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs">
                  {profile.college && (
                    <span className="text-gray-700">
                      🎓 <strong>{profile.college}</strong>
                    </span>
                  )}
                  {profile.yoe_estimate !== undefined && profile.yoe_estimate > 0 && (
                    <span className="text-gray-700">
                      ⏱️ <strong>{profile.yoe_estimate}y</strong> experience
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <a
                    href={profile.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 text-center"
                  >
                    View Profile
                  </a>
                  <button
                    onClick={() => {
                      setSelectedProfile(profile);
                      setShowMessageModal(true);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                  >
                    Draft Message
                  </button>
                </div>
              </div>
            ))}

            {/* Disclaimer */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-200">
              <strong>Note:</strong> Profiles found via public search. Verify on LinkedIn — role may have changed.
              Always double-check before sending messages.
            </div>
          </div>
        )}
      </div>

      {/* Message Draft Modal */}
      {showMessageModal && selectedProfile && (
        <MessageDraftModal
          profile={selectedProfile}
          company={company}
          role={role}
          application_id={application_id}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedProfile(null);
          }}
        />
      )}
    </div>
  );
}
