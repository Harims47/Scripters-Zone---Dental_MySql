import { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  Check,
  RefreshCw,
  Users
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';
import { api } from '../../lib/api';

interface ColumnMapping {
  name?: string;
  phone?: string;
  age?: string;
  dob?: string;
  gender?: string;
  address?: string;
  email?: string;
  preferredCommunicationChannel?: string;
}

interface InspectionResult {
  fileName: string;
  fileType: 'xlsx' | 'csv';
  totalRows: number;
  headers: string[];
  sampleRows: Record<string, string>[];
  suggestedMappings: ColumnMapping;
  unmappedClinicalColumns: string[];
}

interface ValidationSummary {
  totalRows: number;
  newCount: number;
  exactDuplicateCount: number;
  phoneConflictCount: number;
  invalidCount: number;
  sampleRows: {
    new: any[];
    exactDuplicates: any[];
    phoneConflicts: any[];
    invalid: any[];
  };
  invalidRowsList: {
    rowNumber: number;
    name?: string;
    phone?: string;
    errors: string[];
  }[];
}

interface ImportExecutionResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  details: {
    rowNumber: number;
    name: string;
    phone: string;
    status: 'IMPORTED' | 'SKIPPED' | 'FAILED';
    reason?: string;
  }[];
}

export function PatientImportModal({
  open,
  onOpenChange,
  onImportComplete
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'executing' | 'result'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [fileType, setFileType] = useState<'xlsx' | 'csv'>('xlsx');
  const [loading, setLoading] = useState(false);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping>({});
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [result, setResult] = useState<ImportExecutionResult | null>(null);
  const [selectedPreviewTab, setSelectedPreviewTab] = useState<'new' | 'duplicates' | 'conflicts' | 'invalid'>('new');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setFileBase64('');
    setInspection(null);
    setMappings({});
    setValidation(null);
    setResult(null);
    setLoading(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'csv') {
      toast.error('Unsupported file format. Please select an Excel (.xlsx) or CSV (.csv) file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (selected.size > 20 * 1024 * 1024) {
      toast.error('File exceeds maximum 20MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(selected);
    const parsedType = ext as 'xlsx' | 'csv';
    setFileType(parsedType);

    // Convert to base64
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        setFileBase64(base64);

        // Call inspect endpoint
        const inspectRes = await api.post<InspectionResult>('/api/patients/import/inspect', {
          fileBase64: base64,
          fileName: selected.name,
          fileType: parsedType
        });

        setInspection(inspectRes);
        setMappings(inspectRes.suggestedMappings || {});
        setStep('mapping');
      } catch (err: any) {
        toast.error(err.message || 'Failed to inspect file.');
        setFile(null);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setLoading(false);
      toast.error('Error reading file.');
    };
    reader.readAsDataURL(selected);
  };

  const handleValidate = async () => {
    if (!mappings.name) {
      toast.error('Please map the Patient Name column.');
      return;
    }
    if (!mappings.phone) {
      toast.error('Please map the Patient Phone column.');
      return;
    }
    if (!mappings.age && !mappings.dob) {
      toast.error('Please map either Age or Date of Birth (to calculate age).');
      return;
    }
    if (!mappings.gender) {
      toast.error('Please map the Gender column.');
      return;
    }

    setLoading(true);
    try {
      const summary = await api.post<ValidationSummary>('/api/patients/import/validate', {
        fileBase64,
        fileName: file?.name,
        fileType,
        mappings
      });
      setValidation(summary);
      setStep('preview');
    } catch (err: any) {
      toast.error(err.message || 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!validation || validation.newCount === 0) {
      toast.error('No new patients to import.');
      return;
    }

    setStep('executing');
    setLoading(true);

    try {
      const execResult = await api.post<ImportExecutionResult>('/api/patients/import/execute', {
        fileBase64,
        fileName: file?.name,
        fileType,
        mappings
      });
      setResult(execResult);
      setStep('result');
      toast.success(`Successfully imported ${execResult.importedCount} patients.`);
      onImportComplete();
    } catch (err: any) {
      toast.error(err.message || 'Import execution failed.');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const downloadErrorReport = () => {
    if (!result || !result.details) return;
    const skippedOrFailed = result.details.filter(d => d.status === 'SKIPPED' || d.status === 'FAILED');
    if (skippedOrFailed.length === 0) {
      toast.success('All records were successfully imported with zero errors!');
      return;
    }

    let csvContent = '\uFEFFRow,Name,Phone,Status,Reason\n';
    skippedOrFailed.forEach(d => {
      const name = `"${(d.name || '').replace(/"/g, '""')}"`;
      const phone = `"${(d.phone || '').replace(/"/g, '""')}"`;
      const status = `"${d.status}"`;
      const reason = `"${(d.reason || '').replace(/"/g, '""')}"`;
      csvContent += `${d.rowNumber},${name},${phone},${status},${reason}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `patient_import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!loading) {
        onOpenChange(val);
        if (!val) resetState();
      }
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-2xl">
        <DialogHeader className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              Import Existing Patients (v1)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Structured demographic master record migration from Excel (.xlsx) or CSV (.csv).
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
            <span className={`px-2 py-0.5 rounded-md ${step === 'upload' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100'}`}>1. Upload</span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-md ${step === 'mapping' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100'}`}>2. Map</span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-md ${step === 'preview' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100'}`}>3. Preview</span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded-md ${step === 'result' ? 'bg-teal-100 text-teal-800' : 'bg-slate-100'}`}>4. Done</span>
          </div>
        </DialogHeader>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-lg border-2 border-dashed border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
              >
                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4 shadow-xs">
                  {loading ? <RefreshCw className="w-6 h-6 animate-spin text-teal-600" /> : <Upload className="w-6 h-6" />}
                </div>
                <h3 className="text-base font-bold text-slate-800">Choose Excel or CSV file</h3>
                <p className="text-xs text-slate-500 mt-1 text-center">
                  Drag and drop or browse from your computer.<br />
                  Supported formats: <strong className="text-slate-700">.xlsx</strong> and <strong className="text-slate-700">.csv</strong> (Max 20MB).
                </p>
                <Button variant="outline" size="sm" className="mt-4 border-slate-300 pointer-events-none">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-teal-600" />
                  Select File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <div className="mt-6 max-w-lg w-full bg-slate-50 rounded-xl p-4 border border-slate-200/60 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" /> Production Safety Rules
                </div>
                <p>• Only Patient master demographic records are imported in v1.</p>
                <p>• Zero Visits, Prescriptions, Treatments, or Payments are created.</p>
                <p>• Existing patient records are never overwritten or altered.</p>
                <p>• .xls binary format is not supported; please save as .xlsx or .csv.</p>
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 'mapping' && inspection && (
            <div className="space-y-5">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Source File</span>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                    {inspection.fileName}
                    <span className="text-xs font-normal text-slate-500">({inspection.totalRows} detected data rows)</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="text-xs text-slate-600 hover:text-slate-900">
                  Change File
                </Button>
              </div>

              {/* Unmapped clinical notice */}
              {inspection.unmappedClinicalColumns.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200/70 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Notice: Unmapped Clinical Columns</span>
                    <p className="mt-0.5 text-amber-800/90 leading-relaxed">
                      The following legacy columns were detected and will <strong className="font-semibold">NOT</strong> be imported into clinical records:
                      {' '}
                      <span className="font-mono bg-amber-100/70 px-1 py-0.5 rounded text-[11px] font-semibold">
                        {inspection.unmappedClinicalColumns.join(', ')}
                      </span>.
                      DentalCore v1 imports demographic master records only.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-2">Map Columns to DentalCore Patient Fields</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Confirm or select the column in your file that corresponds to each DentalCore field.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Patient Name <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={mappings.name || ''}
                      onChange={(e) => setMappings({ ...mappings, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="">-- Select Column --</option>
                      {inspection.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Phone */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number (10 digits) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={mappings.phone || ''}
                      onChange={(e) => setMappings({ ...mappings, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="">-- Select Column --</option>
                      {inspection.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Age */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Age (Years)
                    </label>
                    <select
                      value={mappings.age || ''}
                      onChange={(e) => setMappings({ ...mappings, age: e.target.value, dob: e.target.value ? '' : mappings.dob })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="">-- Select Column (or use DOB below) --</option>
                      {inspection.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* DOB for Age */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-700 mb-0.5">
                      Date of Birth (Used to calculate Age)
                    </label>
                    <span className="text-[10px] text-slate-400 block mb-1">DOB calculates age; not stored directly</span>
                    <select
                      value={mappings.dob || ''}
                      onChange={(e) => setMappings({ ...mappings, dob: e.target.value, age: e.target.value ? '' : mappings.age })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="">-- Select Column (or use Age above) --</option>
                      {inspection.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Gender */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={mappings.gender || ''}
                      onChange={(e) => setMappings({ ...mappings, gender: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="">-- Select Column --</option>
                      {inspection.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Address */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Address (Optional)
                    </label>
                    <select
                      value={mappings.address || ''}
                      onChange={(e) => setMappings({ ...mappings, address: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="">-- None / Skip --</option>
                      {inspection.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Email */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address (Optional)
                    </label>
                    <select
                      value={mappings.email || ''}
                      onChange={(e) => setMappings({ ...mappings, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="">-- None / Skip --</option>
                      {inspection.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION */}
          {step === 'preview' && validation && (
            <div className="space-y-5">
              {/* Summary metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-emerald-700">{validation.newCount}</div>
                  <div className="text-xs font-semibold text-emerald-800 mt-0.5">New Patients</div>
                  <div className="text-[10px] text-emerald-600">Eligible to import</div>
                </div>

                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-slate-700">{validation.exactDuplicateCount}</div>
                  <div className="text-xs font-semibold text-slate-800 mt-0.5">Exact Duplicates</div>
                  <div className="text-[10px] text-slate-500">Will be skipped</div>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-amber-700">{validation.phoneConflictCount}</div>
                  <div className="text-xs font-semibold text-amber-800 mt-0.5">Phone Conflicts</div>
                  <div className="text-[10px] text-amber-600">Shared/Existing phone</div>
                </div>

                <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-rose-700">{validation.invalidCount}</div>
                  <div className="text-xs font-semibold text-rose-800 mt-0.5">Invalid Rows</div>
                  <div className="text-[10px] text-rose-600">Missing required data</div>
                </div>
              </div>

              {/* Duplicate & Conflict explanation alert */}
              {(validation.exactDuplicateCount > 0 || validation.phoneConflictCount > 0) && (
                <div className="bg-blue-50/70 border border-blue-200/60 p-3 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Additive-Only Safety:</span>
                    <span className="ml-1 text-blue-800">
                      DentalCore enforces unique phone numbers. To protect data integrity, duplicate and conflicting records are automatically skipped and will not overwrite existing patients.
                    </span>
                  </div>
                </div>
              )}

              {/* Tab navigation */}
              <div className="flex border-b border-slate-200 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewTab('new')}
                  className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
                    selectedPreviewTab === 'new'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  New Patients Sample ({validation.sampleRows.new.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewTab('invalid')}
                  className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
                    selectedPreviewTab === 'invalid'
                      ? 'border-rose-600 text-rose-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Invalid Rows ({validation.invalidRowsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewTab('conflicts')}
                  className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all ${
                    selectedPreviewTab === 'conflicts'
                      ? 'border-amber-600 text-amber-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Conflicts & Duplicates ({validation.exactDuplicateCount + validation.phoneConflictCount})
                </button>
              </div>

              {/* Tab contents */}
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                {selectedPreviewTab === 'new' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Age / Gender</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validation.sampleRows.new.length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400">No new patients found.</td></tr>
                      ) : (
                        validation.sampleRows.new.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-2.5 font-mono text-slate-400">{r.rowNumber}</td>
                            <td className="p-2.5 font-medium text-slate-900">{r.data?.name}</td>
                            <td className="p-2.5 font-mono text-slate-700">{r.data?.phone}</td>
                            <td className="p-2.5 text-slate-600">{r.data?.age} Yrs • {r.data?.gender}</td>
                            <td className="p-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">NEW</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {selectedPreviewTab === 'invalid' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-rose-50/70 text-rose-800 font-semibold border-b border-rose-200">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Name / Phone</th>
                        <th className="p-2.5">Validation Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validation.invalidRowsList.length === 0 ? (
                        <tr><td colSpan={3} className="p-4 text-center text-slate-400">Zero invalid rows!</td></tr>
                      ) : (
                        validation.invalidRowsList.map((r, i) => (
                          <tr key={i} className="hover:bg-rose-50/20">
                            <td className="p-2.5 font-mono text-rose-700 font-bold">{r.rowNumber}</td>
                            <td className="p-2.5 text-slate-700">
                              <span className="font-semibold">{r.name || 'Empty Name'}</span>
                              <span className="text-slate-400 block text-[11px] font-mono">{r.phone || 'Empty Phone'}</span>
                            </td>
                            <td className="p-2.5 text-rose-700 text-xs">
                              {r.errors.join('; ')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {selectedPreviewTab === 'conflicts' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-50 text-amber-800 font-semibold border-b border-amber-200">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...validation.sampleRows.exactDuplicates, ...validation.sampleRows.phoneConflicts].length === 0 ? (
                        <tr><td colSpan={3} className="p-4 text-center text-slate-400">No duplicates or conflicts detected.</td></tr>
                      ) : (
                        [...validation.sampleRows.exactDuplicates, ...validation.sampleRows.phoneConflicts].map((r, i) => (
                          <tr key={i} className="hover:bg-amber-50/30">
                            <td className="p-2.5 font-mono text-slate-500">{r.rowNumber}</td>
                            <td className="p-2.5 font-bold">
                              {r.classification === 'EXACT_DUPLICATE' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700">EXACT DUPLICATE</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900">PHONE CONFLICT</span>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-600">{r.errors[0]}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* STEP: EXECUTING */}
          {step === 'executing' && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <RefreshCw className="w-10 h-10 animate-spin text-teal-600" />
              <h3 className="text-base font-bold text-slate-800">Importing Patients...</h3>
              <p className="text-xs text-slate-500 max-w-sm text-center">
                Inserting records in safe, verified batches. Please keep this dialog open.
              </p>
            </div>
          )}

          {/* STEP: RESULT */}
          {step === 'result' && result && (
            <div className="space-y-6 py-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="text-lg font-black text-emerald-900">Import Completed Successfully</h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Master patient records have been added to DentalCore.
                </p>

                <div className="grid grid-cols-3 gap-3 mt-5 max-w-md mx-auto">
                  <div className="bg-white p-3 rounded-xl border border-emerald-200/60 shadow-2xs">
                    <div className="text-xl font-bold text-emerald-700">{result.importedCount}</div>
                    <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Imported</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-xl font-bold text-slate-700">{result.skippedCount}</div>
                    <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Skipped</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs">
                    <div className="text-xl font-bold text-rose-700">{result.failedCount}</div>
                    <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Failed</div>
                  </div>
                </div>
              </div>

              {(result.skippedCount > 0 || result.failedCount > 0) && (
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-600">
                    <strong className="text-slate-800 font-semibold">{result.skippedCount + result.failedCount} rows</strong> were skipped or failed validation.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadErrorReport}
                    className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-white"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    Download Skipped/Error Report (CSV)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <div>
            {step === 'mapping' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')} disabled={loading}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Upload
              </Button>
            )}
            {step === 'preview' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('mapping')} disabled={loading}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Mapping
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
            )}

            {step === 'mapping' && (
              <Button
                size="sm"
                onClick={handleValidate}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white shadow-xs font-semibold"
              >
                {loading ? 'Validating...' : 'Validate & Preview'}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            )}

            {step === 'preview' && (
              <>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecute}
                  disabled={loading || !validation || validation.newCount === 0}
                  className="bg-teal-600 hover:bg-teal-700 text-white shadow-xs font-semibold px-4"
                >
                  Confirm Import ({validation?.newCount || 0} Patients)
                </Button>
              </>
            )}

            {step === 'result' && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  resetState();
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
