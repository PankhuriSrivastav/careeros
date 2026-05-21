'use client';

import { useState, useMemo } from 'react';
import { Building2, Briefcase, Calendar, Trash2, Edit2, Search, Filter, ArrowUpDown, Wand2 } from 'lucide-react';
import { JobApplication } from '@/lib/api';
import EditApplicationModal from './EditApplicationModal';
import Link from 'next/link';

interface ApplicationListProps {
  applications: JobApplication[];
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, app: Omit<JobApplication, 'id'>) => Promise<void>;
}

export default function ApplicationList({ applications, onDelete, onUpdate }: ApplicationListProps) {
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'company' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  // Filter and Sort Logic
  const filteredAndSortedApplications = useMemo(() => {
    let filtered = [...applications];

    // Filter by search query (company or role)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.company.toLowerCase().includes(query) ||
          app.role.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.applied_date).getTime() - new Date(b.applied_date).getTime();
          break;
        case 'company':
          comparison = a.company.localeCompare(b.company);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [applications, searchQuery, statusFilter, sortBy, sortOrder]);

  const toggleSort = (newSortBy: 'date' | 'company' | 'status') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: 'date' | 'company' | 'status') => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4 ml-1" />;
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  // Get unique statuses for filter dropdown
  const uniqueStatuses = ['all', ...new Set(applications.map(app => app.status))];

  return (
    <>
      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="Applied">Applied</option>
              <option value="OA">Online Assessment</option>
              <option value="Interview">Interview</option>
              <option value="Offer">Offer</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Sort Options */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleSort('date')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Date {getSortIcon('date')}
            </button>
            <button
              onClick={() => toggleSort('company')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Company {getSortIcon('company')}
            </button>
            <button
              onClick={() => toggleSort('status')}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Status {getSortIcon('status')}
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || statusFilter !== 'all') && (
          <div className="mt-3 flex flex-wrap gap-2">
            {searchQuery && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                Search: {searchQuery}
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-1 hover:text-blue-600"
                >
                  ×
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                Status: {statusFilter}
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-1 hover:text-blue-600"
                >
                  ×
                </button>
              </span>
            )}
            <span className="text-xs text-gray-500 ml-auto">
              Showing {filteredAndSortedApplications.length} of {applications.length} applications
            </span>
          </div>
        )}
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Your Applications</h2>
        </div>
        <div className="divide-y">
          {filteredAndSortedApplications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {applications.length === 0
                ? "No applications yet. Add your first application!"
                : "No applications match your filters. Try adjusting your search."}
            </div>
          ) : (
            filteredAndSortedApplications.map((app) => (
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
                    <Link
                      href={`/tailorkit?app_id=${app.id}&company=${encodeURIComponent(app.company)}`}
                      className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition"
                      title="Tailor Resume"
                    >
                      <Wand2 className="w-5 h-5" />
                    </Link>
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