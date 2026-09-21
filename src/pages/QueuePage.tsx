import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, PlayCircle, Users, Tag } from 'lucide-react'
import { DataTable } from '../components/data-table/data-table'
import { DataTableToolbar } from '../components/data-table/data-table-toolbar'
import { DataTableEmpty } from '../components/data-table/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { toast } from 'react-hot-toast'

import { useClinicContext } from '../context/ClinicContext'
import { useAuth } from '../context/AuthContext'
import { canAccessRoute } from '../lib/route-permissions'
import { api } from '../lib/api'

type QueueRow = {
  id: string
  visitId: string
  patientId: string
  assignedDoctorId: string | null
  name: string
  reasonForVisit: string
  visitType: 'Walk-in' | 'Appointment'
  patientType: 'New Patient' | 'Existing Patient'
  status: string
}


export function QueuePage() {
  const { queue, patients, visits, consultations, appointments, refreshClinicOperations, applyDoctorDiscount } = useClinicContext()
  const { currentUser } = useAuth()
  const canManageClinical = currentUser ? canAccessRoute(currentUser.role, '/doctor') : false
  const [search, setSearch] = useState('')
  const [visitTypeFilter, setVisitTypeFilter] = useState<'all' | 'Walk-in' | 'Appointment'>('all')

  // Doctor Discount Modal State
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [selectedQueueRow, setSelectedQueueRow] = useState<QueueRow | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [discountReasonInput, setDiscountReasonInput] = useState('')
  const [isSubmittingDiscount, setIsSubmittingDiscount] = useState(false)
  
  const navigate = useNavigate()

  // Map Canonical Context Data to UI view model
  const queueRows: QueueRow[] = useMemo(() => {
    return queue.map(q => {
      const p = patients.find(pt => pt.id === q.patientId)
      const v = visits.find(visit => visit.id === q.visitId)

      // Determine Visit Type: Appointment if visit is linked to appointment or appointment exists for this visit, else Walk-in
      const isAppointment = Boolean(v?.appointmentId) || appointments.some(a => a.id === v?.appointmentId)
      const visitType: 'Walk-in' | 'Appointment' = isAppointment ? 'Appointment' : 'Walk-in'

      // Calculate Patient Type
      const patientVisits = visits.filter(visit => visit.patientId === q.patientId)
      const hasPastCompletedVisit = patientVisits.some(visit => visit.id !== q.visitId && visit.status === 'COMPLETED')
      const patientType = hasPastCompletedVisit ? 'Existing Patient' : 'New Patient'

      return {
        id: q.id,
        visitId: q.visitId,
        patientId: q.patientId,
        assignedDoctorId: q.assignedDoctorId || null,
        name: p?.name || 'Unknown Patient',
        reasonForVisit: v?.reasonForVisit || 'Not Specified',
        visitType,
        patientType,
        status: q.status
      }
    })
  }, [queue, patients, visits, appointments])

  const handleAction = async (id: string, action: 'Start') => {
    const row = queueRows.find(q => q.id === id)
    if (!row) return;

    if (action === 'Start') {
      try {
        await api.patch(`/api/queue/${row.id}/transition`, { action: 'START_CONSULTATION' })
        refreshClinicOperations().catch(console.error)
      } catch (err) {
        console.warn('Queue transition error on start:', err)
      }
      navigate(`/doctor/patient/${row.patientId}?visitId=${row.visitId}`)
    }
  }

  const filteredQueue = useMemo(() => {
    return queueRows.filter(q => {
      // Doctors only see their own assigned patients
      if (canManageClinical && currentUser?.staffId) {
        if (!q.assignedDoctorId || q.assignedDoctorId !== currentUser.staffId) return false
      }

      // Visit Type Filter (Walk-in vs Appointment)
      if (visitTypeFilter !== 'all' && q.visitType !== visitTypeFilter) {
        return false
      }

      // Search filter
      return q.name.toLowerCase().includes(search.toLowerCase()) || 
             q.patientId.toLowerCase().includes(search.toLowerCase()) ||
             q.reasonForVisit.toLowerCase().includes(search.toLowerCase())
    })
  }, [queueRows, canManageClinical, currentUser, visitTypeFilter, search])

  const exportQueue = (format: 'pdf' | 'xlsx' | 'csv') => {
    const query = new URLSearchParams({
      format,
      ...(search ? { search } : {}),
      ...(visitTypeFilter !== 'all' ? { visitType: visitTypeFilter } : {})
    }).toString();
    api.download(`/api/queue/export?${query}`, `queue_export.${format}`);
  }

  const openDiscountModal = (row: QueueRow) => {
    setSelectedQueueRow(row);
    const v = visits.find(visit => visit.id === row.visitId);
    const cons = consultations.find(c => c.visitId === row.visitId);
    const discountMatch = cons?.clinicalNotes?.match(/\[Doctor Discount:\s*₹?([0-9.]+)(?:\s*\|\s*Reason:\s*([^\]]*))?\]/i);
    if (discountMatch) {
      setDiscountInput(discountMatch[1]);
      setDiscountReasonInput(discountMatch[2] ? discountMatch[2].trim() : 'Patient requested reduction');
    } else if (v && v.amountDue !== undefined) {
      const sub = (v.consultationFee || 0) + (v.treatmentFee || 0) + (v.medicineCost || 0);
      if (sub > v.amountDue) {
        setDiscountInput(String(sub - v.amountDue));
        setDiscountReasonInput('Patient requested reduction');
      } else {
        setDiscountInput('');
        setDiscountReasonInput('Patient requested reduction');
      }
    } else {
      setDiscountInput('');
      setDiscountReasonInput('Patient requested reduction');
    }
    setDiscountModalOpen(true);
  };

  const handleApplyDiscount = async () => {
    if (!selectedQueueRow) return;
    const v = visits.find(visit => visit.id === selectedQueueRow.visitId);
    const subtotal = (v?.consultationFee || 0) + (v?.treatmentFee || 0) + (v?.medicineCost || 0);
    const discountAmt = parseFloat(discountInput) || 0;

    if (discountAmt < 0) {
      toast.error('Discount cannot be negative');
      return;
    }
    if (discountAmt > subtotal) {
      toast.error(`Discount (₹${discountAmt}) cannot exceed total bill charges (₹${subtotal})`);
      return;
    }

    setIsSubmittingDiscount(true);
    try {
      const res = await applyDoctorDiscount(selectedQueueRow.visitId, discountAmt, discountReasonInput.trim());
      if (res.success) {
        const revised = Math.max(0, subtotal - discountAmt);
        toast.success(`Discount of ₹${discountAmt} applied! Final bill is now ₹${revised}.`);
        setDiscountModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to apply discount');
      }
    } catch (err: any) {
      toast.error('Failed to apply discount');
    } finally {
      setIsSubmittingDiscount(false);
    }
  };

  const columns: ColumnDef<QueueRow>[] = [
    {
      accessorKey: "name",
      header: "Patient Name",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900 block">{row.original.name}</span>
      )
    },
    {
      accessorKey: "reasonForVisit",
      header: "Reason for Visit",
      cell: ({ row }) => <span className="text-sm font-medium text-slate-700">{row.original.reasonForVisit}</span>
    },
    {
      accessorKey: "visitType",
      header: "Visit Type",
      cell: ({ row }) => {
        const type = row.original.visitType
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            type === 'Walk-in' 
              ? 'bg-amber-50 text-amber-700 border border-amber-200/60' 
              : 'bg-purple-50 text-purple-700 border border-purple-200/60'
          }`}>
            {type}
          </span>
        )
      }
    },
    {
      accessorKey: "patientType",
      header: "Patient Type",
      cell: ({ row }) => {
        const type = row.original.patientType
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            type === 'New Patient' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {type}
          </span>
        )
      }
    },
    {
      accessorKey: "action",
      header: "Status",
      cell: ({ row }) => {
        const item = row.original;
        let actionButton = null;
        if (canManageClinical) {
          if (item.assignedDoctorId && (item.status === 'Called' || item.status === 'With Doctor' || item.status === 'Waiting' || item.status === 'In Progress' || item.status === 'Transferred')) {
            const hasConsultation = consultations.some(c => c.visitId === item.visitId);
            const isResuming = item.status === 'With Doctor' || item.status === 'Transferred' || hasConsultation;
            actionButton = (
              <Button size="sm" variant="default" className="h-9 bg-indigo-600 hover:bg-indigo-700 shadow-sm text-white" onClick={() => handleAction(item.id, 'Start')}>
                <PlayCircle className="mr-2 h-4 w-4" /> {isResuming ? 'Resume Consulting' : 'Start Consulting'}
              </Button>
            );
          } else if (item.status === 'Ready at Reception' || item.status === 'Ready for Reception' || item.status === 'Ready for Payment' || item.status === 'Paid' || item.status === 'Completed') {
            const v = visits.find(visit => visit.id === item.visitId);
            const cons = consultations.find(c => c.visitId === item.visitId);
            const subtotal = (v?.consultationFee || 0) + (v?.treatmentFee || 0) + (v?.medicineCost || 0);
            const discountMatch = cons?.clinicalNotes?.match(/\[Doctor Discount:\s*₹?([0-9.]+)/i);
            const existingDiscount = discountMatch ? parseFloat(discountMatch[1]) : (v && v.amountDue !== undefined && subtotal > v.amountDue ? subtotal - v.amountDue : 0);

            actionButton = (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                  🟢 {item.status}
                </span>
                {existingDiscount > 0 && (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200 whitespace-nowrap">
                    -₹{existingDiscount} Disc
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-xs font-semibold text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 shadow-2xs"
                  onClick={() => openDiscountModal(item)}
                  title="Enter / Edit doctor discount for this patient"
                >
                  <Tag className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                  {existingDiscount > 0 ? 'Edit Discount' : 'Discount / Bill'}
                </Button>
              </div>
            );
          }
        }

        return (
          <div className="flex items-center gap-2">
            {item.status === 'Transferred' && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800">
                Transferred
              </span>
            )}
            {actionButton ? actionButton : (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                {item.status}
              </span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="bg-white rounded-2xl border border-slate-100/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
        <DataTableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search patient, ID or reason..."
          filterSlot={
            <div className="flex items-center gap-2">
              <Select 
                value={visitTypeFilter} 
                onValueChange={(val: 'all' | 'Walk-in' | 'Appointment') => setVisitTypeFilter(val)}
              >
                <SelectTrigger className="h-9 w-36 bg-slate-50 border-slate-200 text-xs font-medium text-slate-700">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                  <SelectItem value="Appointment">Appointment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          exportOptions={{
            pdf: true,
            excel: true,
            csv: true,
            onExport: exportQueue
          }}
        />

        <div className="p-4">
          <DataTable 
            columns={columns} 
            data={filteredQueue}
            emptyState={
              search !== '' || visitTypeFilter !== 'all' ? (
                <DataTableEmpty 
                  icon={Search} 
                  title="No patients found" 
                  description={`No queue entries matching your filter criteria.`}
                />
              ) : (
                <DataTableEmpty 
                  icon={Users}
                  title="Queue is empty" 
                  description="No patients are currently in the queue." 
                />
              )
            }
          />
        </div>
      </div>

      {/* Doctor Authorized Discount / Concession Dialog */}
      <Dialog open={discountModalOpen} onOpenChange={setDiscountModalOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-5 border border-slate-200 shadow-xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-600" />
                Doctor Discount / Concession
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedQueueRow && (() => {
            const activeVisit = visits.find(v => v.id === selectedQueueRow.visitId);
            const consultFee = activeVisit?.consultationFee || 0;
            const treatFee = activeVisit?.treatmentFee || 0;
            const medCost = activeVisit?.medicineCost || 0;
            const subtotal = consultFee + treatFee + medCost;
            const currentDiscountNum = parseFloat(discountInput) || 0;
            const revisedBill = Math.max(0, subtotal - currentDiscountNum);

            // 4 compact presets
            const presets: { label: string, amount: number }[] = [];
            if (subtotal % 100 > 0) {
              presets.push({ label: `Round (-₹${subtotal % 100})`, amount: subtotal % 100 });
            }
            if (subtotal >= 500) presets.push({ label: `₹100`, amount: 100 });
            if (subtotal >= 1000) presets.push({ label: `₹200`, amount: 200 });
            if (subtotal >= 2000) presets.push({ label: `₹500`, amount: 500 });
            presets.push({ label: `Full Waiver`, amount: subtotal });

            const quickReasons = ['Patient Request', 'Senior Citizen', 'Hardship', 'Courtesy'];

            return (
              <div className="space-y-3 pt-0.5 text-xs">
                {/* Patient & bill summary in 1 neat line */}
                <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/70 flex justify-between items-center">
                  <div>
                    <span className="text-slate-500">Patient: </span>
                    <strong className="text-slate-900 font-semibold">{selectedQueueRow.name}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Total: </span>
                    <strong className="text-slate-900 font-bold text-sm">₹{subtotal}</strong>
                  </div>
                </div>

                {/* Discount input */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">Discount Amount (₹)</label>
                    {subtotal > 0 && <span className="text-slate-400 text-[11px]">Max ₹{subtotal}</span>}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <Input
                      type="number"
                      min="0"
                      max={subtotal}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="0"
                      className="pl-6 h-8 text-xs font-semibold"
                      autoFocus
                    />
                  </div>
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {presets.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDiscountInput(String(p.amount))}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-all ${
                          currentDiscountNum === p.amount
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reason chips & input */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Reason</label>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {quickReasons.map((r, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDiscountReasonInput(r)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all ${
                          discountReasonInput === r
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={discountReasonInput}
                    onChange={(e) => setDiscountReasonInput(e.target.value)}
                    placeholder="Enter reason..."
                    className="h-8 text-xs"
                  />
                </div>

                {/* Compact final calculation banner */}
                <div className="bg-emerald-50/90 px-3 py-2 rounded-lg border border-emerald-200 flex justify-between items-center">
                  <div>
                    <span className="text-slate-600 text-[11px]">Final Bill: </span>
                    <strong className="text-sm font-extrabold text-emerald-900">₹{revisedBill}</strong>
                  </div>
                  {currentDiscountNum > 0 && (
                    <span className="text-emerald-700 font-bold text-xs bg-emerald-100/80 px-2 py-0.5 rounded">
                      -₹{currentDiscountNum} off
                    </span>
                  )}
                </div>

                <DialogFooter className="pt-1 flex gap-2 sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDiscountModalOpen(false)}
                    disabled={isSubmittingDiscount}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyDiscount}
                    disabled={isSubmittingDiscount || currentDiscountNum < 0 || currentDiscountNum > subtotal}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  >
                    {isSubmittingDiscount ? 'Applying...' : 'Apply Discount'}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

