import { useState, useEffect, useMemo } from 'react';
import { useClinicContext } from '../context/ClinicContext';
import { api, API_BASE_URL } from '../lib/api';
import { DataTable } from '../components/data-table/data-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetScrollArea,
  SheetFooter
} from '../components/ui/sheet';
import {
  FileText,
  Plus,
  Printer,
  Search,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../components/ui/dialog';
import toast from 'react-hot-toast';

export interface ReimbursementDoc {
  id: string;
  documentNumber: string;
  patientId: string;
  doctorId: string | null;
  visitId: string | null;
  documentDate: string;
  subject: string;
  content: string;
  treatmentDescription: string | null;
  amount: number | null;
  patientNameSnapshot: string;
  patientAgeSnapshot: number | null;
  patientGenderSnapshot: string | null;
  patientPhoneSnapshot: string | null;
  doctorNameSnapshot: string | null;
  doctorRegNoSnapshot: string | null;
  clinicNameSnapshot: string | null;
  clinicAddressSnapshot: string | null;
  clinicPhoneSnapshot: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  patient?: {
    id: string;
    name: string;
    phone: string | null;
    age: number | null;
    gender: string | null;
  };
}

export const sanitizeReimbursementText = (rawContent: string): string => {
  if (!rawContent) return '';
  let text = rawContent.trim();
  text = text.replace(/^(to\s+whom(soever)?\s+it\s+may\s+concern[:,]?|dear\s+sir\s*\/\s*madam[:,]?)\s*/i, '');
  text = text.replace(/\n\s*(regards|warm\s+regards|with\s+regards|sincerely|yours\s+sincerely|yours\s+faithfully)[,\s]*(\n\s*(dr\.?[^\n]*|doctor))?(\n\s*[^\n]*clinic[^\n]*)?\s*/i, '\n');
  return text.trim();
};

export function ReimbursementPage() {
  const { patients } = useClinicContext();

  // Clinic profile from localStorage or standard default
  const clinicProfile = useMemo(() => {
    try {
      const saved = localStorage.getItem('dentalcore_clinic_profile');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return {
      name: 'Rafi Dental Clinic',
      address: '37, Dr.Venkatraman St, Gobichettipalayam, Tamil Nadu 638452',
      phone: '094430 23648'
    };
  }, []);

  // List State
  const [documents, setDocuments] = useState<ReimbursementDoc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Drawer (Create) State
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [documentDate, setDocumentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [subject, setSubject] = useState<string>('Reimbursement of Dental Treatment Expenses');
  const [treatmentDescription, setTreatmentDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [content, setContent] = useState<string>('');

  // View Drawer State
  const [viewingDoc, setViewingDoc] = useState<ReimbursementDoc | null>(null);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState<boolean>(false);

  // Edit Drawer State
  const [editingDoc, setEditingDoc] = useState<ReimbursementDoc | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState<boolean>(false);
  const [editDate, setEditDate] = useState<string>('');
  const [editSubject, setEditSubject] = useState<string>('');
  const [editTreatmentDescription, setEditTreatmentDescription] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Delete Confirmation Dialog State
  const [deletingDoc, setDeletingDoc] = useState<ReimbursementDoc | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch Reimbursement documents
  const fetchDocuments = async (searchQuery = search, pageNum = page) => {
    try {
      setLoading(true);
      const res = await api.get<{
        success: boolean;
        data: ReimbursementDoc[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/reimbursements?page=${pageNum}&limit=10&search=${encodeURIComponent(searchQuery)}`);

      setDocuments(res.data || []);
      setTotalRecords(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reimbursement documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(search, page);
  }, [page]);

  // Handle Search submit / debounce
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    fetchDocuments(val, 1);
  };

  // Selected patient details
  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // Filtered patients for the picker
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 10);
    const q = patientSearch.toLowerCase();
    return patients
      .filter(p => p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q)))
      .slice(0, 10);
  }, [patients, patientSearch]);

  // Open Drawer and initialize starting template
  const handleOpenCreateDrawer = () => {
    const today = new Date().toISOString().split('T')[0];

    setSelectedPatientId('');
    setPatientSearch('');
    setDocumentDate(today);
    setSubject('Reimbursement of Dental Treatment Expenses');
    setTreatmentDescription('');
    setAmount('');
    setContent(
      `This is to certify that the above-mentioned patient has received dental treatment at our clinic.\n\n` +
      `The treatment and related expenses are provided for the purpose of reimbursement.\n\n` +
      `This document is issued at the request of the patient for official claim purposes.`
    );
    setIsDrawerOpen(true);
  };

  // Submit and Create Document
  const handleCreateDocument = async (autoPrint = false): Promise<ReimbursementDoc | null> => {
    if (!selectedPatientId) {
      toast.error('Please select an existing patient');
      return null;
    }
    if (!documentDate) {
      toast.error('Document date is required');
      return null;
    }
    if (!subject.trim()) {
      toast.error('Subject is required');
      return null;
    }
    if (!content.trim()) {
      toast.error('Letter content is required');
      return null;
    }

    const numericAmount = amount.trim() ? parseFloat(amount) : null;
    if (numericAmount !== null && (isNaN(numericAmount) || numericAmount < 0)) {
      toast.error('Please enter a valid non-negative amount');
      return null;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        patientId: selectedPatientId,
        documentDate,
        subject: subject.trim(),
        content: content.trim(),
        treatmentDescription: treatmentDescription.trim() || null,
        amount: numericAmount,
        clinicName: clinicProfile.name,
        clinicAddress: clinicProfile.address,
        clinicPhone: clinicProfile.phone
      };

      const res = await api.post<{ success: boolean; data: ReimbursementDoc }>(
        '/api/reimbursements',
        payload
      );

      const created = res.data;
      toast.success(`Reimbursement document ${created.documentNumber} created!`);
      setIsDrawerOpen(false);
      fetchDocuments(search, 1);

      if (autoPrint) {
        handlePrintDocument(created);
      }

      return created;
    } catch (err: any) {
      toast.error(err.message || 'Failed to create reimbursement document');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Print workflow: Open PDF stream directly in a new window/tab for native printing
  const handlePrintDocument = async (doc: ReimbursementDoc) => {
    try {
      const url = `${API_BASE_URL}/api/reimbursements/${doc.id}/pdf`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch PDF for printing');
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not print document');
    }
  };

  // Open View Drawer
  const handleOpenViewDrawer = (doc: ReimbursementDoc) => {
    setViewingDoc(doc);
    setIsViewDrawerOpen(true);
  };

  // Open Edit Drawer
  const handleOpenEditDrawer = (doc: ReimbursementDoc) => {
    setEditingDoc(doc);
    setEditDate(doc.documentDate || '');
    setEditSubject(doc.subject || 'Reimbursement of Dental Treatment Expenses');
    setEditTreatmentDescription(doc.treatmentDescription || '');
    setEditAmount(doc.amount !== null && doc.amount !== undefined ? String(doc.amount) : '');
    setEditContent(doc.content || '');
    setIsEditDrawerOpen(true);
  };

  // Submit and Update Document
  const handleUpdateDocument = async (autoPrint = false) => {
    if (!editingDoc) return;
    if (!editDate) {
      toast.error('Document date is required');
      return;
    }
    if (!editSubject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!editContent.trim()) {
      toast.error('Letter content is required');
      return;
    }

    const numericAmount = editAmount.trim() ? parseFloat(editAmount) : null;
    if (numericAmount !== null && (isNaN(numericAmount) || numericAmount < 0)) {
      toast.error('Please enter a valid non-negative amount');
      return;
    }

    try {
      setIsUpdating(true);
      const payload = {
        documentDate: editDate,
        subject: editSubject.trim(),
        content: editContent.trim(),
        treatmentDescription: editTreatmentDescription.trim() || null,
        amount: numericAmount,
        clinicName: clinicProfile.name,
        clinicAddress: clinicProfile.address,
        clinicPhone: clinicProfile.phone
      };

      const res = await api.put<{ success: boolean; data: ReimbursementDoc }>(
        `/api/reimbursements/${editingDoc.id}`,
        payload
      );

      const updated = res.data;
      toast.success(`Reimbursement document ${updated.documentNumber} updated!`);
      setIsEditDrawerOpen(false);

      setDocuments(prev => prev.map(d => (d.id === updated.id ? updated : d)));
      if (viewingDoc?.id === updated.id) {
        setViewingDoc(updated);
      }

      if (autoPrint) {
        handlePrintDocument(updated);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update reimbursement document');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDeleteModal = (doc: ReimbursementDoc) => {
    setDeletingDoc(doc);
    setIsDeleteDialogOpen(true);
  };

  // Confirm and Execute Delete
  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    try {
      setIsDeleting(true);
      await api.delete(`/api/reimbursements/${deletingDoc.id}`);
      toast.success(`Document ${deletingDoc.documentNumber} deleted successfully`);
      setIsDeleteDialogOpen(false);

      if (viewingDoc?.id === deletingDoc.id) {
        setIsViewDrawerOpen(false);
        setViewingDoc(null);
      }
      setDeletingDoc(null);

      fetchDocuments(search, page);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete reimbursement document');
    } finally {
      setIsDeleting(false);
    }
  };

  // Table Columns
  const columns = useMemo<ColumnDef<ReimbursementDoc>[]>(() => [
    {
      accessorKey: 'documentNumber',
      header: 'Document No.',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <span className="font-mono font-bold text-slate-800 text-xs">
            {row.original.documentNumber}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'patientNameSnapshot',
      header: 'Patient',
      cell: ({ row }) => {
        const p = row.original;
        const sub = [
          p.patientAgeSnapshot ? `${p.patientAgeSnapshot} yrs` : '',
          p.patientGenderSnapshot || '',
          p.patientPhoneSnapshot || ''
        ].filter(Boolean).join(' • ');

        return (
          <div>
            <div className="font-semibold text-slate-900">{p.patientNameSnapshot}</div>
            {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
          </div>
        );
      }
    },
    {
      accessorKey: 'documentDate',
      header: 'Document Date',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-slate-700">
          {row.original.documentDate}
        </span>
      )
    },
    {
      accessorKey: 'doctorNameSnapshot',
      header: 'Doctor',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-slate-700">
          {row.original.doctorNameSnapshot || 'Doctor'}
        </span>
      )
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-50 text-xs font-semibold px-2.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
          {row.original.status || 'Issued'}
        </Badge>
      )
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
              onClick={() => handleOpenViewDrawer(doc)}
              title="View Details"
              aria-label="View Details"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
              onClick={() => handleOpenEditDrawer(doc)}
              title="Edit Document"
              aria-label="Edit Document"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
              onClick={() => handlePrintDocument(doc)}
              title="Print Document"
              aria-label="Print Document"
            >
              <Printer className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              onClick={() => handleOpenDeleteModal(doc)}
              title="Delete Document"
              aria-label="Delete Document"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      }
    }
  ], []);

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col h-screen overflow-hidden">
      {/* Page Header */}
      <div className="h-auto py-3.5 shrink-0 px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/70 backdrop-blur-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reimbursement</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create and print patient reimbursement documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleOpenCreateDrawer}
            className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm font-medium text-xs sm:text-sm h-9 px-3.5 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Reimbursement
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by doc no, patient name, phone..."
              className="pl-9 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Total: <span className="text-slate-800 font-bold">{totalRecords}</span> document{totalRecords !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
              <p className="text-xs font-medium">Loading reimbursement records...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">No Reimbursement Documents Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                {search ? 'No documents match your search query.' : 'No reimbursement documents have been generated yet. Create your first document using the button above.'}
              </p>
              {!search && (
                <Button
                  size="sm"
                  onClick={handleOpenCreateDrawer}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Create First Reimbursement
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 sm:p-4">
              <DataTable
                columns={columns}
                data={documents}
                totalRecords={totalRecords}
              />
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>Page {page} of {totalPages}</div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-7 text-xs"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="h-7 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE REIMBURSEMENT DRAWER */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-slate-50 h-full">
          <SheetHeader className="bg-white pl-6 pr-16 py-5 border-b border-slate-200/80 shrink-0 text-left">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-600 mb-1">
              <FileText className="w-4 h-4" />
              <span>Doctor Workflow</span>
            </div>
            <SheetTitle className="text-lg font-bold text-slate-900">
              Create Reimbursement
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500">
              Draft and issue an official reimbursement letter for dental expenses.
            </SheetDescription>
          </SheetHeader>

          <SheetScrollArea className="flex-1 p-6 space-y-5">
            {/* FIELD 1: PATIENT SEARCH & SELECT */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  Patient <span className="text-rose-500">*</span>
                </Label>
                {selectedPatient && (
                  <button
                    type="button"
                    onClick={() => setSelectedPatientId('')}
                    className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    Change Patient
                  </button>
                )}
              </div>

              {!selectedPatient ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder="Type patient name or phone to search..."
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No matching patients found.
                      </div>
                    ) : (
                      filteredPatients.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatientId(p.id);
                            setPatientSearch('');
                          }}
                          className="p-2.5 text-xs hover:bg-teal-50/60 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{p.name}</span>
                            <span className="text-slate-400 ml-2">({p.phone || 'No phone'})</span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-400">
                            {p.age ? `${p.age}y` : ''} {p.gender || ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Compact Patient Summary Badge */
                <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center shrink-0 text-sm">
                    {selectedPatient.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-teal-950 text-sm">{selectedPatient.name}</div>
                    <div className="text-xs text-teal-700 flex flex-wrap items-center gap-2 mt-0.5">
                      {selectedPatient.age && <span>{selectedPatient.age} Yrs</span>}
                      {selectedPatient.age && selectedPatient.gender && <span>•</span>}
                      {selectedPatient.gender && <span>{selectedPatient.gender}</span>}
                      {selectedPatient.phone && <span>•</span>}
                      {selectedPatient.phone && <span>{selectedPatient.phone}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* FIELD 2 & 3: DOCUMENT DATE & SUBJECT */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
              <div>
                <Label htmlFor="docDate" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  Document Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="docDate"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="h-9 text-xs mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="docSubject" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  Subject <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="docSubject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Reimbursement of Dental Treatment Expenses"
                  className="h-9 text-xs mt-1.5 font-medium"
                />
              </div>
            </div>

            {/* FIELD 4 & 5: OPTIONAL TREATMENT DETAILS & AMOUNT */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">
                  Treatment / Expense Details <span className="text-slate-400 font-normal">(Optional)</span>
                </Label>
              </div>
              <Textarea
                rows={4}
                value={treatmentDescription}
                onChange={(e) => setTreatmentDescription(e.target.value)}
                placeholder="e.g. Dental scaling, root canal treatment, and prescribed medications."
                className="text-xs resize-y"
              />

              <div>
                <Label htmlFor="claimAmount" className="text-xs font-bold text-slate-700">
                  Amount in ₹ <span className="text-slate-400 font-normal">(Optional)</span>
                </Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                  <Input
                    id="claimAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7 h-9 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* FIELD 6: LETTER CONTENT */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <Label htmlFor="letterContent" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                Letter Content <span className="text-rose-500">*</span>
              </Label>
              <p className="text-[11px] text-slate-400">
                You may edit or customize the statement wording below before generating the letter.
              </p>
              <Textarea
                id="letterContent"
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="text-xs font-mono resize-y leading-relaxed"
              />
            </div>
          </SheetScrollArea>

          {/* Drawer Actions */}
          <SheetFooter className="bg-white px-6 py-4 border-t border-slate-200/80 shrink-0 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setIsDrawerOpen(false)}
              className="text-xs font-medium"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting || !selectedPatientId}
                onClick={() => handleCreateDocument(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Printer className="w-3.5 h-3.5 mr-1" />
                )}
                Print Document
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* VIEW REIMBURSEMENT DRAWER */}
      <Sheet open={isViewDrawerOpen} onOpenChange={setIsViewDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col bg-slate-50">
          <SheetHeader className="bg-white pl-6 pr-16 py-4 border-b border-slate-200/80 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-slate-900">
                    Reimbursement Details
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-500">
                    Official clinic reimbursement letter details
                  </SheetDescription>
                </div>
              </div>
              {viewingDoc && (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                    {viewingDoc.documentNumber}
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-semibold px-2 py-0.5">
                    {viewingDoc.status || 'Issued'}
                  </Badge>
                </div>
              )}
            </div>
          </SheetHeader>

          {viewingDoc && (
            <SheetScrollArea className="flex-1 p-6 space-y-4">
              {/* Patient Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-[11px] font-bold text-teal-700 tracking-wider uppercase mb-1">
                  Patient Information
                </div>
                <div className="text-base font-bold text-slate-900">
                  {viewingDoc.patientNameSnapshot}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                  {viewingDoc.patientAgeSnapshot && <span>{viewingDoc.patientAgeSnapshot} Yrs</span>}
                  {viewingDoc.patientGenderSnapshot && <span>• {viewingDoc.patientGenderSnapshot}</span>}
                  {viewingDoc.patientPhoneSnapshot && <span>• Phone: {viewingDoc.patientPhoneSnapshot}</span>}
                </div>
              </div>

              {/* Document Meta Card */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Document Date</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">{viewingDoc.documentDate}</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Issued By</div>
                  <div className="text-xs font-bold text-slate-800 mt-1">{viewingDoc.doctorNameSnapshot || 'Doctor'}</div>
                  <div className="text-[11px] text-slate-500">Registration no : {viewingDoc.doctorRegNoSnapshot || '1305'}</div>
                </div>
              </div>

              {/* Subject */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Subject</div>
                <div className="text-xs font-bold text-slate-800">{viewingDoc.subject}</div>
              </div>

              {/* Treatment & Amount */}
              {(viewingDoc.treatmentDescription || viewingDoc.amount !== null) && (
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-teal-700 tracking-wider uppercase mb-1">
                      Treatment / Expense Particulars
                    </div>
                    <div className="text-xs text-slate-800 font-medium whitespace-pre-wrap">
                      {viewingDoc.treatmentDescription || 'None recorded'}
                    </div>
                  </div>
                  {viewingDoc.amount !== null && viewingDoc.amount !== undefined && (
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold text-teal-700 uppercase mb-1">
                        Claim Amount
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        ₹ {Number(viewingDoc.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Letter Statement */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
                <div className="text-[11px] font-bold text-slate-700 uppercase">
                  Official Statement Content
                </div>
                <div className="bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/60 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {viewingDoc.content}
                </div>
              </div>

              {/* Clinic Letterhead Info */}
              <div className="bg-teal-50/50 p-3.5 rounded-xl border border-teal-100 text-[11px] text-teal-900 space-y-0.5">
                <div className="font-bold">{viewingDoc.clinicNameSnapshot || clinicProfile.name}</div>
                <div className="text-teal-700">{viewingDoc.clinicAddressSnapshot || clinicProfile.address}</div>
                <div className="text-teal-700">Phone: {viewingDoc.clinicPhoneSnapshot || clinicProfile.phone}</div>
              </div>
            </SheetScrollArea>
          )}

          {/* Footer */}
          <SheetFooter className="bg-white px-6 py-4 border-t border-slate-200/80 shrink-0 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsViewDrawerOpen(false)}
              className="text-xs font-medium"
            >
              Close
            </Button>

            {viewingDoc && (
              <Button
                type="button"
                size="sm"
                onClick={() => handlePrintDocument(viewingDoc)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Document
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* EDIT REIMBURSEMENT DRAWER */}
      <Sheet open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col bg-slate-50">
          <SheetHeader className="bg-white pl-6 pr-16 py-4 border-b border-slate-200/80 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold text-slate-900">
                    Edit Reimbursement Document
                  </SheetTitle>
                  <SheetDescription className="text-xs text-slate-500">
                    Modify document details and statement wording
                  </SheetDescription>
                </div>
              </div>
              {editingDoc && (
                <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                  {editingDoc.documentNumber}
                </span>
              )}
            </div>
          </SheetHeader>

          {editingDoc && (
            <SheetScrollArea className="flex-1 p-6 space-y-4">
              {/* Patient Badge (Readonly) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
                <Label className="text-xs font-bold text-slate-700">Patient</Label>
                <div className="mt-1.5 p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      {editingDoc.patientNameSnapshot}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {editingDoc.patientAgeSnapshot && `${editingDoc.patientAgeSnapshot} Yrs • `}
                      {editingDoc.patientGenderSnapshot && `${editingDoc.patientGenderSnapshot} • `}
                      Phone: {editingDoc.patientPhoneSnapshot || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Date & Subject */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                <div>
                  <Label htmlFor="editDocDate" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    Document Date <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="editDocDate"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-9 text-xs mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="editDocSubject" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    Subject <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="editDocSubject"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Reimbursement of Dental Treatment Expenses"
                    className="h-9 text-xs mt-1.5 font-medium"
                  />
                </div>
              </div>

              {/* Treatment Details & Amount */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                <Label className="text-xs font-bold text-slate-700">
                  Treatment / Expense Details <span className="text-slate-400 font-normal">(Optional)</span>
                </Label>
                <Textarea
                  rows={4}
                  value={editTreatmentDescription}
                  onChange={(e) => setEditTreatmentDescription(e.target.value)}
                  placeholder="e.g. Dental scaling, root canal treatment, and prescribed medications."
                  className="text-xs resize-y"
                />

                <div>
                  <Label htmlFor="editClaimAmount" className="text-xs font-bold text-slate-700">
                    Amount in ₹ <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <Input
                      id="editClaimAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-7 h-9 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Letter Content */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
                <Label htmlFor="editLetterContent" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  Letter Content <span className="text-rose-500">*</span>
                </Label>
                <p className="text-[11px] text-slate-400">
                  Edit or customize the official statement wording below.
                </p>
                <Textarea
                  id="editLetterContent"
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="text-xs font-mono resize-y leading-relaxed"
                />
              </div>
            </SheetScrollArea>
          )}

          {/* Drawer Actions */}
          <SheetFooter className="bg-white px-6 py-4 border-t border-slate-200/80 shrink-0 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdating}
              onClick={() => setIsEditDrawerOpen(false)}
              className="text-xs font-medium"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={() => handleUpdateDocument(true)}
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Save & Print
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isUpdating}
                onClick={() => handleUpdateDocument(false)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                )}
                Save Changes
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Delete Reimbursement Document
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Are you sure you want to permanently delete document{' '}
              <span className="font-mono font-bold text-slate-800">{deletingDoc?.documentNumber}</span>{' '}
              for patient <span className="font-bold text-slate-800">{deletingDoc?.patientNameSnapshot}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteDialogOpen(false)}
              className="text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1" />
              )}
              Delete Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
