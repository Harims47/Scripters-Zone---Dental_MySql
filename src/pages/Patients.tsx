import { useState, useEffect, useCallback } from 'react';
import { UserPlus, AlertCircle, Calendar, Camera, Eye, Play, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DataTable } from '../components/data-table/data-table';
import { DataTableToolbar } from '../components/data-table/data-table-toolbar';
import { DataTableEmpty } from '../components/data-table/data-table';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Sheet, SheetContent, SheetScrollArea, SheetTitle } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  PatientProfileHeader,
  DrawerSection,
  DrawerFooterActions,
  ReadOnlyField
} from '../components/ui/drawer-patterns';
import { PatientVisitHistory } from '../components/consultation/consultation-components';
import { CameraCapture } from '../components/ui/camera-capture';
import { HistoricalVisitDetails } from '../components/history/HistoricalVisitDetails';
import { PatientCompleteHistory } from '../components/history/PatientCompleteHistory';
import { TreatmentPlanUI } from '../components/consultation/TreatmentPlanUI';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import type { Patient, PaginationMeta, PaginatedResponse } from '../types/domain';
import { useClinicContext } from '../context/ClinicContext';
import { useAuth } from '../context/AuthContext';
import { PatientImportModal } from '../components/patients/PatientImportModal';
import { api } from '../lib/api';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);
export function PatientsPage() {
  const { currentUser } = useAuth();
  const { visits, staff, addPatient, updatePatient, startVisit, updateVisit, normalizePhone } = useClinicContext();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ currentPage: 1, pageSize: 10, totalRecords: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, filterGender]);

  const fetchPatients = useCallback(async (page: number, limit: number, query: string, gender: string) => {
    setIsLoading(true);
    try {
      const genderQuery = gender && gender !== 'all' ? `&gender=${encodeURIComponent(gender)}` : '';
      const res = await api.get<PaginatedResponse<Patient>>(`/api/patients?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}${genderQuery}`);
      const payload = res as any;
      if (payload.data && payload.meta) {
        setPatients(payload.data);
        setMeta(payload.meta);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterGender);
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, filterGender, fetchPatients]);
  
  // Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | 'startVisit'>('view');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [historicalVisitId, setHistoricalVisitId] = useState<string | null>(null);
  const [historyModalPatient, setHistoryModalPatient] = useState<Patient | null>(null);

  // Form states
  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    photoUrl: '',
    address: '',
    email: '',
    preferredCommunicationChannel: 'AUTO' as 'AUTO' | 'WHATSAPP' | 'SMS' | 'EMAIL'
  });
  const [visitDoctor, setVisitDoctor] = useState('');
  const [activeVisitWarning, setActiveVisitWarning] = useState(false);
  const [visitReason, setVisitReason] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const doctors = (staff || []).filter((s: any) => ['Head Doctor', 'Duty Doctor'].includes(s.role));

  const hasActiveVisit = (patientId: string) => {
    return visits.some(v => v.patientId === patientId && !['COMPLETED', 'CANCELLED'].includes(v.status));
  }

  const getActiveVisit = (patientId: string) => {
    return visits.find(v => v.patientId === patientId && !['COMPLETED', 'CANCELLED'].includes(v.status));
  }



  const handleSaveNewPatient = async () => {
    if (!newPatient.name || !newPatient.phone || !newPatient.age || !newPatient.gender) {
      toast.error('Please fill out all mandatory fields.');
      return;
    }
    if (newPatient.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits.');
      return;
    }

    // Duplicate Protection
    const normPhone = normalizePhone(newPatient.phone);
    const existing = patients.find(p => p.phone && normalizePhone(p.phone) === normPhone);
    if (existing) {
      MySwal.fire({
        title: 'Duplicate Phone Number',
        html: `A patient is already registered with this phone number: <br/><br/><b>${existing.name}</b> (${existing.phone})<br/><br/>Please edit this patient instead of registering a new one to avoid duplicate records.`,
        icon: 'warning',
        confirmButtonText: 'Understood',
        confirmButtonColor: '#0d9488',
        customClass: {
          popup: 'rounded-2xl',
          confirmButton: 'rounded-lg font-semibold px-8 py-2'
        }
      });
      return;
    }

    try {
      const created = await addPatient({
        name: newPatient.name,
        phone: newPatient.phone,
        age: parseInt(newPatient.age) || 0,
        gender: newPatient.gender,
        status: 'Active',
        photoUrl: newPatient.photoUrl || undefined,
        address: (newPatient as any).address || undefined,
        email: newPatient.email || undefined,
        preferredCommunicationChannel: newPatient.preferredCommunicationChannel || 'AUTO',
      });
      
      setSelectedPatient(created);
      toast.success('Patient registered successfully.');
      setDrawerMode('startVisit'); // Immediately flow into start visit
      setVisitDoctor('');
      setActiveVisitWarning(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to register patient');
    }
  };

  const handleUpdatePatient = async () => {
    if (!selectedPatient) return;
    try {
      if (updatePatient) {
        await updatePatient(selectedPatient.id, {
          name: newPatient.name || selectedPatient.name,
          phone: newPatient.phone || selectedPatient.phone,
          age: parseInt(newPatient.age) || selectedPatient.age,
          gender: newPatient.gender || selectedPatient.gender,
          address: (newPatient as any).address || selectedPatient.address,
          email: newPatient.email !== undefined ? newPatient.email : selectedPatient.email,
          preferredCommunicationChannel: newPatient.preferredCommunicationChannel || selectedPatient.preferredCommunicationChannel || 'AUTO',
        });
        setSelectedPatient(prev => prev ? {
          ...prev,
          name: newPatient.name || selectedPatient.name,
          phone: newPatient.phone || selectedPatient.phone,
          age: parseInt(newPatient.age) || selectedPatient.age,
          gender: newPatient.gender || selectedPatient.gender,
          address: (newPatient as any).address || selectedPatient.address,
          email: newPatient.email !== undefined ? newPatient.email : selectedPatient.email,
          preferredCommunicationChannel: newPatient.preferredCommunicationChannel || selectedPatient.preferredCommunicationChannel || 'AUTO',
        } : prev);
      }
      const activeVisit = getActiveVisit(selectedPatient.id);
      if (activeVisit && updateVisit && visitReason !== undefined) {
        await updateVisit(activeVisit.id, { reasonForVisit: visitReason });
      }
      toast.success('Patient details updated.');
      setDrawerMode('view');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update patient');
    }
  };

  const handleOpenStartVisit = (patient: Patient) => {
    setSelectedPatient(patient);
    setVisitDoctor('');
    setActiveVisitWarning(hasActiveVisit(patient.id));
    setDrawerMode('startVisit');
    setDrawerOpen(true);
  };

  const handleConfirmVisit = async () => {
    if (!selectedPatient || !visitDoctor) return;
    try {
      await startVisit(selectedPatient.id, visitDoctor, false, visitReason);
      toast.success(`Visit started for ${selectedPatient.name}.`);
      setDrawerOpen(false);
    } catch (err: any) {
      if (err.response?.status === 409) {
        toast.error(err.response.data?.error || 'This patient already has an active visit.');
      } else {
        toast.error('Failed to start visit. ' + (err.response?.status || err.message));
      }
    }
  };

  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: "name",
      header: "Patient",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.photoUrl ? (
            <img src={row.original.photoUrl} alt={row.original.name} className="w-8 h-8 rounded-md object-cover shadow-sm border border-slate-200" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-100">
              {row.original.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-slate-900">{row.original.name}</span>
        </div>
      )
    },
    {
      accessorKey: "phone",
      header: "Contact",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-slate-900 font-medium">{row.original.phone}</span>
        </div>
      )
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isExisting = visits.some(v => v.patientId === row.original.id && v.status === 'COMPLETED');
        return isExisting ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60 shadow-sm">
            Existing
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
            New
          </span>
        );
      }
    },
    {
      accessorKey: "age",
      header: "Age / Gender",
      cell: ({ row }) => (
        <span className="text-slate-600">
          {row.original.age != null ? `${row.original.age} Yrs` : '—'} • {row.original.gender || '—'}
        </span>
      )
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryModalPatient(row.original);
            }}
            title="View Patient Records"
            aria-label="View patient history"
          >
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">
      
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search patients and review their complete visit-by-visit clinical records.
          </p>
        </div>
        {currentUser?.role === 'Head Doctor' && (
          <Button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-xs flex items-center gap-1.5 h-9 px-3.5 rounded-xl self-start sm:self-auto transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Existing Patients
          </Button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex-1 flex flex-col">
        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, ID or phone..."
          filterSlot={
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="flex h-9 w-[130px] items-center justify-between rounded-xl border border-input bg-slate-50/50 hover:bg-slate-50 px-3 py-1.5 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          }
          exportOptions={{ 
            pdf: true, 
            excel: true, 
            csv: true,
            onExport: (format) => {
              const query = new URLSearchParams({
                format,
                ...(search ? { search } : {}),
                ...(filterGender && filterGender !== 'all' ? { gender: filterGender } : {})
              }).toString();
              api.download(`/api/patients/export?${query}`, `patients_export.${format}`);
            }
          }}
        />

        <div className="p-4 flex-1 flex flex-col">
          <DataTable 
            columns={columns} 
            data={patients} 
            selectable={false}
            loading={isLoading}
          manualPagination={true}
          pageCount={meta.totalPages}
          totalRecords={meta.totalRecords}
          state={{ pagination }}
          onStateChange={(updater: any) => {
            if (typeof updater === 'function') {
              setPagination(updater(pagination));
            } else if (updater.pagination) {
              setPagination(updater.pagination);
            }
          }}
          emptyState={
            search !== '' ? (
              <DataTableEmpty 
                icon={UserPlus} 
                title="No patient found" 
                description={`There is no patient matching "${search}".`}
              />
            ) : (
              <DataTableEmpty title="No patients yet" description="No patient records found in the system." />
            )
          }
        />
        </div>
      </div>

      {/* Universal Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent 
          side="right" 
          size="lg" 
          className="sm:max-w-md bg-white border-l shadow-2xl p-0 flex flex-col gap-0 transition-transform duration-300"
          onInteractOutside={(e) => {
            if (isCameraOpen) e.preventDefault();
          }}
        >
          
          {(selectedPatient || drawerMode === 'create') && (
            <>
              {drawerMode === 'create' ? (
                <SheetTitle className="sr-only">Register Patient</SheetTitle>
              ) : (
                <PatientProfileHeader 
                  name={selectedPatient!.name}
                  patientId={selectedPatient!.id}
                  phone={selectedPatient!.phone}
                  modeText={
                    drawerMode === 'view' ? 'Patient Profile' : 
                    drawerMode === 'startVisit' ? 'Start Clinic Visit' : 
                    'Edit Profile'
                  }
                />
              )}

              <SheetScrollArea className="flex-1 p-0 bg-slate-50">
                <div className="px-6 py-8 space-y-8">
                  {drawerMode === 'view' && selectedPatient && (
                    <DrawerSection title="Basic Information">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                        <ReadOnlyField label="Full Name" value={selectedPatient.name} />
                        <ReadOnlyField label="Phone" value={selectedPatient.phone || '—'} />
                        <ReadOnlyField label="Age" value={selectedPatient.age != null ? `${selectedPatient.age} Yrs` : '—'} />
                        <ReadOnlyField label="Gender" value={selectedPatient.gender || '—'} />
                        <div className="sm:col-span-2 mt-2">
                          <ReadOnlyField label="Address" value={selectedPatient.address || 'Not provided'} />
                        </div>
                        <ReadOnlyField label="Email" value={selectedPatient.email || 'Not provided'} />
                        <ReadOnlyField 
                          label="Communication Channel" 
                          value={
                            selectedPatient.preferredCommunicationChannel === 'WHATSAPP'
                              ? 'WhatsApp Only'
                              : selectedPatient.preferredCommunicationChannel === 'SMS'
                              ? 'SMS Only'
                              : selectedPatient.preferredCommunicationChannel === 'EMAIL'
                              ? 'Email Only'
                              : 'Auto (WhatsApp / SMS Fallback)'
                          } 
                        />
                        {getActiveVisit(selectedPatient.id) && (
                          <div className="sm:col-span-2 mt-2">
                            <ReadOnlyField label="Current Reason for Visit" value={getActiveVisit(selectedPatient.id)!.reasonForVisit || 'Not specified'} />
                          </div>
                        )}
                      </div>
                    </DrawerSection>
                  )}

                  {drawerMode === 'view' && selectedPatient && (
                    <div className="mt-8 space-y-8">
                      <TreatmentPlanUI patientId={selectedPatient.id} />
                      <PatientVisitHistory 
                        visits={visits
                          .filter(v => v.patientId === selectedPatient.id && v.status === 'COMPLETED')
                          .map(v => ({ id: v.id, date: 'Completed Visit', title: v.reasonForVisit || 'Consultation', status: v.status }))} 
                        onView={(id) => setHistoricalVisitId(id)}
                      />
                    </div>
                  )}

                  {(drawerMode === 'edit' || drawerMode === 'create') && (
                    <DrawerSection title="Basic Information">
                      <div className="space-y-6">
                        
                        {(drawerMode === 'create' || drawerMode === 'edit') && (
                          <div className="mt-4">
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Patient Photo</label>
                            
                            {isCameraOpen ? (
                              <CameraCapture 
                                onCapture={(imageSrc) => {
                                  setNewPatient({...newPatient, photoUrl: imageSrc});
                                  setIsCameraOpen(false);
                                }}
                                onCancel={() => setIsCameraOpen(false)}
                              />
                            ) : (
                                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                                  {newPatient.photoUrl ? (
                                    <div className="flex flex-col items-center gap-3">
                                      <img src={newPatient.photoUrl} alt="Patient" className="w-24 h-24 rounded-md object-cover border-4 border-white shadow-sm" />
                                      <Button 
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCameraOpen(true)}
                                        className="text-teal-600 border-teal-200 hover:bg-teal-50"
                                      >
                                        <Camera className="w-4 h-4 mr-2" />
                                        Replace Photo
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="cursor-pointer flex flex-col items-center gap-2" onClick={() => setIsCameraOpen(true)}>
                                      <div className="w-16 h-16 bg-slate-200 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-300 transition-colors shadow-inner">
                                        <Camera className="w-8 h-8" />
                                      </div>
                                      <span className="text-sm font-medium text-slate-600">Capture Photo</span>
                                    </div>
                                  )}
                                </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Full Name <span className="text-red-500">*</span></label>
                          <Input 
                            value={drawerMode === 'create' ? newPatient.name : (newPatient.name || selectedPatient?.name || '')} 
                            onChange={e => (drawerMode === 'create' || drawerMode === 'edit') && setNewPatient({...newPatient, name: e.target.value})}
                            className="bg-white" 
                            placeholder="e.g. John Doe"
                            autoFocus={drawerMode === 'create' || drawerMode === 'edit'}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Phone <span className="text-red-500">*</span></label>
                            <Input 
                              value={drawerMode === 'create' ? newPatient.phone : (newPatient.phone || selectedPatient?.phone || '')} 
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                (drawerMode === 'create' || drawerMode === 'edit') && setNewPatient({...newPatient, phone: val})
                              }}
                              className="bg-white" 
                              placeholder="10 digit number"
                              maxLength={10}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Age <span className="text-red-500">*</span></label>
                            <Input 
                              value={drawerMode === 'create' ? newPatient.age : (newPatient.age || selectedPatient?.age || '')} 
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                                (drawerMode === 'create' || drawerMode === 'edit') && setNewPatient({...newPatient, age: val})
                              }}
                              type="text" 
                              placeholder="e.g. 35"
                              className="bg-white" 
                              maxLength={3}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Gender <span className="text-red-500">*</span></label>
                          <Select 
                            value={drawerMode === 'create' ? newPatient.gender : (newPatient.gender || selectedPatient?.gender)} 
                            onValueChange={(val) => (drawerMode === 'create' || drawerMode === 'edit') && setNewPatient({...newPatient, gender: val as any})}
                            disabled={drawerMode === 'view' as any}
                          >
                            <SelectTrigger className="w-full h-10 rounded-xl bg-white border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                              <SelectValue placeholder="Select Gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Email Address (Optional)</label>
                            <Input 
                              type="email"
                              value={newPatient.email} 
                              onChange={e => (drawerMode === 'create' || drawerMode === 'edit') && setNewPatient({...newPatient, email: e.target.value})}
                              placeholder="e.g. patient@example.com"
                              className="bg-white" 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Preferred Channel</label>
                            <Select 
                              value={newPatient.preferredCommunicationChannel} 
                              onValueChange={(val) => (drawerMode === 'create' || drawerMode === 'edit') && setNewPatient({...newPatient, preferredCommunicationChannel: val as any})}
                              disabled={drawerMode === 'view' as any}
                            >
                              <SelectTrigger className="w-full h-10 rounded-xl bg-white border-slate-200">
                                <SelectValue placeholder="Select Channel" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">Auto (WhatsApp primary, SMS fallback)</SelectItem>
                                <SelectItem value="WHATSAPP">WhatsApp Only</SelectItem>
                                <SelectItem value="SMS">SMS Only</SelectItem>
                                <SelectItem value="EMAIL">Email Only</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Reason for Visit</label>
                          <textarea 
                            value={visitReason}
                            onChange={e => setVisitReason(e.target.value)}
                            placeholder="e.g. Routine Checkup, Toothache, Cleaning..."
                            className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-teal-300 focus-visible:ring-4 focus-visible:ring-teal-50 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Address (Optional)</label>
                          <textarea 
                            value={drawerMode === 'create' ? (newPatient as any).address : ((newPatient as any).address || selectedPatient?.address || '')}
                            onChange={e => (drawerMode === 'create' || drawerMode === 'edit') && setNewPatient({...newPatient, address: e.target.value})}
                            disabled={drawerMode === 'view' as any}
                            placeholder="Patient address"
                            className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-teal-300 focus-visible:ring-4 focus-visible:ring-teal-50 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                          />
                        </div>
                      </div>
                    </DrawerSection>
                  )}

                  {drawerMode === 'startVisit' && selectedPatient && (
                    <DrawerSection title="Visit Details">
                      {activeVisitWarning && (
                        <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-[13px]">Active Visit Warning</div>
                            <div className="text-sm opacity-80 mt-1">This patient already has an active visit in progress. Creating another visit will run concurrently. Proceed with caution.</div>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Assign Provider</label>
                          <select 
                            value={visitDoctor}
                            onChange={e => setVisitDoctor(e.target.value)}
                            disabled={doctors.length === 0}
                            className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[14px] text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all focus-visible:outline-none focus-visible:border-teal-300 focus-visible:ring-4 focus-visible:ring-teal-50 hover:border-slate-300 disabled:opacity-50"
                          >
                            <option value="" disabled>
                              {doctors.length === 0 ? 'No doctors available...' : 'Select a doctor...'}
                            </option>
                            {doctors.map((d: any) => (
                              <option key={d.id} value={d.id}>{d.name} ({d.role})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700">Appointment Reference (Optional)</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Walk-in (No appointment)" disabled className="bg-slate-50 pl-9" />
                          </div>
                          <p className="text-[11px] text-slate-500">Only walk-ins are supported in this demo phase.</p>
                        </div>
                      </div>
                    </DrawerSection>
                  )}
                </div>
              </SheetScrollArea>

              <DrawerFooterActions>
                {drawerMode === 'view' ? (
                  <>
                    <Button onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white shadow-sm border-0">
                      Close
                    </Button>
                    <Button 
                      onClick={() => {
                        setDrawerMode('edit');
                        const activeVisit = getActiveVisit(selectedPatient!.id);
                        setVisitReason(activeVisit?.reasonForVisit || '');
                      }} 
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border-0"
                    >
                      Edit Patient
                    </Button>
                    <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 shadow-sm" onClick={() => selectedPatient && handleOpenStartVisit(selectedPatient)}>
                      <Play className="w-4 h-4 mr-2" />
                      Start Visit
                    </Button>
                  </>
                ) : drawerMode === 'startVisit' ? (
                  <>
                    <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto bg-white shadow-sm">
                      Cancel
                    </Button>
                    <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 shadow-sm" onClick={handleConfirmVisit} disabled={!visitDoctor}>
                      <Play className="w-4 h-4 mr-2" />
                      Create & Add to Queue
                    </Button>
                  </>
                ) : drawerMode === 'create' ? (
                  <>
                    <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto bg-white shadow-sm">
                      Cancel
                    </Button>
                    <Button className="w-full sm:w-auto shadow-sm" onClick={handleSaveNewPatient} disabled={!newPatient.name || !newPatient.phone}>
                      Register Patient
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto bg-white shadow-sm">
                      Cancel
                    </Button>
                    <Button className="w-full sm:w-auto shadow-sm" onClick={handleUpdatePatient}>
                      Save Changes
                    </Button>
                  </>
                )}
              </DrawerFooterActions>
            </>
          )}
        </SheetContent>
    </Sheet>

      <Dialog open={!!historicalVisitId} onOpenChange={(open) => !open && setHistoricalVisitId(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historical Visit Details</DialogTitle>
            <DialogDescription>
              Review the read-only clinical records for this completed visit.
            </DialogDescription>
          </DialogHeader>
          {historicalVisitId && (
            <HistoricalVisitDetails 
              visitId={historicalVisitId} 
              onViewHistory={() => {
                const p = selectedPatient || patients.find(pat => visits.some(v => v.id === historicalVisitId && v.patientId === pat.id));
                if (p) {
                  setHistoricalVisitId(null);
                  setHistoryModalPatient(p);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Patient History Dialog (Desktop-optimized Full Record View) */}
      <Dialog open={!!historyModalPatient} onOpenChange={(open) => !open && setHistoryModalPatient(null)}>
        <DialogContent className="sm:max-w-5xl w-[95vw] h-[90vh] max-h-[90vh] p-0 flex flex-col overflow-hidden bg-slate-50 border-slate-200">
          {historyModalPatient && (
            <PatientCompleteHistory 
              patientId={historyModalPatient.id}
              onClose={() => setHistoryModalPatient(null)}
              onEditPatient={() => {
                setSelectedPatient(historyModalPatient);
                setDrawerMode('edit');
                const activeVisit = getActiveVisit(historyModalPatient.id);
                setVisitReason(activeVisit?.reasonForVisit || '');
                setHistoryModalPatient(null);
                setDrawerOpen(true);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Existing Patient Import Modal (Head Doctor Only) */}
      <PatientImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImportComplete={() => {
          fetchPatients(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterGender);
        }}
      />
    </div>
  );
}

