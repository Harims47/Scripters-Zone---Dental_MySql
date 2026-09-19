import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Calendar as CalendarIcon, Clock, Edit2, XCircle, FileText, CheckCircle2, Eye } from 'lucide-react'
import { DataTable } from '../components/data-table/data-table'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { DataTableToolbar } from '../components/data-table/data-table-toolbar'
import { DataTableEmpty } from '../components/data-table/data-table'
import { Badge } from '../components/ui/badge'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { DrawerFooterActions } from '../components/ui/drawer-patterns'
import {
  getAppointmentStatusBadge,
  DoctorSelector,
  PatientSelector
} from '../components/appointments/appointment-components'
import { WhatsAppActionButton } from '../components/communication/WhatsAppActionButton'
import { type AppointmentStatus } from '../lib/mock-data'
import { useClinicContext } from '../context/ClinicContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { PaginationMeta, PaginatedResponse, Appointment } from '../types/domain'

interface AppointmentRow {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  date: string
  time: string
  doctorId: string
  type: string
  status: AppointmentStatus
  notes: string
  photoUrl?: string
  preferredCommunicationChannel?: 'AUTO' | 'WHATSAPP' | 'SMS' | 'EMAIL'
  whatsappAvailable?: boolean | null
}

export function AppointmentsPage() {
  const { patients, visits, staff, addAppointment, updateAppointment, confirmAppointmentArrival } = useClinicContext()
  const { currentUser } = useAuth()
  const isReceptionist = currentUser?.role === 'Receptionist'
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterDate, setFilterDate] = useState('all-dates')
  const [filterStatus, setFilterStatus] = useState('all-status')
  const [filterDoctor, setFilterDoctor] = useState('all-doctors')

  const [data, setData] = useState<AppointmentRow[]>([])
  const [meta, setMeta] = useState<PaginationMeta>({ currentPage: 1, pageSize: 10, totalRecords: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [debouncedSearch, filterDate, filterStatus, filterDoctor])

  const fetchAppointments = useCallback(async (page: number, limit: number, query: string, fDate: string, fStatus: string, fDoctor: string) => {
    setIsLoading(true)
    try {
      const res = await api.get<PaginatedResponse<Appointment & { patient?: any }>>(`/api/appointments?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}&date=${fDate}&status=${fStatus}&doctor=${fDoctor}`)
      const payload = res as any
      if (payload.data && payload.meta) {
        const mappedData: AppointmentRow[] = payload.data.map((a: any) => ({
          id: a.id,
          patientId: a.patientId,
          patientName: a.patient?.name || 'Unknown',
          patientPhone: a.patient?.phone || '-',
          date: a.date,
          time: a.time,
          doctorId: a.providerId,
          type: a.type,
          status: a.status as AppointmentStatus,
          notes: a.notes || '',
          preferredCommunicationChannel: a.patient?.preferredCommunicationChannel,
          whatsappAvailable: a.patient?.whatsappAvailable
        }))
        setData(mappedData)
        setMeta(payload.meta)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAppointments(pagination.pageIndex + 1, pagination.pageSize, debouncedSearch, filterDate, filterStatus, filterDoctor)
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, filterDate, filterStatus, filterDoctor, fetchAppointments])

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'view' | 'edit'>('create')

  // Edit/Create form state
  const [activeItem, setActiveItem] = useState<Partial<AppointmentRow>>({})

  // Modal states
  const [checkInModalOpen, setCheckInModalOpen] = useState(false)
  const [checkInTarget, setCheckInTarget] = useState<AppointmentRow | null>(null)

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null)


  const handleOpenCreate = () => {
    setActiveItem({
      status: 'Scheduled',
      type: 'Consultation',
      date: new Date().toISOString().split('T')[0]
    })
    setDrawerMode('create')
    setDrawerOpen(true)
  }

  const handleOpenView = (row: AppointmentRow) => {
    setActiveItem(row)
    setDrawerMode('view')
    setDrawerOpen(true)
  }

  const handleOpenEdit = (row: AppointmentRow) => {
    setActiveItem(row)
    setDrawerMode('edit')
    setDrawerOpen(true)
  }

  const handleSave = async () => {
    try {
      if (drawerMode === 'create') {
        await addAppointment({
          patientId: activeItem.patientId || '',
          providerId: activeItem.doctorId || '',
          date: activeItem.date || '',
          time: activeItem.time || '',
          type: (activeItem.type as any) || 'Consultation',
          status: (activeItem.status as AppointmentStatus) || 'Scheduled',
          notes: activeItem.notes || ''
        })
      } else if (drawerMode === 'edit') {
        await updateAppointment({
          id: activeItem.id,
          patientId: activeItem.patientId,
          providerId: activeItem.doctorId,
          date: activeItem.date,
          time: activeItem.time,
          type: activeItem.type as any,
          status: activeItem.status as AppointmentStatus,
          notes: activeItem.notes
        })
      }
      setDrawerOpen(false)
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to save appointment')
    }
  }

  const initiateCancel = (row: Partial<AppointmentRow>) => {
    setCancelTarget(row as AppointmentRow)
    setCancelModalOpen(true)
  }

  const handleDelete = async () => {
    if (cancelTarget) {
      try {
        await updateAppointment({ id: cancelTarget.id, status: 'Cancelled' })
        setCancelModalOpen(false)
        setCancelTarget(null)
        setDrawerOpen(false)
      } catch (err: any) {
        console.error(err)
        alert(err.message || 'Failed to cancel appointment')
      }
    }
  }

  const initiateCheckIn = (row: AppointmentRow) => {
    setCheckInTarget(row)
    setCheckInModalOpen(true)
  }

  const handleConfirmArrival = async () => {
    if (checkInTarget) {
      try {
        await confirmAppointmentArrival(checkInTarget.id)
        setCheckInModalOpen(false)
        setCheckInTarget(null)
      } catch (err: any) {
        console.error(err)
        alert(err.message || 'Failed to check in appointment')
      }
    }
  }



  const columns: ColumnDef<AppointmentRow>[] = [
    {
      header: "Patient",
      accessorKey: "patientName",
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.original.patientName}</span>
        </div>
      )
    },
    {
      header: "Date & Time",
      accessorKey: "date",
      cell: ({ row }) => (
        <div>
          <div className="text-slate-900">{row.original.date}</div>
          <div className="text-sm text-slate-500">{row.original.time}</div>
        </div>
      )
    },
    {
      header: "Provider",
      accessorKey: "doctorId",
      cell: ({ row }) => {
        const doc = (staff || []).find((d: any) => d.id === row.original.doctorId)
        return (
          <span className="text-sm font-medium text-slate-700">{doc?.name || row.original.doctorId}</span>
        )
      }
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => <span className="text-slate-700">{row.original.type}</span>
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => {
        const hasActiveVisit = visits.some(v => v.patientId === row.original.patientId && ['IN_PROGRESS', 'WAITING', 'READY_FOR_PAYMENT'].includes(v.status));
        if (hasActiveVisit && ['Scheduled'].includes(row.original.status)) {
          return <Badge variant="statusActive">In Clinic</Badge>
        }
        return getAppointmentStatusBadge(row.original.status)
      }
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const hasActiveVisit = visits.some(v => v.patientId === row.original.patientId && ['IN_PROGRESS', 'WAITING', 'READY_FOR_PAYMENT'].includes(v.status));
        
        return (
          <div className="flex items-center justify-end gap-2">
            {['Scheduled'].includes(row.original.status) && !hasActiveVisit && (
              <Button 
                size="sm" 
                className="h-8 px-3 text-xs shadow-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg" 
                onClick={(e) => { e.stopPropagation(); initiateCheckIn(row.original); }}
              >
                Check In
              </Button>
            )}
            {!isReceptionist && ['Scheduled'].includes(row.original.status) && (
              <>
                <Button size="icon" className="h-8 w-8 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg" onClick={(e) => { e.stopPropagation(); handleOpenEdit(row.original); }} aria-label="Edit appointment">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button size="icon" className="h-8 w-8 shadow-sm bg-rose-500 hover:bg-rose-600 text-white rounded-lg" onClick={(e) => { e.stopPropagation(); initiateCancel(row.original); }} aria-label="Cancel appointment">
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}
            {['Scheduled', 'Checked In'].includes(row.original.status) && (
              <WhatsAppActionButton
                type={row.original.date > new Date().toISOString().split('T')[0] ? 'APPOINTMENT_REMINDER' : 'APPOINTMENT_CONFIRMATION'}
                entityType="APPOINTMENT"
                entityId={row.original.id}
                patientId={row.original.patientId}
                recipientName={row.original.patientName}
                recipientPhone={row.original.patientPhone}
                preferredCommunicationChannel={row.original.preferredCommunicationChannel}
                whatsappAvailable={row.original.whatsappAvailable}
                variant="icon"
                label="Send via WhatsApp"
              />
            )}
            <Button size="icon" onClick={(e) => { e.stopPropagation(); handleOpenView(row.original); }} className="h-8 w-8 shadow-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg" aria-label="View appointment">
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        )
      }
    }
  ]

  // Derived for drawer header
  const isEditing = drawerMode === 'edit'
  const isCreating = drawerMode === 'create'

  const drawerPatient = patients.find(p => p.id === activeItem.patientId) ||
    (isCreating ? undefined : { name: activeItem.patientName || '', id: activeItem.patientId || '', phone: activeItem.patientPhone || '' })

  const relatedVisit = activeItem.id ? visits.find(v => v.appointmentId === activeItem.id) : undefined

  return (
    <div className="h-full flex flex-col gap-6 max-w-[1400px] mx-auto pb-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Appointments</h1>
          <p className="text-slate-500 mt-1">Manage scheduled patient appointments and doctors.</p>
        </div>
        <Button onClick={handleOpenCreate} className="shadow-sm w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          New Appointment
        </Button>
      </div>

      <DataTableToolbar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search patient or phone..."
        exportOptions={{ 
          pdf: true, 
          excel: true, 
          csv: true,
          onExport: (format) => {
            const query = new URLSearchParams({
              format,
              ...(search ? { search } : {}),
              date: filterDate,
              status: filterStatus,
              doctor: filterDoctor
            }).toString();
            api.download(`/api/appointments/export?${query}`, `appointments_export.${format}`);
          }
        }}
        filterSlot={
          <>
            <select 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)}
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-slate-50/50 hover:bg-slate-50 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="next-7-days">Next 7 Days</option>
              <option value="all-dates">All Dates</option>
            </select>
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-slate-50/50 hover:bg-slate-50 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all-status">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              
              <option value="checked-in">Checked In</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select 
              value={filterDoctor}
              onChange={e => setFilterDoctor(e.target.value)}
              className="flex h-9 w-[150px] items-center justify-between rounded-md border border-input bg-slate-50/50 hover:bg-slate-50 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all-doctors">All Doctors</option>
              {(staff || []).filter((s: any) => s.role && s.role.includes('Doctor')).map((doc: any) => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          </>
        }
      />

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex-1">
        <DataTable
          columns={columns}
          data={data}
          onRowClick={handleOpenView}
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
                icon={Search}
                title="No appointments found"
                description={`There are no appointments matching "${search}".`}
              />
            ) : (
              <DataTableEmpty
                icon={CalendarIcon}
                title="No appointments yet"
                description="No appointments scheduled for this period."
              />
            )
          }
        />
      </div>

      {/* Appointment Modal */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-2xl bg-white p-0 gap-0 overflow-hidden">

          {/* Modal Header */}
          {isCreating ? (
            <div className="px-6 py-5 bg-white border-b border-slate-100/60 relative z-10 flex-shrink-0">
              <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mt-1">New Appointment</h2>
            </div>
          ) : (
            <div className="px-6 pr-12 py-5 bg-white border-b border-slate-100/60 relative z-10 flex flex-col gap-2 flex-shrink-0">
              <div className="flex justify-between items-start">
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{isEditing ? 'Reschedule / Edit' : 'Appointment Details'}</h2>
                {getAppointmentStatusBadge(activeItem.status as AppointmentStatus)}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-600 border border-slate-200">
                  {drawerPatient?.name?.charAt(0) || '?'}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{drawerPatient?.name}</div>
                  <div className="text-sm text-slate-500">{drawerPatient?.phone}</div>
                </div>
              </div>
            </div>
          )}

          {/* Checked In Success State */}
          {drawerMode === 'view' && activeItem.status === 'Checked In' && (
            <div className="px-6 py-4 bg-teal-50 border-b border-teal-100 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-teal-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-teal-900">Patient checked in successfully</h4>
                <p className="text-sm text-teal-700 mt-1">Patient is waiting in the queue.</p>
              </div>
            </div>
          )}

          {/* Modal Body */}
          <div className="p-0 bg-slate-50 flex-1 overflow-y-auto max-h-[60vh]">
            <div className="px-6 sm:px-8 py-6 space-y-8">

              {/* Form Fields */}
              <div className="space-y-6">

                {/* Camera Capture Section for Appointments (Moved to top) */}
                {(isCreating || isEditing) && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Attachment / Photo (Optional)</label>
                    <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                      {activeItem.photoUrl ? (
                        <div className="relative">
                          <img src={activeItem.photoUrl} alt="Attachment" className="w-full max-w-[200px] rounded-lg object-cover border-4 border-white shadow-sm" />
                          <button
                            onClick={() => setActiveItem(prev => ({ ...prev, photoUrl: '' }))}
                            className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-sm hover:bg-rose-600"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <Button variant="outline" size="sm" className="mt-4 shadow-sm w-full rounded-xl" onClick={() => setActiveItem(prev => ({ ...prev, photoUrl: '' }))}>
                            Retake Photo
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full max-w-[200px] flex flex-col items-center gap-3">
                          <div className="w-32 aspect-video bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden relative shadow-inner">
                            <span className="text-xs font-semibold">Camera Area</span>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 shadow-sm rounded-xl"
                            onClick={() => setActiveItem(prev => ({ ...prev, photoUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop' }))}
                          >
                            Take Photo
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Patient Selection (Only in Create Mode) */}
                {isCreating && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Patient<span className="text-rose-500 ml-1">*</span></label>
                    <PatientSelector
                      value={activeItem.patientId || ''}
                      onChange={(val) => setActiveItem(prev => ({ ...prev, patientId: val }))}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Doctor<span className="text-rose-500 ml-1">*</span></label>
                  <DoctorSelector
                    value={activeItem.doctorId || ''}
                    onChange={(val) => setActiveItem(prev => ({ ...prev, doctorId: val }))}
                    disabled={drawerMode === 'view'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Date<span className="text-rose-500 ml-1">*</span></label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="date"
                        className="pl-9 bg-white rounded-xl focus-visible:ring-teal-500"
                        value={activeItem.date || ''}
                        onChange={e => setActiveItem(prev => ({ ...prev, date: e.target.value }))}
                        readOnly={drawerMode === 'view'}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Time<span className="text-rose-500 ml-1">*</span></label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="time"
                        className="pl-9 bg-white rounded-xl focus-visible:ring-teal-500"
                        value={activeItem.time ? activeItem.time.replace(/ (AM|PM)/, '') : ''} // basic mock time handling
                        onChange={e => setActiveItem(prev => ({ ...prev, time: e.target.value }))}
                        readOnly={drawerMode === 'view'}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Appointment Type<span className="text-rose-500 ml-1">*</span></label>
                  <select
                    className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
                    value={activeItem.type || ''}
                    onChange={e => setActiveItem(prev => ({ ...prev, type: e.target.value }))}
                    disabled={drawerMode === 'view'}
                  >
                    <option value="" disabled>Select Type...</option>
                    <option value="Consultation">Consultation</option>
                    <option value="General Checkup">General Checkup</option>
                    <option value="Surgery">Surgery</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Notes / Reason</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <textarea
                      className="flex min-h-[100px] w-full rounded-xl border border-input bg-white px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                      value={activeItem.notes || ''}
                      placeholder="Enter appointment notes..."
                      onChange={e => setActiveItem(prev => ({ ...prev, notes: e.target.value }))}
                      readOnly={drawerMode === 'view'}
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Status<span className="text-rose-500 ml-1">*</span></label>
                    <select
                      className="flex h-10 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      value={activeItem.status || 'Scheduled'}
                      onChange={e => setActiveItem(prev => ({ ...prev, status: e.target.value as AppointmentStatus }))}
                    >
                      <option value="Scheduled">Scheduled</option>
                      
                      <option value="Checked In">Checked In</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="No Show">No Show</option>
                    </select>
                  </div>
                )}

              </div>

            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-white border-t px-6 py-4">
            {drawerMode === 'view' ? (
              <DrawerFooterActions>
                <Button onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white border-0">Close</Button>
                {activeItem.status === 'Checked In' && relatedVisit && (
                  <Button variant="outline" className="w-full sm:w-auto border-teal-200 text-teal-700 bg-teal-50" onClick={() => navigate('/queue')}>
                    View in Queue
                  </Button>
                )}
                {['Scheduled', 'Checked In'].includes(activeItem.status || '') && (
                  <WhatsAppActionButton
                    type={activeItem.date && activeItem.date > new Date().toISOString().split('T')[0] ? 'APPOINTMENT_REMINDER' : 'APPOINTMENT_CONFIRMATION'}
                    entityType="APPOINTMENT"
                    entityId={activeItem.id}
                    patientId={activeItem.patientId}
                    recipientName={activeItem.patientName || 'Patient'}
                    recipientPhone={activeItem.patientPhone || ''}
                    preferredCommunicationChannel={activeItem.preferredCommunicationChannel}
                    whatsappAvailable={activeItem.whatsappAvailable}
                    variant="outline"
                    className="w-full sm:w-auto"
                  />
                )}
                {['Scheduled'].includes(activeItem.status || '') && (
                  <>
                    <Button className="w-full sm:w-auto border-teal-600 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => { initiateCheckIn(activeItem as AppointmentRow); }}>
                      Check In
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => initiateCancel(activeItem)}>
                      Cancel
                    </Button>
                    <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white border-0" onClick={() => setDrawerMode('edit')}>
                      Edit
                    </Button>
                  </>
                )}
              </DrawerFooterActions>
            ) : (
              <DrawerFooterActions>
                <Button variant="outline" onClick={() => setDrawerOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleSave}
                  disabled={isCreating && !activeItem.patientId}
                >
                  {isCreating ? 'Schedule Appointment' : 'Save Changes'}
                </Button>
              </DrawerFooterActions>
            )}
          </div>

        </DialogContent>
      </Dialog>

      {/* Check In Modal */}
      <Dialog open={checkInModalOpen} onOpenChange={setCheckInModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Confirm Check In</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to check in <span className="font-semibold text-slate-900">{checkInTarget?.patientName}</span>?
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCheckInModalOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmArrival} className="bg-teal-600 hover:bg-teal-700 text-white">Confirm Check In</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Appointment Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel the appointment for <span className="font-semibold text-slate-900">{cancelTarget?.patientName}</span>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>Back</Button>
            <Button variant="destructive" onClick={handleDelete}>Cancel Appointment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
