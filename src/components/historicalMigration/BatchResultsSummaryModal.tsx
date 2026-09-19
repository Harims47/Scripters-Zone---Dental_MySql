import React from 'react';
import { CheckCircle2, UserPlus, Calendar, AlertCircle, X } from 'lucide-react';
import { Button } from '../ui/button';

interface BatchResultsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: {
    batchId: string;
    totalApproved: number;
    patientsCreated: number;
    visitsImported: number;
    recordsSkipped: number;
    errors: Array<{ recordId: string; error: string }>;
  } | null;
}

export const BatchResultsSummaryModal: React.FC<BatchResultsSummaryModalProps> = ({
  isOpen,
  onClose,
  summary
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Historical Import Complete</h2>
              <p className="text-xs text-slate-500">
                Batch #{summary.batchId.slice(0, 8)} successfully imported
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Metrics */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{summary.visitsImported}</div>
                <div className="text-xs text-slate-500">Historical Visits Linked</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{summary.patientsCreated}</div>
                <div className="text-xs text-slate-500">New Patients Created</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between">
            <span>Approved records processed:</span>
            <span className="font-semibold text-slate-900">{summary.totalApproved}</span>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 flex justify-between">
            <span>Skipped records:</span>
            <span className="font-semibold text-slate-900">{summary.recordsSkipped}</span>
          </div>

          {summary.errors && summary.errors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                {summary.errors.length} record(s) failed import:
              </div>
              <ul className="list-disc pl-5 space-y-0.5 max-h-24 overflow-y-auto text-2xs">
                {summary.errors.map((e, idx) => (
                  <li key={idx}>{e.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-2xs text-slate-400 bg-slate-100/60 p-2.5 rounded-lg border border-slate-200/50">
            Note: Historical visits reflect their original clinical dates. System creation timestamps (`createdAt`) and immutable financial/operational audit logs were preserved without distortion.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <Button onClick={onClose} className="bg-slate-900 hover:bg-slate-800 text-white text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
