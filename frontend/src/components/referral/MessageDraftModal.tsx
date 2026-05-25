'use client';

import { useState, useEffect } from 'react';
import { draftMessage, trackReferral } from '@/lib/api';

interface MessageDraftModalProps {
  profile: {
    name: string;
    college?: string;
    yoe_estimate?: number;
    profile_url: string;
  };
  company: string;
  role: string;
  application_id?: string;
  onClose: () => void;
}

export default function MessageDraftModal({
  profile,
  company,
  role,
  application_id,
  onClose,
}: MessageDraftModalProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Get user name from localStorage or default
  const userName = typeof window !== 'undefined' ? localStorage.getItem('userName') || 'Friend' : 'Friend';
  const userCollege = typeof window !== 'undefined' ? localStorage.getItem('userCollege') || 'Your University' : 'Your University';

  useEffect(() => {
    const generateMessage = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await draftMessage({
          profile_name: profile.name,
          profile_college: profile.college,
          profile_yoe: profile.yoe_estimate,
          company,
          role,
          user_name: userName,
          user_college: userCollege,
          user_project: 'CareerOS',
        });
        setMessage(response.message_drafted);
      } catch (err) {
        console.error('Failed to draft message:', err);
        // Fallback to template
        setMessage(
          `Hi ${profile.name.split(' ')[0]},\n\nI'm interested in ${role} roles at ${company} and would love to learn about your experience.\n\nNo pressure to respond!\n\nBest,\n${userName}`
        );
      } finally {
        setLoading(false);
      }
    };

    generateMessage();
  }, [profile, company, role, userName, userCollege]);

  const handleMarkAsSent = async () => {
    if (!message.trim()) {
      setError('Message cannot be empty');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await trackReferral({
        application_id,
        company,
        role,
        profile_url: profile.profile_url,
        profile_name: profile.name,
        profile_college: profile.college,
        message_drafted: message,
      });
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to save outreach:', err);
      setError('Failed to save outreach. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    // Show toast
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg text-sm z-50';
    toast.textContent = '✓ Message copied to clipboard';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{profile.name}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {role} at {company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-6">
              <div className="inline-block animate-spin mb-2">
                <svg
                  className="w-6 h-6 text-blue-600"
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
              <p className="text-gray-600 text-sm">Drafting your message...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 p-3 rounded-lg text-red-700 text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Your Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                  rows={6}
                  placeholder="Your outreach message..."
                />
                <div className="mt-2 text-xs text-gray-500">
                  {message.length} characters
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 border border-blue-200">
                💡 <strong>Tip:</strong> You'll copy this message and send it manually on LinkedIn. Edit it
                before sending!
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="sticky bottom-0 bg-white p-6 border-t space-y-3">
            <div className="flex gap-3">
              <button
                onClick={handleCopyMessage}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                📋 Copy Message
              </button>
              <a
                href={profile.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 text-center"
              >
                🔗 Open LinkedIn
              </a>
            </div>

            <button
              onClick={handleMarkAsSent}
              disabled={saving || saved}
              className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                saved
                  ? 'bg-green-600 text-white'
                  : saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saved ? '✓ Saved to Tracker' : saving ? 'Saving...' : 'Mark as Sent'}
            </button>

            {!saved && (
              <p className="text-xs text-gray-600 text-center">
                After sending on LinkedIn, click "Mark as Sent" to track in CareerOS
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
