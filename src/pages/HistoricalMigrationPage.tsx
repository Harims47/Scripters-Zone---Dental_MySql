import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  RefreshCw,
  FolderArchive
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { BatchUploadModal } from '../components/historicalMigration/BatchUploadModal';
import { HistoricalReviewWorkspace } from '../components/historicalMigration/HistoricalReviewWorkspace';
import type { MigrationRecordItem } from '../components/historicalMigration/HistoricalReviewWorkspace';
import { BatchResultsSummaryModal } from '../components/historicalMigration/BatchResultsSummaryModal';
import { toast } from 'react-hot-toast';

interface MigrationBatch {
  id: string;
  name: string;
  status: 'UPLOADED' | 'OCR_PROCESSING' | 'AWAITING_REVIEW' | 'IMPORTING' | 'COMPLETED' | 'FAILED';
  totalPages: number;
  processedRecords: number;
  approvedRecords: number;
  importedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  createdAt: string;
  updatedAt: string;
}

export const HistoricalMigrationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [batches, setBatches] = useState<MigrationBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Active review workspace state
  const [activeBatch, setActiveBatch] = useState<MigrationBatch | null>(null);
  const [activeRecords, setActiveRecords] = useState<MigrationRecordItem[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Import summary state
  const [importSummary, setImportSummary] = useState<any | null>(null);

  const isHeadDoctor = currentUser?.role === 'Head Doctor';

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/historical-migration/batches', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch migration batches');
      const data = await res.json();
      setBatches(data);
    } catch (err: any) {
      toast.error(err.message || 'Error loading batches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const openWorkspace = async (batch: MigrationBatch) => {
    setActiveBatch(batch);
    setIsLoadingRecords(true);
    try {
      const res = await fetch(`/api/historical-migration/batches/${batch.id}/records`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to load batch records');
      const data = await res.json();
      setActiveRecords(data);
    } catch (err: any) {
      toast.error(err.message || 'Error loading records');
      setActiveBatch(null);
    } finally {
      setIsLoadingRecords(false);
    }
  };

  const handleRecordUpdated = (updatedRecord: MigrationRecordItem) => {
    setActiveRecords(prev =>
      prev.map(r => (r.id === updatedRecord.id ? updatedRecord : r))
    );
    fetchBatches();
  };

  const handleImportBatch = async (batchId: string) => {
    const batch = batches.find(b => b.id === batchId) || activeBatch;
    if (!batch) return;

    const confirmImport = window.confirm(
      `Import all approved records in "${batch.name}"? This will create historical visits on their original dates.`
    );
    if (!confirmImport) return;

    try {
      const res = await fetch(`/api/historical-migration/batches/${batch.id}/import`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      const summary = await res.json();
      setImportSummary(summary);
      fetchBatches();
      if (activeBatch) {
        openWorkspace(activeBatch);
      }
    } catch (err: any) {
      toast.error(err.message || 'Import error');
    }
  };

  if (!isHeadDoctor) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-1">
          Historical record migration is strictly restricted to the Head Doctor for data integrity and duplicate verification.
        </p>
      </div>
    );
  }

  // Active Review Workspace View
  if (activeBatch && !isLoadingRecords) {
    return (
      <HistoricalReviewWorkspace
        batchId={activeBatch.id}
        batchName={activeBatch.name}
        records={activeRecords}
        onRecordUpdated={handleRecordUpdated}
        onClose={() => {
          setActiveBatch(null);
          fetchBatches();
        }}
        onImportClick={() => handleImportBatch(activeBatch.id)}
      />
    );
  }

  const totalBatches = batches.length;
  const totalPages = batches.reduce((acc, b) => acc + b.totalPages, 0);
  const totalApproved = batches.reduce((acc, b) => acc + b.approvedRecords, 0);
  const totalImported = batches.reduce((acc, b) => acc + b.importedRecords, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Historical Record Migration</h1>
            <p className="text-xs text-slate-500">
              Digitize handwritten clinical archives (Batches of up to 200 source pages/records)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchBatches} className="text-xs h-9">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 font-medium shadow-xs shrink-0"
          >
            <Upload className="w-4 h-4 mr-1.5" /> Upload Legacy Batch
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Batches</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalBatches}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Source Pages</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalPages}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Records</div>
          <div className="text-2xl font-bold text-teal-600 mt-1">{totalApproved}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Historical Visits Imported</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{totalImported}</div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Migration Batches</h2>
          <span className="text-xs text-slate-500">Max 200 source pages per batch</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading migration batches...</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No historical migration batches yet</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click &quot;Upload Legacy Batch&quot; above to upload scanned paper records or multi-page PDFs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">Batch Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3">Approved / Total</th>
                  <th className="px-6 py-3">Created Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map(batch => {
                  const progressPct = batch.totalPages > 0 ? Math.round((batch.processedRecords / batch.totalPages) * 100) : 0;
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {batch.name}
                        <div className="text-2xs text-slate-400 font-normal">#{batch.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-bold uppercase ${
                          batch.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                          batch.status === 'OCR_PROCESSING' ? 'bg-amber-100 text-amber-800' :
                          batch.status === 'IMPORTING' ? 'bg-blue-100 text-blue-800' :
                          batch.status === 'FAILED' ? 'bg-rose-100 text-rose-800' :
                          'bg-teal-100 text-teal-800'
                        }`}>
                          {batch.status === 'OCR_PROCESSING' && <Clock className="w-3 h-3 animate-spin" />}
                          {batch.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                          {batch.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 min-w-[140px]">
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-2xs text-slate-400 mt-1 block">
                          {batch.processedRecords} / {batch.totalPages} pages parsed ({progressPct}%)
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <strong>{batch.approvedRecords}</strong> / {batch.totalPages} approved
                        {batch.importedRecords > 0 && (
                          <div className="text-2xs text-emerald-600 font-medium">
                            {batch.importedRecords} imported
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWorkspace(batch)}
                          className="h-8 text-xs font-medium text-slate-700"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          {batch.status === 'COMPLETED' ? 'View Records' : 'Review / Resume'}
                        </Button>

                        {batch.approvedRecords > 0 && batch.status !== 'COMPLETED' && (
                          <Button
                            size="sm"
                            onClick={() => handleImportBatch(batch.id)}
                            className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <FileCheck className="w-3 h-3 mr-1" />
                            Import Approved
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <BatchUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => fetchBatches()}
      />

      {/* Summary Modal */}
      <BatchResultsSummaryModal
        isOpen={Boolean(importSummary)}
        onClose={() => setImportSummary(null)}
        summary={importSummary}
      />
    </div>
  );
};
