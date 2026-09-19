import React, { useState, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  UserCheck,
  UserPlus,
  Save
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'react-hot-toast';

export interface MigrationRecordItem {
  id: string;
  batchId: string;
  pageNumber: number;
  sourceFileKey: string;
  sourceFileName: string;
  status: 'PENDING_OCR' | 'NEEDS_REVIEW' | 'APPROVED' | 'SKIPPED' | 'IMPORTED' | 'FAILED';
  rawOcrText: string | null;
  proposedName: string | null;
  proposedPhone: string | null;
  proposedAge: number | null;
  proposedGender: string | null;
  proposedVisitDate: string | null;
  proposedReason: string | null;
  reviewedName: string | null;
  reviewedPhone: string | null;
  reviewedAge: number | null;
  reviewedGender: string | null;
  reviewedVisitDate: string | null;
  reviewedReason: string | null;
  duplicateStatus: 'UNIQUE' | 'EXACT_MATCH' | 'PHONE_CONFLICT' | 'POSSIBLE_DUPLICATE' | null;
  duplicateResolution: 'CREATE_NEW' | 'USE_EXISTING' | 'SKIP' | null;
  matchedPatientId: string | null;
  matchedPatient?: {
    id: string;
    name: string;
    phone: string | null;
    age: number | null;
    gender: string | null;
  } | null;
}

interface HistoricalReviewWorkspaceProps {
  batchId: string;
  batchName: string;
  records: MigrationRecordItem[];
  onRecordUpdated: (updatedRecord: MigrationRecordItem) => void;
  onClose: () => void;
  onImportClick: () => void;
}

export const HistoricalReviewWorkspace: React.FC<HistoricalReviewWorkspaceProps> = ({
  batchId: _batchId,
  batchName,
  records,
  onRecordUpdated,
  onClose,
  onImportClick
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const currentRecord = records[currentIndex];

  // Editable Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAge, setFormAge] = useState<string>('');
  const [formGender, setFormGender] = useState<string>('');
  const [formVisitDate, setFormVisitDate] = useState<string>('');
  const [formReason, setFormReason] = useState<string>('');
  const [resolution, setResolution] = useState<'CREATE_NEW' | 'USE_EXISTING' | 'SKIP'>('CREATE_NEW');

  useEffect(() => {
    if (!currentRecord) return;

    setFormName(currentRecord.reviewedName || currentRecord.proposedName || '');
    setFormPhone(currentRecord.reviewedPhone || currentRecord.proposedPhone || '');
    setFormAge(
      currentRecord.reviewedAge != null 
        ? String(currentRecord.reviewedAge) 
        : currentRecord.proposedAge != null 
          ? String(currentRecord.proposedAge) 
          : ''
    );
    setFormGender(currentRecord.reviewedGender || currentRecord.proposedGender || '');

    const rawDate = currentRecord.reviewedVisitDate || currentRecord.proposedVisitDate;
    if (rawDate) {
      setFormVisitDate(new Date(rawDate).toISOString().split('T')[0]);
    } else {
      setFormVisitDate('');
    }

    setFormReason(currentRecord.reviewedReason || currentRecord.proposedReason || '');
    setResolution(currentRecord.duplicateResolution || (currentRecord.duplicateStatus === 'EXACT_MATCH' ? 'USE_EXISTING' : 'CREATE_NEW'));
  }, [currentIndex, currentRecord]);

  if (!currentRecord) {
    return (
      <div className="p-12 text-center text-slate-500">
        No records available in this batch.
      </div>
    );
  }

  const handleZoomIn = () => setZoom(z => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.25));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const saveCurrentRecord = async (newStatus?: 'APPROVED' | 'SKIPPED' | 'NEEDS_REVIEW') => {
    // Validation before approval
    if (newStatus === 'APPROVED') {
      if (!formName.trim()) {
        toast.error('Patient Name is mandatory before approving.');
        return false;
      }
      if (!formVisitDate) {
        toast.error('Visit Date is mandatory before approving.');
        return false;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        reviewedName: formName.trim() || null,
        reviewedPhone: formPhone.trim() || null,
        reviewedAge: formAge ? parseInt(formAge, 10) : null,
        reviewedGender: formGender || null,
        reviewedVisitDate: formVisitDate ? new Date(formVisitDate).toISOString() : null,
        reviewedReason: formReason.trim() || null,
        duplicateResolution: resolution,
        status: newStatus || currentRecord.status
      };

      const res = await fetch(`/api/historical-migration/records/${currentRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update record');
      }

      const updated = await res.json();
      onRecordUpdated(updated);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Error saving record');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAndNext = async () => {
    const success = await saveCurrentRecord('APPROVED');
    if (success) {
      toast.success(`Record #${currentIndex + 1} Approved`);
      if (currentIndex < records.length - 1) {
        setCurrentIndex(i => i + 1);
        handleResetView();
      }
    }
  };

  const handleSkipRecord = async () => {
    const success = await saveCurrentRecord('SKIPPED');
    if (success) {
      toast('Record Skipped', { icon: '⏭️' });
      if (currentIndex < records.length - 1) {
        setCurrentIndex(i => i + 1);
        handleResetView();
      }
    }
  };

  const previewUrl = `/api/historical-migration/records/${currentRecord.id}/preview`;
  const isPdf = currentRecord.sourceFileKey.toLowerCase().endsWith('.pdf');

  const approvedCount = records.filter(r => r.status === 'APPROVED').length;

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] bg-slate-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            ← Back to Batches
          </Button>
          <div>
            <h1 className="text-sm font-bold text-slate-900">{batchName}</h1>
            <p className="text-xs text-slate-500">
              Record {currentIndex + 1} of {records.length} • Page {currentRecord.pageNumber}
            </p>
          </div>
        </div>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
            {approvedCount} / {records.length} Approved
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentIndex === 0}
              onClick={() => { setCurrentIndex(i => i - 1); handleResetView(); }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentIndex === records.length - 1}
              onClick={() => { setCurrentIndex(i => i + 1); handleResetView(); }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {approvedCount > 0 && (
            <Button
              onClick={onImportClick}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-medium shadow-xs"
            >
              Import {approvedCount} Approved Records
            </Button>
          )}
        </div>
      </div>

      {/* Main Split Console */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Interactive Document Canvas */}
        <div className="w-1/2 flex flex-col bg-slate-900 border-r border-slate-700 relative select-none">
          {/* Canvas Controls Overlay */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 text-white shadow-lg">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-800" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-800" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-800" onClick={handleRotate}>
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-200 hover:text-white hover:bg-slate-800" onClick={handleResetView}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <span className="text-2xs font-mono px-2 text-slate-400 border-l border-slate-700">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Document Display Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            {isPdf ? (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                title="Historical Document PDF"
                className="w-full h-full rounded-lg border border-slate-700 bg-white"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out'
                }}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Handwritten Scan"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-150"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`
                }}
              />
            )}
          </div>
        </div>

        {/* Right Side: Verification & 6-Field Editor */}
        <div className="w-1/2 flex flex-col bg-white overflow-y-auto">
          <div className="p-8 space-y-6 max-w-xl mx-auto w-full">
            {/* Record Status Pill */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Extracted 6 Fields (Head Doctor Verification)
              </span>
              <span className={`px-2.5 py-1 text-2xs font-bold rounded-full uppercase ${
                currentRecord.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                currentRecord.status === 'SKIPPED' ? 'bg-slate-100 text-slate-600' :
                currentRecord.status === 'IMPORTED' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {currentRecord.status.replace('_', ' ')}
              </span>
            </div>

            {/* Field 1: Patient Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                1. Patient Name <span className="text-rose-600">*</span>
              </label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="bg-slate-50 font-medium"
              />
            </div>

            {/* Field 2: Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. Phone Number <span className="text-slate-400 font-normal">(Leave blank if absent on card)</span>
              </label>
              <Input
                value={formPhone}
                onChange={e => setFormPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="bg-slate-50 font-mono"
              />
            </div>

            {/* Fields 3 & 4: Age and Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  3. Age <span className="text-slate-400 font-normal">(Clean null if missing)</span>
                </label>
                <Input
                  type="number"
                  value={formAge}
                  onChange={e => setFormAge(e.target.value)}
                  placeholder="e.g. 42"
                  min="1"
                  max="115"
                  className="bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  4. Gender <span className="text-slate-400 font-normal">(Clean null if missing)</span>
                </label>
                <select
                  value={formGender}
                  onChange={e => setFormGender(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="">— Unspecified / Missing —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Field 5: Visit Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                5. Historical Visit Date <span className="text-rose-600">*</span>
              </label>
              <Input
                type="date"
                value={formVisitDate}
                onChange={e => setFormVisitDate(e.target.value)}
                className="bg-slate-50 font-mono"
              />
              <p className="text-2xs text-slate-500 mt-1">
                Clinical visit date when patient was seen. Will not overwrite database import timestamp.
              </p>
            </div>

            {/* Field 6: Reason for Visit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                6. Reason for Visit <span className="text-slate-400 font-normal">(Clean null if missing)</span>
              </label>
              <Input
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                placeholder="e.g. Severe lower molar pain / routine checkup"
                className="bg-slate-50"
              />
            </div>

            {/* Duplicate Check Section */}
            <div className={`p-4 rounded-xl border ${
              currentRecord.duplicateStatus === 'EXACT_MATCH'
                ? 'bg-amber-50 border-amber-300'
                : currentRecord.duplicateStatus === 'PHONE_CONFLICT'
                  ? 'bg-rose-50 border-rose-300'
                  : currentRecord.duplicateStatus === 'POSSIBLE_DUPLICATE'
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-start gap-2.5 mb-3">
                {currentRecord.duplicateStatus === 'EXACT_MATCH' ? (
                  <UserCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                ) : currentRecord.duplicateStatus === 'PHONE_CONFLICT' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                ) : currentRecord.duplicateStatus === 'POSSIBLE_DUPLICATE' ? (
                  <FileQuestion className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                ) : (
                  <UserPlus className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-900 uppercase">
                    Duplicate Evaluation: {currentRecord.duplicateStatus || 'UNIQUE'}
                  </div>
                  {currentRecord.matchedPatient && (
                    <div className="text-xs text-slate-700 mt-0.5">
                      Matched: <strong>{currentRecord.matchedPatient.name}</strong> • Phone: {currentRecord.matchedPatient.phone || 'N/A'} • Age: {currentRecord.matchedPatient.age || '—'}
                    </div>
                  )}
                </div>
              </div>

              {/* Explicit Resolution Choice */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-xs">
                {currentRecord.matchedPatient && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="resolution"
                      value="USE_EXISTING"
                      checked={resolution === 'USE_EXISTING'}
                      onChange={() => setResolution('USE_EXISTING')}
                      className="text-teal-600"
                    />
                    <span className="font-semibold text-slate-800">Use Existing Patient</span>
                    <span className="text-slate-500">(Attach visit to {currentRecord.matchedPatient.name})</span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resolution"
                    value="CREATE_NEW"
                    checked={resolution === 'CREATE_NEW'}
                    onChange={() => setResolution('CREATE_NEW')}
                    className="text-teal-600"
                  />
                  <span className="font-semibold text-slate-800">Create New Patient</span>
                  <span className="text-slate-500">(Add fresh record upon import)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resolution"
                    value="SKIP"
                    checked={resolution === 'SKIP'}
                    onChange={() => setResolution('SKIP')}
                    className="text-teal-600"
                  />
                  <span className="font-semibold text-slate-800">Skip Record</span>
                  <span className="text-slate-500">(Exclude from clinical import)</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={handleSkipRecord}
                disabled={isSaving}
                className="text-slate-600 hover:text-rose-600 text-xs"
              >
                Skip Record
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => saveCurrentRecord()}
                  disabled={isSaving}
                  className="text-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> Save Draft
                </Button>

                <Button
                  onClick={handleApproveAndNext}
                  disabled={isSaving}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve & Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
