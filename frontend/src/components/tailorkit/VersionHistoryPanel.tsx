'use client';

import { useState } from 'react';
import { apiService } from '@/lib/api';
import { Upload, ChevronDown, Badge } from 'lucide-react';
import { ResumeVersion } from '@/app/tailorkit/page';

interface VersionHistoryPanelProps {
  versions: ResumeVersion[];
  selectedVersion: ResumeVersion | null;
  onSelectVersion: (version: ResumeVersion) => void;
  onVersionsUpdated: (versions: ResumeVersion[]) => void;
  loading: boolean;
}

export default function VersionHistoryPanel({
  versions,
  selectedVersion,
  onSelectVersion,
  onVersionsUpdated,
  loading,
}: VersionHistoryPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadError(null);

      const result = await apiService.analyzeResume(file);

      // Get updated versions list
      const updatedVersions = await apiService.getResumeVersions();
      onVersionsUpdated(updatedVersions);

      // Select the newly uploaded version (first in list)
      if (updatedVersions.length > 0) {
        onSelectVersion(updatedVersions[0]);
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.detail || 'Failed to upload resume');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const formatScoreDiff = (diff: number | null): string => {
    if (diff === null || diff === undefined) return '';
    if (diff > 0) return `+${diff}`;
    return String(diff);
  };

  const getScoreDiffColor = (diff: number | null): string => {
    if (diff === null || diff === undefined) return 'text-gray-500';
    if (diff > 0) return 'text-green-600';
    if (diff < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Version History</h2>

      {/* Versions List */}
      <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No resume versions yet</p>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              onClick={() => onSelectVersion(version)}
              className={`p-3 rounded-lg cursor-pointer transition ${
                selectedVersion?.id === version.id
                  ? 'bg-blue-50 border border-blue-300'
                  : 'bg-gray-50 border border-transparent hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {version.label}
                    </p>
                    {selectedVersion?.id === version.id && (
                      <Badge className="bg-blue-600 text-white text-xs py-0 px-2">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{version.upload_date}</p>
                </div>
              </div>

              {/* ATS Score */}
              {version.ats_score !== null && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">ATS Score:</span>
                    <span className="font-bold text-lg text-gray-900">
                      {version.ats_score}
                    </span>
                  </div>

                  {/* Score Diff */}
                  {version.score_diff !== null && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-600">Diff:</span>
                      <span className={`text-sm font-semibold ${getScoreDiffColor(version.score_diff)}`}>
                        {formatScoreDiff(version.score_diff)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tailored Badge */}
              {version.is_tailored && version.tailored_for_company && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <Badge className="bg-purple-100 text-purple-800 text-xs py-0 px-2">
                    Tailored for {version.tailored_for_company}
                  </Badge>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Upload New Version Button */}
      <label className="w-full">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
        <button
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded-lg transition font-medium text-sm"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload New Version'}
        </button>
      </label>

      {uploadError && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {uploadError}
        </div>
      )}
    </div>
  );
}
