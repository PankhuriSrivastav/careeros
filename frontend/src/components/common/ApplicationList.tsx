'use client';

import { useState } from 'react';
import { Building2, Briefcase, Calendar, Trash2, Edit2 } from 'lucide-react';
import { JobApplication } from '@/lib/api';
import EditApplicationModal from './EditApplicationModal';

interface ApplicationListProps {
  applications: JobApplication[];
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, app: Omit<JobApplication, 'id'>) => Promise<void>;
}

export default function ApplicationList({ applications, onDelete, onUpdate }: ApplicationListProps) {
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Applied': return 'bg-blue-100 text-blue-800';
      case 'Interview': return 'bg-yellow-100 text-yellow-800';
      case 'Offer': return 'bg-green-100 text-green-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const handleEdit = (app: JobApplication) => {
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleSave = async (id: string, app: Omit<JobApplication, 'id'>) => {
    await onUpdate(id, app);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Your Applications</h2>
        </div>
        <div className="divide-y">
          {applications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No applications yet. Add your first application!
            </div>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-semibold">{app.company}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-gray-600">
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-2" />
                        {app.role}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        {app.applied_date}
                      </div>
                      {app.salary && (
                        <div className="text-green-600 font-medium">{app.salary} LPA</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(app)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onDelete(app.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <EditApplicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        application={editingApp}
      />
    </>
  );
}