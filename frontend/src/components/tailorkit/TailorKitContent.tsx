'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiService } from '@/lib/api';
import VersionHistoryPanel from '@/components/tailorkit/VersionHistoryPanel';
import TailoringWorkspace from '@/components/tailorkit/TailoringWorkspace';
import OutputDisplay from '@/components/tailorkit/OutputDisplay';
import { MessageCircle } from 'lucide-react';
import { ResumeVersion, TailoredOutput } from '@/app/tailorkit/page';

interface TailorKitContentProps {
  versions: ResumeVersion[];
  applications: any[];
  onVersionsUpdated: (versions: ResumeVersion[]) => void;
}

export default function TailorKitContent({
  versions: initialVersions,
  applications,
  onVersionsUpdated,
}: TailorKitContentProps) {
  const searchParams = useSearchParams();
  const appId = searchParams.get('app_id');
  const companyName = searchParams.get('company');

  const [versions, setVersions] = useState<ResumeVersion[]>(initialVersions);
  const [selectedVersion, setSelectedVersion] = useState<ResumeVersion | null>(null);
  const [tailoredOutput, setTailoredOutput] = useState<TailoredOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected version
  useEffect(() => {
    if (versions.length > 0 && !selectedVersion) {
      setSelectedVersion(versions[0]);
    }
  }, [versions, selectedVersion]);

  if (error) {
    return (
      <div className="col-span-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <MessageCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const handleVersionsUpdated = (newVersions: ResumeVersion[]) => {
    setVersions(newVersions);
    onVersionsUpdated(newVersions);
    if (newVersions.length > 0) {
      setSelectedVersion(newVersions[0]);
    }
  };

  return (
    <>
      {/* Left side - Version History Panel (1/3 width on desktop) */}
      <div className="lg:col-span-1">
        <VersionHistoryPanel
          versions={versions}
          selectedVersion={selectedVersion}
          onSelectVersion={setSelectedVersion}
          onVersionsUpdated={handleVersionsUpdated}
          loading={loading}
        />
      </div>

      {/* Right side - Main workspace (2/3 width on desktop) */}
      <div className="lg:col-span-2">
        {tailoredOutput ? (
          <OutputDisplay
            output={tailoredOutput}
            onSaved={(newVersion) => {
              setVersions([newVersion, ...versions]);
              setTailoredOutput(null);
              setSelectedVersion(newVersion);
            }}
            onStartOver={() => setTailoredOutput(null)}
          />
        ) : (
          <TailoringWorkspace
            selectedVersion={selectedVersion}
            onTailorComplete={setTailoredOutput}
            applications={applications}
            preSelectedCompany={companyName}
            preSelectedAppId={appId}
            onVersionChanged={setSelectedVersion}
          />
        )}
      </div>
    </>
  );
}
