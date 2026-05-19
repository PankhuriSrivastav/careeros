'use client';

import { JobApplication } from '@/lib/api';
import StatsCards from '@/components/common/StatsCards';
import ApplicationForm from '@/components/common/ApplicationForm';
import ApplicationList from '@/components/common/ApplicationList';

interface ApplicationsTabProps {
  applications: JobApplication[];
  onCreate: (app: { company: string; role: string; status: string; job_description?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, app: Omit<JobApplication, 'id'>) => Promise<void>;  // ✅ Added
}

export default function ApplicationsTab({ applications, onCreate, onDelete, onUpdate }: ApplicationsTabProps) {
  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'Applied').length,
    interview: applications.filter(a => a.status === 'Interview').length,
    offer: applications.filter(a => a.status === 'Offer').length,
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Application Dashboard</h1>
        <p className="text-gray-600">Track all your job applications in one place</p>
      </div>

      <StatsCards {...stats} />
      <ApplicationForm onSubmit={onCreate} />
      <ApplicationList
        applications={applications}
        onDelete={onDelete}
        onUpdate={onUpdate}  // ✅ Passed to ApplicationList
      />
    </>
  );
}